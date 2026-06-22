import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleScheduled } from '../src/handlers/prewarm';
import type { Env } from '../src/types';

afterEach(() => vi.restoreAllMocks());

const JSON_ARCHIVE_URL =
  'https://web.archive.org/web/20220911181541if_/https://twitter.com/jk48jb/status/1569026912315478016';

const JSON_PAYLOAD = JSON.stringify({
  created_at: 'Sun Sep 11 18:15:41 +0000 2022',
  id: 1569026912315478016,
  id_str: '1569026912315478016',
  text: 'legacy json tweet',
  user: {
    id_str: '12345',
    name: 'JK',
    screen_name: 'jk48jb',
    profile_image_url_https: 'https://pbs.twimg.com/profile_images/example.jpg',
  },
  entities: {},
});

function makeR2(): R2Bucket {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => ({} as R2Object)),
  } as unknown as R2Bucket;
}

function makeD1() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [{ username: 'jk48jb' }] }),
    run: vi.fn().mockResolvedValue({}),
  };
  const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
  return { db, stmt };
}

function makeEnv(db: D1Database): Env {
  return {
    OMOT_CACHE: makeR2(),
    OMOT_DB: db,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

describe('handleScheduled', () => {
  it('uses if_ archive mode for JSON CDX snapshots before indexing search', async () => {
    const cdxRows = [
      ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
      [
        '20220911181541',
        'https://twitter.com/jk48jb/status/1569026912315478016',
        'application/json',
        '200',
        'digest-json',
      ],
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(cdxRows), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON_PAYLOAD, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, stmt } = makeD1();

    await handleScheduled(makeEnv(db));

    expect(fetchMock.mock.calls[1][0]).toBe(JSON_ARCHIVE_URL);
    expect(stmt.bind).toHaveBeenCalledWith(
      '1569026912315478016',
      'jk48jb',
      '12345',
      Math.floor(Date.UTC(2022, 8, 11, 18, 15, 41) / 1000),
      JSON_ARCHIVE_URL,
      'legacy json tweet',
      0,
      1,
    );
  });
});
