import type { Env } from '../types';
import { getCachedPost, setCachedPost } from '../cache';
import { fetchArchiveHtml } from '../fetchArchive';
import { upsertTweet, logAccess } from '../db';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleSnapshot(
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
  const archiveUrl = url.searchParams.get('url');
  if (!archiveUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Cache read ──────────────────────────────────────────────────────────────
  const cached = await getCachedPost(env, archiveUrl);
  if (cached !== undefined) {
    if (cached) ctx.waitUntil(logAccess(env, cached.user?.userName ?? '').catch(() => {}));
    return new Response(JSON.stringify({ post: cached }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // ── Cache miss: fetch + parse ───────────────────────────────────────────────
  let post;
  try {
    const html = await fetchArchiveHtml(archiveUrl);
    const { parsePostFromUrl } = await import('../parse');
    post = await parsePostFromUrl(html, archiveUrl) ?? null;
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Write-back is best-effort and non-blocking.
  ctx.waitUntil(Promise.all([
    setCachedPost(env, archiveUrl, post),
    post ? upsertTweet(env, archiveUrl, post) : Promise.resolve(),
    post ? logAccess(env, post.user?.userName ?? '') : Promise.resolve(),
  ]).catch(() => { /* never surface side-write errors to the caller */ }));

  return new Response(JSON.stringify({ post }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
