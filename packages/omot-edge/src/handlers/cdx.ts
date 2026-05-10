import type { Env } from '../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// Stale-while-revalidate windows. Tuned for archive.org's slow CDX cadence:
// new snapshots for any given user appear days apart at most, so a 1-day
// fresh window keeps the worker fast without serving content older than
// two weeks. Past STALE_MS we re-fetch synchronously rather than risk
// returning a result the user might mistake for fresh.
const FRESH_MS = 24 * 60 * 60 * 1000;       // 1 day
const STALE_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days
const EMPTY_FRESH_MS = 5 * 60 * 1000;        // 5 minutes
const EMPTY_STALE_MS = 30 * 60 * 1000;       // 30 minutes

const USERNAME_RE = /^[A-Za-z0-9_]{1,20}$/;

// v2 schema: archive.org responses are now `fl=`-trimmed (5 columns instead
// of 7). Bumping the cache prefix isolates the new format from any v1 blobs
// still sitting in R2 from before the change.
export function cdxCacheKey(user: string): string {
  return `cdx/v2/${user.toLowerCase()}.json`;
}

async function fetchArchiveCdx(user: string): Promise<string> {
  const url = new URL('https://web.archive.org/cdx/search/cdx');
  url.searchParams.set('url', `twitter.com/${user}/status`);
  url.searchParams.set('matchType', 'prefix');
  url.searchParams.set('output', 'json');
  url.searchParams.set('limit', '100000');
  url.searchParams.set('collapse', 'digest');
  // archive.org's CDX has to read each row's `length` from WARC metadata,
  // and that dominates wall time on prefix scans for active users — large
  // accounts routinely run past archive's own 60s gateway. Trimming `fl` to
  // only the columns we consume drops upstream latency roughly in half and
  // turns 504s from default behaviour into a tail event.
  url.searchParams.set('fl', 'timestamp,original,mimetype,statuscode,digest');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'omot-edge/1.0 (+https://github.com/ayanamists/oh-my-old-tweet)' },
  });
  if (!res.ok) {
    throw new Error(`archive.org CDX returned ${res.status} for user ${user}`);
  }
  return res.text();
}

function countCdxRows(body: string): number | undefined {
  try {
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) return undefined;
    // Header detection has to tolerate both schemas: v2 starts with
    // `timestamp` at index 0; legacy v1 had `urlkey` at 0 and `timestamp`
    // at 1. Stale v1 cache may still be served as a fallback during deploy.
    const first = Array.isArray(rows[0]) ? rows[0] : null;
    const hasHeader = first !== null && (first[0] === 'timestamp' || first[1] === 'timestamp');
    return Math.max(0, rows.length - (hasHeader ? 1 : 0));
  } catch {
    return undefined;
  }
}

async function writeCache(env: Env, user: string, body: string): Promise<void> {
  const rowCount = countCdxRows(body);
  await env.OMOT_CACHE.put(cdxCacheKey(user), body, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      cachedAt: String(Date.now()),
      ...(rowCount !== undefined ? { rowCount: String(rowCount) } : {}),
    },
  });
}

export async function handleCdx(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const user = url.searchParams.get('user') ?? '';
  if (!USERNAME_RE.test(user)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid ?user= parameter' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const respond = (body: string, cacheStatus: 'HIT' | 'STALE' | 'MISS', age?: number) => new Response(body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'X-Cache': cacheStatus,
      ...(age !== undefined ? { 'X-Cache-Age-Ms': String(age) } : {}),
      // Browsers can cache short-term to absorb retries, but the worker
      // itself is the canonical store — keep this small.
      'Cache-Control': 'public, max-age=60',
    },
  });

  const cached = await env.OMOT_CACHE.get(cdxCacheKey(user));
  let cachedBody: string | undefined;
  let cachedAge: number | undefined;
  let cachedRowCount: number | undefined;
  if (cached) {
    const cachedAt = Number(cached.customMetadata?.cachedAt ?? 0);
    cachedAge = Date.now() - cachedAt;
    cachedBody = await cached.text();
    cachedRowCount = cached.customMetadata?.rowCount !== undefined
      ? Number(cached.customMetadata.rowCount)
      : countCdxRows(cachedBody);

    const freshMs = cachedRowCount === 0 ? EMPTY_FRESH_MS : FRESH_MS;
    const staleMs = cachedRowCount === 0 ? EMPTY_STALE_MS : STALE_MS;

    if (cachedAge < staleMs) {
      if (cachedAge >= freshMs) {
        // Stale-while-revalidate: serve cached now, refresh in background.
        ctx.waitUntil(
          fetchArchiveCdx(user)
            .then((fresh) => writeCache(env, user, fresh))
            .catch(() => { /* keep serving stale on upstream failure */ }),
        );
        return respond(cachedBody, 'STALE', cachedAge);
      }
      return respond(cachedBody, 'HIT', cachedAge);
    }
    // Fall through: cache too old to trust, re-fetch synchronously.
  }

  let body: string;
  try {
    body = await fetchArchiveCdx(user);
  } catch (err) {
    // If we have any cached body (even an empty result), prefer it over 502
    // — better to show the user something than nothing while archive.org is
    // flapping. The earlier carve-out for empty caches was over-eager: the
    // EMPTY_FRESH_MS / EMPTY_STALE_MS windows already make negative results
    // expire much faster than positive ones, so they're never stuck for
    // long, and serving STALE on upstream failure beats a hard 502.
    if (cached && cachedBody !== undefined) {
      return respond(cachedBody, 'STALE', cachedAge);
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  ctx.waitUntil(writeCache(env, user, body));
  return respond(body, 'MISS');
}
