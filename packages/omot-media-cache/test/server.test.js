import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMediaCacheServer } from '../src/server.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
  });
}

test('media endpoint requires key and serves cached image responses', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'omot-media-'));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(Buffer.from('fake-image'), {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': '10' },
  });

  const server = createMediaCacheServer({
    key: 'secret',
    rootDir,
    allowedHosts: ['pbs.twimg.com'],
    maxBytes: 1024,
    fetchTimeoutMs: 1000,
  });
  const port = await listen(server);

  try {
    const source = encodeURIComponent('https://pbs.twimg.com/media/test.png');
    const denied = await request(port, `/media?url=${source}`);
    assert.equal(denied.status, 401);

    const ok = await request(port, `/media?url=${source}&key=secret`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['x-cache'], 'MISS');
    assert.equal(ok.body, 'fake-image');

    const hit = await request(port, `/media?url=${source}&key=secret`);
    assert.equal(hit.headers['x-cache'], 'HIT');
  } finally {
    server.close();
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});
