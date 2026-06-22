import { describe, it, expect, vi } from 'vitest';
import { handleSearch } from '../src/handlers/search';
import type { Env } from '../src/types';

function makeEnv(): Env {
  return {
    OMOT_CACHE: null as unknown as R2Bucket,
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

function makeD1(results: unknown[] = []) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results }),
  };
  const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
  return { db, stmt };
}

function makeEnvWithDb(db: D1Database): Env {
  return {
    ...makeEnv(),
    OMOT_DB: db,
  };
}

describe('handleSearch', () => {
  it('responds 204 with CORS headers for OPTIONS, including Authorization', async () => {
    const req = new Request('https://edge.example.com/search?q=hello', { method: 'OPTIONS' });
    const res = await handleSearch(req, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    // Authorization must be in Allow-Headers so browsers don't block the
    // Bearer-token preflight on cross-origin /search calls.
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/\bAuthorization\b/i);
  });

  it('returns empty results when neither q nor user is provided', async () => {
    const req = new Request('https://edge.example.com/search');
    const res = await handleSearch(req, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toEqual([]);
  });

  it('uses substring matching for tweet text so Chinese fragments can match', async () => {
    const { db, stmt } = makeD1([{
      id: '1',
      username: 'jack',
      snapshot_ts: 123,
      archive_url: 'https://web.archive.org/web/20200101000000/https://twitter.com/jack/status/1',
      text: '这是一个文艺青年写的 tweet',
    }]);

    const req = new Request('https://edge.example.com/search?q=' + encodeURIComponent('文艺') + '&limit=10');
    const res = await handleSearch(req, makeEnvWithDb(db));

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("t.text LIKE ? ESCAPE '\\'"));
    expect(db.prepare).toHaveBeenCalledWith(expect.not.stringContaining('tweets_fts MATCH'));
    expect(stmt.bind).toHaveBeenCalledWith('%文艺%', 11, 0);
    expect(await res.json()).toMatchObject({
      results: [{
        id: '1',
        text_snippet: '这是一个<b>文艺</b>青年写的 tweet',
      }],
      hasMore: false,
      nextOffset: null,
    });
  });

  it('escapes LIKE wildcards from the query', async () => {
    const { db, stmt } = makeD1([]);

    const req = new Request('https://edge.example.com/search?q=' + encodeURIComponent('100%_real'));
    const res = await handleSearch(req, makeEnvWithDb(db));

    expect(res.status).toBe(200);
    expect(stmt.bind).toHaveBeenCalledWith('%100\\%\\_real%', 51, 0);
  });

  it('returns pagination metadata when more rows are available', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: String(index + 1),
      username: 'jack',
      snapshot_ts: 123 - index,
      archive_url: 'url',
      text_snippet: 'hello',
    }));
    const { db, stmt } = makeD1(rows);

    const req = new Request('https://edge.example.com/search?user=jack&limit=2&offset=4');
    const res = await handleSearch(req, makeEnvWithDb(db));

    expect(stmt.bind).toHaveBeenCalledWith('jack', 3, 4);
    expect(await res.json()).toMatchObject({
      results: rows.slice(0, 2),
      hasMore: true,
      nextOffset: 6,
    });
  });
});
