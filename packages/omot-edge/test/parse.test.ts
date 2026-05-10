import { describe, it, expect } from 'vitest';
import { parsePostFromUrl } from '../src/parse';

const ARCHIVE_URL =
  'https://web.archive.org/web/20141018083000/https://twitter.com/jack/status/523389174242488320';

const ARCHIVE_IF_URL =
  'https://web.archive.org/web/20220911181541if_/https://twitter.com/jk48jb/status/1569026912315478016';

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

const LEGACY_JSON_PAYLOAD = JSON.stringify({
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

describe('parsePostFromUrl', () => {
  it('parses a JSON snapshot payload', async () => {
    const post = await parsePostFromUrl(JSON_PAYLOAD, ARCHIVE_URL);
    expect(post).toBeDefined();
    expect(post?.id).toBe('523389174242488320');
    expect(post?.text).toBe('just setting up my twttr');
    expect(post?.user.userName).toBe('jack');
  });

  it('parses an if_ JSON snapshot URL', async () => {
    const post = await parsePostFromUrl(LEGACY_JSON_PAYLOAD, ARCHIVE_IF_URL);
    expect(post).toBeDefined();
    expect(post?.id).toBe('1569026912315478016');
    expect(post?.text).toBe('legacy json tweet');
    expect(post?.user.userName).toBe('jk48jb');
  });

  it('parses an if_ archive.org HTML wrapper with legacy JSON in jsonview', async () => {
    const html = `<!doctype html>
<html><body>
  <div class="tweet-container"></div>
  <div id="jsonview"><pre>${LEGACY_JSON_PAYLOAD}</pre></div>
</body></html>`;
    const post = await parsePostFromUrl(html, ARCHIVE_IF_URL);
    expect(post).toBeDefined();
    expect(post?.id).toBe('1569026912315478016');
    expect(post?.text).toBe('legacy json tweet');
    expect(post?.user.userName).toBe('jk48jb');
  });

  it('returns undefined for an unrecognised archive URL shape', async () => {
    const post = await parsePostFromUrl(JSON_PAYLOAD, 'https://example.com/not-an-archive');
    expect(post).toBeUndefined();
  });

  it('returns undefined for an unparseable HTML payload', async () => {
    const post = await parsePostFromUrl('<html><body>nothing</body></html>', ARCHIVE_URL);
    expect(post).toBeUndefined();
  });

  // Forces the JSON.parse branch in parsePost to fail and exercises the full
  // HTML → parseDOM → extractFromNewArchiveFormat path through the linkedom
  // backend wired up in src/parse.ts. Without that wiring the Worker raises
  // "jsdom.VirtualConsole is not a constructor" in production.
  it('parses an archive.org HTML payload via the linkedom DOM backend', async () => {
    const html = `<!doctype html>
<html><body>
  <div class="tweet-container"></div>
  <div id="jsonview"><pre>${JSON_PAYLOAD}</pre></div>
</body></html>`;
    const post = await parsePostFromUrl(html, ARCHIVE_URL);
    expect(post).toBeDefined();
    expect(post?.id).toBe('523389174242488320');
    expect(post?.text).toBe('just setting up my twttr');
    expect(post?.user.userName).toBe('jack');
  });
});
