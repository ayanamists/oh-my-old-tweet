import assert from 'node:assert/strict';
import test from 'node:test';
import { prefetchUrls, pullMediaUrlsFromEdge } from '../src/prefetch.js';

test('pullMediaUrlsFromEdge sends cursor, limit, and avatars flag', async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl;
  let requestedAuth;
  globalThis.fetch = async (url, init) => {
    requestedUrl = new URL(url);
    requestedAuth = init.headers.Authorization;
    return new Response(JSON.stringify({ urls: [], done: true }));
  };

  try {
    await pullMediaUrlsFromEdge({
      edgeUrl: 'https://edge.example.com/',
      apiKey: 'secret',
      cursor: 'abc',
      limit: 12,
      avatars: false,
    });

    assert.equal(requestedUrl.origin + requestedUrl.pathname, 'https://edge.example.com/admin/media-urls');
    assert.equal(requestedUrl.searchParams.get('cursor'), 'abc');
    assert.equal(requestedUrl.searchParams.get('limit'), '12');
    assert.equal(requestedUrl.searchParams.get('avatars'), '0');
    assert.equal(requestedAuth, 'Bearer secret');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('prefetchUrls records failures without throwing', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('not found', { status: 404 });

  try {
    const stats = await prefetchUrls(['https://pbs.twimg.com/media/missing.jpg'], {
      rootDir: '/tmp/unused-omot-media-cache-test',
      allowedHosts: ['pbs.twimg.com'],
      maxBytes: 1024,
      fetchTimeoutMs: 1000,
    });

    assert.equal(stats.total, 1);
    assert.equal(stats.ok, 0);
    assert.equal(stats.failed, 1);
    assert.match(stats.errors[0].error, /upstream returned 404/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
