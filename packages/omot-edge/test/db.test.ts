import { describe, it, expect, vi } from 'vitest';
import { upsertTweet, logAccess, topUsernames } from '../src/db';
import type { Env } from '../src/types';
import type { Post } from 'twitter-data-parser';

function makeStmt(rows: unknown[] = []) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({}),
    all: vi.fn().mockResolvedValue({ results: rows }),
  };
  return stmt;
}

function makeD1WithStmt(rows: unknown[] = []) {
  const stmt = makeStmt(rows);
  const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
  return { db, stmt };
}

function makeD1(rows: unknown[] = []): D1Database {
  return makeD1WithStmt(rows).db;
}

function makeEnv(db?: D1Database): Env {
  return {
    OMOT_CACHE: null as unknown as R2Bucket,
    OMOT_DB: db ?? null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

const fakePost: Post = {
  id: '1',
  text: 'hello',
  date: new Date('2020-01-01T00:00:00Z'),
  user: { userName: 'jack', fullName: 'Jack', id: '12' },
  images: [],
} as unknown as Post;

describe('upsertTweet', () => {
  it('calls D1 prepare with INSERT OR REPLACE', async () => {
    const db = makeD1();
    await upsertTweet(makeEnv(db), 'https://web.archive.org/web/20200101/...', fakePost);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO tweets'));
  });

  it('indexes by archive snapshot timestamp and user id', async () => {
    const archiveUrl = 'https://web.archive.org/web/20220111094401/https://twitter.com/jack/status/1';
    const { db, stmt } = makeD1WithStmt();

    await upsertTweet(makeEnv(db), archiveUrl, fakePost);

    expect(stmt.bind).toHaveBeenCalledWith(
      '1',
      'jack',
      '12',
      Math.floor(Date.UTC(2022, 0, 11, 9, 44, 1) / 1000),
      archiveUrl,
      'hello',
      0,
      1,
    );
  });

  it('falls back to post date when the archive URL has no timestamp', async () => {
    const { db, stmt } = makeD1WithStmt();

    await upsertTweet(makeEnv(db), 'https://example.com/not-an-archive', fakePost);

    expect(stmt.bind).toHaveBeenCalledWith(
      '1',
      'jack',
      '12',
      Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000),
      'https://example.com/not-an-archive',
      'hello',
      0,
      1,
    );
  });

  it('can index with an explicit parser version', async () => {
    const archiveUrl = 'https://web.archive.org/web/20220111094401/https://twitter.com/jack/status/1';
    const { db, stmt } = makeD1WithStmt();

    await upsertTweet(makeEnv(db), archiveUrl, fakePost, '3');

    expect(stmt.bind).toHaveBeenCalledWith(
      '1',
      'jack',
      '12',
      Math.floor(Date.UTC(2022, 0, 11, 9, 44, 1) / 1000),
      archiveUrl,
      'hello',
      0,
      3,
    );
  });

  it('is a no-op when OMOT_DB is not configured', async () => {
    // Should not throw
    await expect(upsertTweet(makeEnv(), 'url', fakePost)).resolves.toBeUndefined();
  });
});

describe('logAccess', () => {
  it('calls D1 prepare with INSERT INTO access_log ... ON CONFLICT', async () => {
    const db = makeD1();
    await logAccess(makeEnv(db), 'jack');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO access_log'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'));
  });

  it('lowercases the username before writing', async () => {
    const db = makeD1();
    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0]?.value ?? makeStmt();
    await logAccess(makeEnv(db), 'JACK');
    const call = (db.prepare as ReturnType<typeof vi.fn>).mock.results;
    // bind arg should be lowercase
    const bindArg = call[0]?.value.bind.mock.calls[0]?.[0];
    expect(bindArg).toBe('jack');
  });
});

describe('topUsernames', () => {
  it('returns usernames ordered by hits', async () => {
    const db = makeD1([{ username: 'trump' }, { username: 'jack' }]);
    const result = await topUsernames(makeEnv(db), 10);
    expect(result).toEqual(['trump', 'jack']);
  });

  it('returns empty array when OMOT_DB is not configured', async () => {
    const result = await topUsernames(makeEnv(), 10);
    expect(result).toEqual([]);
  });
});
