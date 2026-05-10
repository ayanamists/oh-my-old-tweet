import { afterEach, describe, expect, it, vi } from 'vitest';
import { Interval } from 'luxon';
import { getCdxList } from '../../src/Data';
import { defaultConfig } from '../../src/corsUrl';

afterEach(() => vi.restoreAllMocks());

const interval = Interval.fromDateTimes(
  new Date('2006-03-21T00:00:00Z'),
  new Date('2026-05-05T00:00:00Z'),
);

const cdxBody = JSON.stringify([
  ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
  ['com,twitter)/jack/status/20', '20060321205014', 'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA', '1234'],
]);

const configWithEdge    = { ...defaultConfig, edgeUrl: 'https://omot-edge.example.com' };
const configWithEdgeKey = { ...configWithEdge, apiKey: 'mysecret' };
const configNoEdge      = { ...defaultConfig, edgeUrl: undefined };

// Each test uses a unique username so the module-level CDX cache in
// Data.ts doesn't bleed state between cases.
let userIdx = 0;
const nextUser = () => `cdxtest${++userIdx}`;

describe('getCdxList — edge /cdx routing', () => {
  it('uses the edge endpoint when configured and returns parsed CdxItems', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(cdxBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const user = nextUser();
    const items = await getCdxList(configWithEdge, user, interval);

    expect(items.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://omot-edge.example.com/cdx?user=${user}`);
  });

  it('sends Authorization header when apiKey is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(cdxBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getCdxList(configWithEdgeKey, nextUser(), interval);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer mysecret');
  });

  it('falls back to the legacy CORS proxy when edge returns non-2xx', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 })) // edge fails
      .mockResolvedValueOnce(new Response(cdxBody, { status: 200 })); // legacy succeeds
    vi.stubGlobal('fetch', fetchMock);

    const user = nextUser();
    const items = await getCdxList(configWithEdge, user, interval);

    expect(items.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackUrl = fetchMock.mock.calls[1][0] as string;
    expect(fallbackUrl).toContain('cors-proxy');
    expect(fallbackUrl).toContain('cdx%2Fsearch%2Fcdx');
  });

  it('falls back to the legacy CORS proxy when edge throws', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network error')) // edge throws
      .mockResolvedValueOnce(new Response(cdxBody, { status: 200 })); // legacy succeeds
    vi.stubGlobal('fetch', fetchMock);

    const items = await getCdxList(configWithEdge, nextUser(), interval);
    expect(items.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the edge call entirely when edgeUrl is not configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(cdxBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getCdxList(configNoEdge, nextUser(), interval);

    const calledUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calledUrls.every((u) => !u.includes('/cdx?user='))).toBe(true);
  });

  // The edge worker now requests `fl=timestamp,original,mimetype,statuscode,digest`
  // from archive.org (drops the slow `length` column), so its responses no
  // longer carry urlkey/length. The frontend must consume that schema too.
  it('parses fl-trimmed CDX responses returned by the edge worker', async () => {
    const trimmedBody = JSON.stringify([
      ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
      ['20060321205014', 'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA'],
      ['20070101000000', 'https://twitter.com/jack/status/21', 'text/html', '200', 'BBBB'],
    ]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(trimmedBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await getCdxList(configWithEdge, nextUser(), interval);

    expect(items.map((i) => i.id).sort()).toEqual(['20', '21']);
    // urlKey / length are absent in the trimmed schema; parseCdxRows must
    // not invent values for them by reading the wrong column.
    expect(items[0].urlKey).toBeUndefined();
    expect(items[0].length).toBeUndefined();
    expect(items[0].original).toBe('https://twitter.com/jack/status/20');
    expect(items[0].mimetype).toBe('text/html');
  });
});
