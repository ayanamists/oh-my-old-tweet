import { describe, it, expect } from 'vitest';
import { parsePostFromUrl } from '../src/parse';

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

describe('parsePostFromUrl', () => {
  it('parses a JSON snapshot payload', async () => {
    const post = await parsePostFromUrl(JSON_PAYLOAD, ARCHIVE_URL);
    expect(post).toBeDefined();
    expect(post?.id).toBe('523389174242488320');
    expect(post?.text).toBe('just setting up my twttr');
    expect(post?.user.userName).toBe('jack');
  });

  it('returns undefined for an unrecognised archive URL shape', async () => {
    const post = await parsePostFromUrl(JSON_PAYLOAD, 'https://example.com/not-an-archive');
    expect(post).toBeUndefined();
  });

  it('returns undefined for an unparseable HTML payload', async () => {
    const post = await parsePostFromUrl('<html><body>nothing</body></html>', ARCHIVE_URL);
    expect(post).toBeUndefined();
  });
});
