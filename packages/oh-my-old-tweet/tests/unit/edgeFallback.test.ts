import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOnePage } from '../../src/Data';
import { defaultConfig } from '../../src/corsUrl';
import type { MinimalCdxInfo } from '../../src/Data';

afterEach(() => vi.restoreAllMocks());

const cdxItem: MinimalCdxInfo = {
  id: '523389174242488320',
  timestamp: '20141018083000',
  origUrl: 'https://twitter.com/jack/status/523389174242488320',
  mimetype: 'text/html',
};

const fakePost = {
  id: '523389174242488320',
  text: 'from edge cache',
  date: '2014-10-18T08:30:00.000Z',
  user: { userName: 'jack', fullName: 'Jack' },
};

const configWithEdge    = { ...defaultConfig, edgeUrl: 'https://omot-edge.example.com', apiKey: undefined };
const configWithEdgeKey = { ...configWithEdge, apiKey: 'mysecret' };
const configNoEdge      = { ...defaultConfig, edgeUrl: undefined };

describe('getOnePage — edge Worker routing', () => {
  it('uses edge Worker response when it returns 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ post: fakePost }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getOnePage(configWithEdge, cdxItem);

    expect(result?.text).toBe('from edge cache');
    expect(result?.date).toBeInstanceOf(Date);
    // Only the Worker was called — no second fetch to archive.org
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/snapshot?url=');
  });

  it('falls through to archive.org when edge Worker returns 5xx', async () => {
    const archiveHtml = JSON.stringify({
      data: { id: '523389174242488320', text: 'from archive', created_at: '2014-10-18T08:30:00.000Z', author_id: 'u1' },
      includes: { users: [{ id: 'u1', name: 'Jack', username: 'jack' }], media: [] },
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('error', { status: 502 }))          // Worker fails
      .mockResolvedValueOnce(new Response(archiveHtml, { status: 200 }));     // archive.org succeeds

    vi.stubGlobal('fetch', fetchMock);

    const result = await getOnePage(configWithEdge, cdxItem);

    expect(result?.text).toBe('from archive');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls through to archive.org when edge Worker throws (network error)', async () => {
    const archiveHtml = JSON.stringify({
      data: { id: '523389174242488320', text: 'from archive', created_at: '2014-10-18T08:30:00.000Z', author_id: 'u1' },
      includes: { users: [{ id: 'u1', name: 'Jack', username: 'jack' }], media: [] },
    });

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(new Response(archiveHtml, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await getOnePage(configWithEdge, cdxItem);
    expect(result?.text).toBe('from archive');
  });

  it('skips edge Worker entirely when edgeUrl is not configured', async () => {
    const archiveHtml = JSON.stringify({
      data: { id: '523389174242488320', text: 'direct', created_at: '2014-10-18T08:30:00.000Z', author_id: 'u1' },
      includes: { users: [{ id: 'u1', name: 'Jack', username: 'jack' }], media: [] },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(archiveHtml, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getOnePage(configNoEdge, cdxItem);
    expect(result?.text).toBe('direct');
    // fetch was only called for archive.org, not for the Worker
    const calledUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calledUrls.every((u: string) => !u.includes('/snapshot'))).toBe(true);
  });

  it('sends Authorization header when apiKey is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ post: fakePost }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getOnePage(configWithEdgeKey, cdxItem);

    const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer mysecret');
  });

  it('sends no Authorization header when apiKey is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ post: fakePost }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getOnePage(configWithEdge, cdxItem);

    const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('returns undefined for a cdxItem without a status segment in origUrl', async () => {
    const badItem: MinimalCdxInfo = { ...cdxItem, origUrl: 'https://twitter.com/jack' };
    const result = await getOnePage(configWithEdge, badItem);
    expect(result).toBeUndefined();
  });
});
