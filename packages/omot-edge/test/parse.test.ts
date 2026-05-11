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

  // Regression: archive.org sometimes returns the v2 API JSON directly with
  // its media/profile URLs rewritten to /web/<ts>/<orig> (no `im_`). Hitting
  // such a URL returns the Wayback HTML viewer instead of image bytes, so
  // <img> tags break. The parser must re-wrap these into `im_` mode and
  // convert media file extensions into the ?format=&name=orig query that
  // archive.org actually has captures for.
  it('rewrites archive-prefixed media URLs to im_ mode', async () => {
    const archiveUrl =
      'https://web.archive.org/web/20240625135446/https://twitter.com/xiaoyuanzi_life/status/1805600526366917042';
    const payload = JSON.stringify({
      data: {
        id: '1805600526366917042',
        text: 'hello',
        created_at: '2024-06-25T13:54:46.000Z',
        author_id: '1732817929820119040',
        attachments: { media_keys: ['3_1805600518120914944'] },
      },
      includes: {
        users: [{
          id: '1732817929820119040',
          name: 'xiaoyuanzi',
          username: 'xiaoyuanzi_life',
          profile_image_url:
            'https://web.archive.org/web/20240625135446/https://pbs.twimg.com/profile_images/1803439375461785600/L3AdbaXp_normal.jpg',
        }],
        media: [{
          media_key: '3_1805600518120914944',
          type: 'photo',
          url: 'https://web.archive.org/web/20240625135446/https://pbs.twimg.com/media/GQ7IGtDbwAANAQS.jpg',
        }],
      },
    });
    const post = await parsePostFromUrl(payload, archiveUrl);
    expect(post?.images).toEqual([
      'https://web.archive.org/web/20240625135446im_/https://pbs.twimg.com/media/GQ7IGtDbwAANAQS?format=jpg&name=orig',
    ]);
    expect(post?.user.avatar).toBe(
      'https://web.archive.org/web/20240625135446im_/https://pbs.twimg.com/profile_images/1803439375461785600/L3AdbaXp_normal.jpg',
    );
  });

  it('wraps bare twimg URLs in the snapshot im_ mode', async () => {
    const archiveUrl =
      'https://web.archive.org/web/20240625135446/https://twitter.com/foo/status/123';
    const payload = JSON.stringify({
      data: {
        id: '123',
        text: 'hello',
        created_at: '2024-06-25T13:54:46.000Z',
        author_id: '999',
        attachments: { media_keys: ['m1'] },
      },
      includes: {
        users: [{
          id: '999',
          name: 'Foo',
          username: 'foo',
          profile_image_url: 'https://pbs.twimg.com/profile_images/1/avatar.jpg',
        }],
        media: [{
          media_key: 'm1',
          type: 'photo',
          url: 'https://pbs.twimg.com/media/ABC.jpg',
        }],
      },
    });
    const post = await parsePostFromUrl(payload, archiveUrl);
    expect(post?.images).toEqual([
      'https://web.archive.org/web/20240625135446im_/https://pbs.twimg.com/media/ABC?format=jpg&name=orig',
    ]);
    expect(post?.user.avatar).toBe(
      'https://web.archive.org/web/20240625135446im_/https://pbs.twimg.com/profile_images/1/avatar.jpg',
    );
  });

  it('rewrites video preview thumbnails into im_ mode', async () => {
    const archiveUrl =
      'https://web.archive.org/web/20240101000000/https://twitter.com/foo/status/42';
    const payload = JSON.stringify({
      data: {
        id: '42',
        text: 'vid',
        created_at: '2024-01-01T00:00:00.000Z',
        author_id: '1',
        attachments: { media_keys: ['v1'] },
      },
      includes: {
        users: [{ id: '1', name: 'Foo', username: 'foo' }],
        media: [{
          media_key: 'v1',
          type: 'video',
          preview_image_url: 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/THUMB.jpg',
        }],
      },
    });
    const post = await parsePostFromUrl(payload, archiveUrl);
    expect(post?.videoInfo?.thumbUrl).toBe(
      'https://web.archive.org/web/20240101000000im_/https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/THUMB?format=jpg&name=orig',
    );
  });

  // Pre-2023 v1 API snapshots archived media under bare `.jpg` filenames,
  // not under ?format=&name=orig. Confirmed empirically with capture
  // 20211231131141 of FH8DMfsVgAMxcnx — only the .jpg form 200s. The v1
  // path must preserve the filename form and only add im_ mode.
  it('preserves .jpg form for legacy v1 API payloads (parsePost2)', async () => {
    const archiveUrl =
      'https://web.archive.org/web/20211231131141if_/https://twitter.com/jiaotanghso/status/1';
    const payload = JSON.stringify({
      created_at: 'Fri Dec 31 13:11:41 +0000 2021',
      id: 1,
      id_str: '1',
      text: 'old tweet',
      user: {
        id_str: '12345',
        name: 'JT',
        screen_name: 'jiaotanghso',
        profile_image_url_https: 'https://pbs.twimg.com/profile_images/example.jpg',
      },
      entities: {
        media: [{ media_url_https: 'https://pbs.twimg.com/media/FH8DMfsVgAMxcnx.jpg' }],
      },
    });
    const post = await parsePostFromUrl(payload, archiveUrl);
    expect(post?.images).toEqual([
      'https://web.archive.org/web/20211231131141im_/https://pbs.twimg.com/media/FH8DMfsVgAMxcnx.jpg',
    ]);
    expect(post?.user.avatar).toBe(
      'https://web.archive.org/web/20211231131141im_/https://pbs.twimg.com/profile_images/example.jpg',
    );
  });

  // archive.org sometimes hands us URLs already in ?format=jpg&name=large
  // form (size variant other than orig). Don't rewrite — that would clobber
  // the variant name to `orig` and request a different capture.
  it('preserves ?format=&name= query form when already present', async () => {
    const archiveUrl =
      'https://web.archive.org/web/20240101000000/https://twitter.com/foo/status/42';
    const payload = JSON.stringify({
      data: {
        id: '42',
        text: 'hi',
        created_at: '2024-01-01T00:00:00.000Z',
        author_id: '1',
        attachments: { media_keys: ['m1'] },
      },
      includes: {
        users: [{ id: '1', name: 'Foo', username: 'foo' }],
        media: [{
          media_key: 'm1',
          type: 'photo',
          url: 'https://pbs.twimg.com/media/ABC?format=jpg&name=large',
        }],
      },
    });
    const post = await parsePostFromUrl(payload, archiveUrl);
    expect(post?.images).toEqual([
      'https://web.archive.org/web/20240101000000im_/https://pbs.twimg.com/media/ABC?format=jpg&name=large',
    ]);
  });
});
