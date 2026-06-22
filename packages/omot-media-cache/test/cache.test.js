import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchAndCacheImage, hashUrl, isAllowedSourceUrl } from '../src/cache.js';

test('hashUrl is stable', () => {
  assert.equal(hashUrl('https://example.com/a'), hashUrl('https://example.com/a'));
  assert.notEqual(hashUrl('https://example.com/a'), hashUrl('https://example.com/b'));
});

test('isAllowedSourceUrl accepts exact hosts and subdomains only', () => {
  assert.equal(isAllowedSourceUrl('https://web.archive.org/web/1/foo', ['web.archive.org']), true);
  assert.equal(isAllowedSourceUrl('https://evilweb.archive.org.example/x', ['web.archive.org']), false);
  assert.equal(isAllowedSourceUrl('file:///tmp/a', ['web.archive.org']), false);
});

test('fetchAndCacheImage stores misses and returns hits later', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'omot-media-'));
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(Buffer.from('fake-image'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg', 'content-length': '10' },
    });
  };

  try {
    const options = {
      rootDir,
      allowedHosts: ['pbs.twimg.com'],
      maxBytes: 1024,
      fetchTimeoutMs: 1000,
    };
    const url = 'https://pbs.twimg.com/media/test.jpg';
    const miss = await fetchAndCacheImage(url, options);
    const hit = await fetchAndCacheImage(url, options);

    assert.equal(miss.cacheStatus, 'MISS');
    assert.equal(hit.cacheStatus, 'HIT');
    assert.equal(hit.meta.bytes, 10);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('fetchAndCacheImage rejects explicit non-image responses', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'omot-media-'));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });

  try {
    await assert.rejects(
      () => fetchAndCacheImage('https://pbs.twimg.com/media/test.jpg', {
        rootDir,
        allowedHosts: ['pbs.twimg.com'],
        maxBytes: 1024,
        fetchTimeoutMs: 1000,
      }),
      /upstream is not an image/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});
