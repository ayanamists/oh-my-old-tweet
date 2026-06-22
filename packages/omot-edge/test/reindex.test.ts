import { describe, expect, it, vi } from 'vitest';
import { archiveUrlFromSnapshotKey, handleReindex } from '../src/handlers/reindex';
import type { Env } from '../src/types';

const SNAPSHOT_KEY =
  'snapshot/v3/https_//web.archive.org/web/20220911181541/https_//twitter.com/jk48jb/status/1569026912315478016.json';
const CANONICAL_JSON_URL =
  'https://web.archive.org/web/20220911181541if_/https://twitter.com/jk48jb/status/1569026912315478016';
const POST_BODY = JSON.stringify({
  post: {
    id: '1569026912315478016',
    text: 'legacy json tweet',
    date: '2022-09-11T18:15:41.000Z',
    user: { userName: 'jk48jb', fullName: 'JK', id: '12345' },
    images: [],
  },
});
const CDX_BODY = JSON.stringify([
  ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
  [
    '20220911181541',
    'https://twitter.com/jk48jb/status/1569026912315478016',
    'application/json',
    '200',
    'digest-json',
  ],
]);

function makeR2(initial: Record<string, string>, listKeys = Object.keys(initial)): R2Bucket {
  return {
    get: vi.fn(async (key: string) => {
      const body = initial[key];
      if (body === undefined) return null;
      return { text: async () => body } as unknown as R2ObjectBody;
    }),
    list: vi.fn(async ({ prefix = '', cursor, limit = 1000 }: R2ListOptions = {}) => {
      const keys = listKeys.filter((key) => key.startsWith(prefix));
      const start = cursor ? Number(cursor) : 0;
      const selected = keys.slice(start, start + limit);
      const next = start + selected.length;
      const truncated = next < keys.length;
      return {
        objects: selected.map((key) => ({ key })),
        truncated,
        cursor: truncated ? String(next) : undefined,
        delimitedPrefixes: [],
      };
    }),
  } as unknown as R2Bucket;
}

function makeD1() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({}),
  };
  const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
  return { db, stmt };
}

function makeEnv(r2: R2Bucket, db?: D1Database, apiKey = 'secret'): Env {
  return {
    OMOT_CACHE: r2,
    OMOT_DB: db ?? null as unknown as D1Database,
    PARSER_VERSION: '4',
    ARCHIVE_BASE: 'https://web.archive.org',
    OMOT_API_KEY: apiKey,
  };
}

function makeRequest(url: string, token = 'secret'): Request {
  return new Request(url, { headers: { Authorization: `Bearer ${token}` } });
}

describe('archiveUrlFromSnapshotKey', () => {
  it('reconstructs archive URLs from snapshot cache keys', () => {
    expect(archiveUrlFromSnapshotKey(SNAPSHOT_KEY)).toBe(
      'https://web.archive.org/web/20220911181541/https://twitter.com/jk48jb/status/1569026912315478016',
    );
  });

  it('reconstructs http original URLs from old snapshot cache keys', () => {
    expect(archiveUrlFromSnapshotKey(
      'snapshot/v1/https_//web.archive.org/web/20220911181541/http_//twitter.com/jk48jb/status/1569026912315478016.json',
    )).toBe(
      'https://web.archive.org/web/20220911181541/http://twitter.com/jk48jb/status/1569026912315478016',
    );
  });
});

describe('handleReindex', () => {
  it('requires OMOT_API_KEY even when normal auth would be disabled', async () => {
    const env = makeEnv(makeR2({}), undefined, '');

    const res = await handleReindex(new Request('https://edge.example.com/admin/reindex'), env);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: 'OMOT_API_KEY is required for admin routes',
    });
  });

  it('rejects requests with the wrong bearer token', async () => {
    const res = await handleReindex(
      makeRequest('https://edge.example.com/admin/reindex', 'wrong'),
      makeEnv(makeR2({})),
    );

    expect(res.status).toBe(401);
  });

  it('dry-runs R2 snapshot objects without writing D1', async () => {
    const r2 = makeR2({
      [SNAPSHOT_KEY]: POST_BODY,
      'cdx/v2/jk48jb.json': CDX_BODY,
    }, [SNAPSHOT_KEY]);
    const { db } = makeD1();

    const res = await handleReindex(
      makeRequest('https://edge.example.com/admin/reindex?limit=10'),
      makeEnv(r2, db),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      write: false,
      listed: 1,
      parsed: 1,
      indexed: 0,
      cdxHits: 1,
      fixedJsonPath: 1,
      done: true,
    });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('writes canonical JSON if_ archive URLs and preserves parser version from the key', async () => {
    const r2 = makeR2({
      [SNAPSHOT_KEY]: POST_BODY,
      'cdx/v2/jk48jb.json': CDX_BODY,
    }, [SNAPSHOT_KEY]);
    const { db, stmt } = makeD1();

    const res = await handleReindex(
      makeRequest('https://edge.example.com/admin/reindex?limit=10&write=1'),
      makeEnv(r2, db),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      write: true,
      indexed: 1,
      fixedJsonPath: 1,
    });
    expect(stmt.bind).toHaveBeenCalledWith(
      '1569026912315478016',
      'jk48jb',
      '12345',
      Math.floor(Date.UTC(2022, 8, 11, 18, 15, 41) / 1000),
      CANONICAL_JSON_URL,
      'legacy json tweet',
      0,
      3,
    );
  });

  it('returns an R2 cursor for callers to continue a full rebuild', async () => {
    const secondKey = SNAPSHOT_KEY.replace('1569026912315478016', '1569026912315478017');
    const r2 = makeR2({
      [SNAPSHOT_KEY]: POST_BODY,
      [secondKey]: POST_BODY,
    }, [SNAPSHOT_KEY, secondKey]);

    const res = await handleReindex(
      makeRequest('https://edge.example.com/admin/reindex?limit=1'),
      makeEnv(r2),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      listed: 1,
      done: false,
      nextCursor: '1',
    });
  });
});
