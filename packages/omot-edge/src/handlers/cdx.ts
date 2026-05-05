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

const USERNAME_RE = /^[A-Za-z0-9_]{1,20}$/;

export function cdxCacheKey(user: string): string {
  return `cdx/v1/${user.toLowerCase()}.json`;
}

async function fetchArchiveCdx(user: string): Promise<string> {
  const url = new URL('https://web.archive.org/cdx/search/cdx');
  url.searchParams.set('url', `twitter.com/${user}/status`);
  url.searchParams.set('matchType', 'prefix');
  url.searchParams.set('output', 'json');
  url.searchParams.set('limit', '100000');
  url.searchParams.set('collapse', 'digest');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'omot-edge/1.0 (+https://github.com/ayanamists/oh-my-old-tweet)' },
  });
  if (!res.ok) {
    throw new Error(`archive.org CDX returned ${res.status} for user ${user}`);
  }
  return res.text();
}

async function writeCache(env: Env, user: string, body: string): Promise<void> {
  await env.OMOT_CACHE.put(cdxCacheKey(user), body, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { cachedAt: String(Date.now()) },
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
  if (cached) {
    const cachedAt = Number(cached.customMetadata?.cachedAt ?? 0);
    const age = Date.now() - cachedAt;
    if (age < STALE_MS) {
      const body = await cached.text();
      if (age >= FRESH_MS) {
        // Stale-while-revalidate: serve cached now, refresh in background.
        ctx.waitUntil(
          fetchArchiveCdx(user)
            .then((fresh) => writeCache(env, user, fresh))
            .catch(() => { /* keep serving stale on upstream failure */ }),
        );
        return respond(body, 'STALE', age);
      }
      return respond(body, 'HIT', age);
    }
    // Fall through: cache too old to trust, re-fetch synchronously.
  }

  let body: string;
  try {
    body = await fetchArchiveCdx(user);
  } catch (err) {
    // If we have an over-stale cache, prefer it over a 502 — better to show
    // the user something than nothing while archive.org is flapping.
    if (cached) {
      const fallback = await cached.text();
      const age = Date.now() - Number(cached.customMetadata?.cachedAt ?? 0);
      return respond(fallback, 'STALE', age);
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  ctx.waitUntil(writeCache(env, user, body));
  return respond(body, 'MISS');
}
