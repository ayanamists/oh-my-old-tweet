import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Post } from 'twitter-data-parser';
import {
  clearCache,
  countCached,
  getCached,
  setCached,
  __resetForTests,
} from '../../src/cache/IdbCache';

function makePost(id: string, text = 'hello'): Post {
  return {
    id,
    text,
    date: new Date('2020-01-02T03:04:05Z'),
    user: { userName: 'jack', fullName: 'Jack' },
  } as unknown as Post;
}

beforeEach(async () => {
  __resetForTests();
  // Clear store between tests; first call also creates the DB.
  await clearCache();
});

describe('IdbCache', () => {
  it('returns miss for an unknown id', async () => {
    const r = await getCached('nope');
    expect(r).toEqual({ kind: 'miss' });
  });

  it('round-trips a Post and revives Date', async () => {
    const post = makePost('snap-1');
    await setCached('snap-1', post);
    const r = await getCached('snap-1');
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') {
      expect(r.post.id).toBe('snap-1');
      expect(r.post.date).toBeInstanceOf(Date);
      expect(r.post.date.toISOString()).toBe('2020-01-02T03:04:05.000Z');
    }
  });

  it('treats a stored null as a negative cache hit', async () => {
    await setCached('snap-bad', null);
    const r = await getCached('snap-bad');
    expect(r).toEqual({ kind: 'negative' });
  });

  it('treats entries past TTL as a miss', async () => {
    await setCached('snap-old', makePost('snap-old'));
    // ttl=0 forces expiry
    const r = await getCached('snap-old', 0);
    expect(r.kind).toBe('miss');
  });

  it('overwrites an entry when set again', async () => {
    await setCached('snap-x', makePost('snap-x', 'first'));
    await setCached('snap-x', makePost('snap-x', 'second'));
    const r = await getCached('snap-x');
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') expect(r.post.text).toBe('second');
    expect(await countCached()).toBe(1);
  });

  it('clearCache empties the store', async () => {
    await setCached('a', makePost('a'));
    await setCached('b', makePost('b'));
    expect(await countCached()).toBe(2);
    await clearCache();
    expect(await countCached()).toBe(0);
  });
});
