import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCdx, cdxCacheKey } from '../src/handlers/cdx';
import type { Env } from '../src/types';

afterEach(() => vi.restoreAllMocks());

// v2 schema: archive.org responses are `fl=`-trimmed to the 5 columns we
// consume. Tests use this format so they exercise the same JSON shape that
// `fetchArchiveCdx` actually produces.
const SAMPLE_CDX = JSON.stringify([
  ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
  ['20060321205014', 'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA'],
]);
const EMPTY_CDX = JSON.stringify([
  ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
]);

const FRESH_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const EMPTY_STALE_MS = 30 * 60 * 1000;

interface Stored {
  body: string;
  customMetadata?: Record<string, string>;
}

function makeR2(initial: Record<string, Stored> = {}): R2Bucket {
  const store = new Map<string, Stored>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      if (!val) return null;
      return {
        text: async () => val.body,
        customMetadata: val.customMetadata,
      } as unknown as R2ObjectBody;
    }),
    put: vi.fn(async (key: string, body: BodyInit, opts?: R2PutOptions) => {
      store.set(key, { body: body as string, customMetadata: opts?.customMetadata });
      return {} as R2Object;
    }),
    _store: store,
  } as unknown as R2Bucket & { _store: Map<string, Stored> };
}

function makeEnv(r2?: R2Bucket): Env {
  return {
    OMOT_CACHE: r2 ?? makeR2(),
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn((p: Promise<unknown>) => p), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe('handleCdx', () => {
  it('returns 400 when ?user= is missing', async () => {
    const req = new Request('https://edge.example.com/cdx');
    const res = await handleCdx(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid usernames (rejects path traversal / SSRF)', async () => {
    const req = new Request('https://edge.example.com/cdx?user=../evil');
    const res = await handleCdx(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('responds 204 with CORS headers for OPTIONS, including Authorization', async () => {
    const req = new Request('https://edge.example.com/cdx?user=jack', { method: 'OPTIONS' });
    const res = await handleCdx(req, makeEnv(), makeCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/\bAuthorization\b/i);
  });

  it('serves a fresh cached body without calling fetch (X-Cache: HIT)', async () => {
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: SAMPLE_CDX,
        customMetadata: { cachedAt: String(Date.now() - 1000), rowCount: '1' },
      },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('HIT');
    expect(await res.text()).toBe(SAMPLE_CDX);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('serves a stale cached body and schedules a background refresh (X-Cache: STALE)', async () => {
    const stale = Date.now() - (FRESH_MS + 60_000); // just past fresh window
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: SAMPLE_CDX,
        customMetadata: { cachedAt: String(stale), rowCount: '1' },
      },
    });
    const refreshed = '[["timestamp","original","mimetype","statuscode","digest"],["20260101000000","https://twitter.com/jack/status/21","text/html","200","B"]]';
    const fetchSpy = vi.fn().mockResolvedValue(new Response(refreshed, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('STALE');
    expect(await res.text()).toBe(SAMPLE_CDX);
    // ctx.waitUntil ran the refresh; let it settle so we can verify the write.
    await Promise.all((ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]));
    expect(fetchSpy).toHaveBeenCalledOnce();
    const next = await env_get(r2, cdxCacheKey('jack'));
    expect(next).toBe(refreshed);
  });

  it('re-fetches synchronously when cache is older than the stale window', async () => {
    const ancient = Date.now() - (STALE_MS + 60_000);
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: SAMPLE_CDX,
        customMetadata: { cachedAt: String(ancient), rowCount: '1' },
      },
    });
    const fresh = '[["h"],["row"]]';
    const fetchSpy = vi.fn().mockResolvedValue(new Response(fresh, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(await res.text()).toBe(fresh);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('fetches archive.org on cold cache, returns body with X-Cache: MISS, writes back', async () => {
    const fresh = '[["h"],["row"]]';
    const fetchSpy = vi.fn().mockResolvedValue(new Response(fresh, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r2 = makeR2();
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(await res.text()).toBe(fresh);
    // archive.org subrequest must use the collapse=digest dedupe so we don't
    // pull every snapshot of the same content (matches legacy frontend behaviour).
    const upstreamUrl = fetchSpy.mock.calls[0][0] as string;
    expect(upstreamUrl).toContain('collapse=digest');
    expect(upstreamUrl).toContain('twitter.com%2Fjack%2Fstatus');
    // `fl=` projection — without it, archive.org times out on prefix scans
    // for active accounts. Must NOT include `length` (the slow column).
    expect(upstreamUrl).toMatch(/[?&]fl=timestamp%2Coriginal%2Cmimetype%2Cstatuscode%2Cdigest(?:&|$)/);
    await Promise.all((ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]));
    const stored = await env_get(r2, cdxCacheKey('jack'));
    expect(stored).toBe(fresh);
  });

  it('falls back to over-stale cache when archive.org fails (does not 502)', async () => {
    const ancient = Date.now() - (STALE_MS + 60_000);
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: SAMPLE_CDX,
        customMetadata: { cachedAt: String(ancient), rowCount: '1' },
      },
    });
    const fetchSpy = vi.fn().mockRejectedValue(new Error('archive.org down'));
    vi.stubGlobal('fetch', fetchSpy);

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), makeCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('STALE');
    expect(await res.text()).toBe(SAMPLE_CDX);
  });

  it('falls back to an over-stale empty CDX cache when archive.org fails', async () => {
    // Earlier behaviour returned 502 here on the theory that empty results
    // shouldn't get pinned forever. EMPTY_FRESH_MS / EMPTY_STALE_MS already
    // make negative caches expire fast (5/30 min vs 1/14 day for non-empty),
    // so we can safely prefer STALE-empty over a hard 502 when upstream is
    // flapping. archive.org returning 504 for genuinely-empty users is the
    // motivating case — locking them out of any answer is worse than a
    // delayed-by-30-min one.
    const ancient = Date.now() - (EMPTY_STALE_MS + 60_000);
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: EMPTY_CDX,
        customMetadata: { cachedAt: String(ancient), rowCount: '0' },
      },
    });
    const fetchSpy = vi.fn().mockRejectedValue(new Error('archive.org down'));
    vi.stubGlobal('fetch', fetchSpy);

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), makeCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('STALE');
    expect(await res.text()).toBe(EMPTY_CDX);
  });

  it('keeps empty CDX cache fresh only briefly, then refreshes in the background', async () => {
    const staleEmpty = Date.now() - (6 * 60 * 1000);
    const r2 = makeR2({
      [cdxCacheKey('jack')]: {
        body: EMPTY_CDX,
        customMetadata: { cachedAt: String(staleEmpty), rowCount: '0' },
      },
    });
    const refreshed = SAMPLE_CDX;
    const fetchSpy = vi.fn().mockResolvedValue(new Response(refreshed, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('STALE');
    expect(await res.text()).toBe(EMPTY_CDX);
    await Promise.all((ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]));
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(await env_get(r2, cdxCacheKey('jack'))).toBe(refreshed);
  });

  it('returns 502 on archive.org failure when nothing is cached', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('archive.org down'));
    vi.stubGlobal('fetch', fetchSpy);

    const req = new Request('https://edge.example.com/cdx?user=jack');
    const res = await handleCdx(req, makeEnv(), makeCtx());
    expect(res.status).toBe(502);
  });
});

async function env_get(r2: R2Bucket, key: string): Promise<string | null> {
  const obj = await r2.get(key);
  return obj ? await obj.text() : null;
}
