import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleSnapshot } from '../src/handlers/snapshot';
import type { Env } from '../src/types';

afterEach(() => vi.restoreAllMocks());

const ARCHIVE_URL =
  'https://web.archive.org/web/20141018083000/https://twitter.com/jack/status/523389174242488320';

const JSON_PAYLOAD = JSON.stringify({
  data: {
    id: '523389174242488320',
    text: 'just setting up my twttr',
    created_at: '2006-03-21T20:50:14.000Z',
    author_id: '12',
  },
  includes: {
    users: [{ id: '12', name: 'Jack', username: 'jack' }],
    media: [],
  },
});

function makeR2(initial: Record<string, string> = {}): R2Bucket {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      if (!val) return null;
      return { text: async () => val } as unknown as R2ObjectBody;
    }),
    put: vi.fn(async (key: string, val: BodyInit) => {
      store.set(key, val as string);
      return {} as R2Object;
    }),
  } as unknown as R2Bucket;
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
  return { waitUntil: vi.fn((p) => p), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

describe('handleSnapshot', () => {
  it('returns 400 when ?url= is missing', async () => {
    const req = new Request('https://edge.example.com/snapshot');
    const res = await handleSnapshot(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('responds 204 with CORS headers for OPTIONS', async () => {
    const req = new Request('https://edge.example.com/snapshot?url=' + encodeURIComponent(ARCHIVE_URL), { method: 'OPTIONS' });
    const res = await handleSnapshot(req, makeEnv(), makeCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns cached post on R2 hit without calling fetch', async () => {
    const { cacheKey } = await import('../src/cache');
    const key = cacheKey(ARCHIVE_URL, '1');
    const r2 = makeR2({ [key]: JSON.stringify({ post: { id: '523389174242488320', text: 'cached!' } }) });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const req = new Request('https://edge.example.com/snapshot?url=' + encodeURIComponent(ARCHIVE_URL));
    const res = await handleSnapshot(req, makeEnv(r2), makeCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('HIT');
    const body = await res.json() as { post: { text: string } };
    expect(body.post.text).toBe('cached!');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches archive.org on R2 miss, parses, returns MISS header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON_PAYLOAD, { status: 200 }),
    ));
    const r2 = makeR2();
    const ctx = makeCtx();

    const req = new Request('https://edge.example.com/snapshot?url=' + encodeURIComponent(ARCHIVE_URL));
    const res = await handleSnapshot(req, makeEnv(r2), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.json() as { post: { id: string } };
    expect(body.post?.id).toBe('523389174242488320');
    // waitUntil was called for the R2 write-back
    expect((ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('returns 502 when archive.org fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Service Unavailable', { status: 503 }),
    ));

    const req = new Request('https://edge.example.com/snapshot?url=' + encodeURIComponent(ARCHIVE_URL));
    const res = await handleSnapshot(req, makeEnv(), makeCtx());
    expect(res.status).toBe(502);
  });
});
