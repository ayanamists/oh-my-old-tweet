import { describe, expect, it, vi } from 'vitest';
import { handleMediaUrls } from '../src/handlers/mediaUrls';
import type { Env } from '../src/types';

const SNAPSHOT_KEY = 'snapshot/v4/one.json';
const POST_BODY = JSON.stringify({
  post: {
    id: '1',
    text: 'hello',
    date: '2022-01-01T00:00:00.000Z',
    tweetUrl: 'https://twitter.com/jack/status/1',
    archiveUrl: 'https://web.archive.org/web/20220101000000/https://twitter.com/jack/status/1',
    user: {
      userName: 'Jack',
      avatar: 'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/profile_images/a.jpg',
      profileInfo: {
        image: 'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/profile_banners/a.jpg',
        bigAvatar: 'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/profile_images/a_400x400.jpg',
      },
    },
    images: [
      'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/media/a.jpg',
      'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/media/a.jpg',
    ],
    videoInfo: {
      thumbUrl: 'https://web.archive.org/web/20220101000000im_/https://pbs.twimg.com/media/v.jpg',
    },
  },
});

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

function makeEnv(r2: R2Bucket, apiKey = 'secret'): Env {
  return {
    OMOT_CACHE: r2,
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '4',
    ARCHIVE_BASE: 'https://web.archive.org',
    OMOT_API_KEY: apiKey,
  };
}

function makeRequest(url: string, token = 'secret'): Request {
  return new Request(url, { headers: { Authorization: `Bearer ${token}` } });
}

describe('handleMediaUrls', () => {
  it('requires admin auth', async () => {
    const res = await handleMediaUrls(
      makeRequest('https://edge.example.com/admin/media-urls', 'wrong'),
      makeEnv(makeR2({})),
    );

    expect(res.status).toBe(401);
  });

  it('extracts unique media URLs from cached posts', async () => {
    const res = await handleMediaUrls(
      makeRequest('https://edge.example.com/admin/media-urls?limit=10'),
      makeEnv(makeR2({ [SNAPSHOT_KEY]: POST_BODY }, [SNAPSHOT_KEY])),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      scanned: 1,
      posts: 1,
      done: true,
      urls: [
        { kind: 'image', tweetId: '1', username: 'jack' },
        { kind: 'video_thumb', tweetId: '1', username: 'jack' },
        { kind: 'avatar', tweetId: '1', username: 'jack' },
        { kind: 'profile', tweetId: '1', username: 'jack' },
        { kind: 'profile', tweetId: '1', username: 'jack' },
      ],
    });
  });

  it('can omit avatar/profile URLs', async () => {
    const res = await handleMediaUrls(
      makeRequest('https://edge.example.com/admin/media-urls?avatars=0'),
      makeEnv(makeR2({ [SNAPSHOT_KEY]: POST_BODY }, [SNAPSHOT_KEY])),
    );

    const body = await res.json() as { urls: Array<{ kind: string }> };
    expect(body.urls.map((entry) => entry.kind)).toEqual(['image', 'video_thumb']);
  });
});
