import { performance } from 'node:perf_hooks';
import { fetchAndCacheImage } from './cache.js';

export async function prefetchUrls(urls, config, { concurrency = 4 } = {}) {
  const unique = [...new Set(urls)].filter(Boolean);
  const started = performance.now();
  let next = 0;
  const stats = {
    total: unique.length,
    ok: 0,
    hit: 0,
    miss: 0,
    failed: 0,
    bytes: 0,
    errors: [],
  };

  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= unique.length) return;
      const url = unique[index];
      try {
        const result = await fetchAndCacheImage(url, config);
        stats.ok += 1;
        stats.bytes += result.meta.bytes;
        if (result.cacheStatus === 'HIT') stats.hit += 1;
        else stats.miss += 1;
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  const elapsedMs = performance.now() - started;
  return {
    ...stats,
    elapsedMs,
    bytesPerSecond: elapsedMs > 0 ? stats.bytes / (elapsedMs / 1000) : 0,
  };
}

export async function pullMediaUrlsFromEdge({ edgeUrl, apiKey, cursor, limit = 100, avatars }) {
  const url = new URL(`${edgeUrl.replace(/\/$/, '')}/admin/media-urls`);
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  if (avatars != null) url.searchParams.set('avatars', avatars ? '1' : '0');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`edge returned ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}
