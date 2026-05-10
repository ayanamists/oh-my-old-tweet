import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

function makeEnv(): Env {
  return {
    OMOT_CACHE: {
      get: vi.fn(async () => {
        throw new Error('r2 unavailable');
      }),
    } as unknown as R2Bucket,
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe('worker fetch routing', () => {
  it('returns a CORS-bearing error when a route throws before its handler response', async () => {
    const archiveUrl = 'https://web.archive.org/web/20200101/https://twitter.com/jack/status/20';
    const req = new Request(`https://edge.example.com/snapshot?url=${encodeURIComponent(archiveUrl)}`);

    const res = await worker.fetch(req, makeEnv(), makeCtx());

    expect(res.status).toBe(500);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/\bAuthorization\b/i);
    await expect(res.json()).resolves.toMatchObject({ error: 'r2 unavailable' });
  });
});
