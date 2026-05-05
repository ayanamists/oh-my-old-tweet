import { describe, expect, it, vi, afterEach } from 'vitest';
import { Interval, DateTime } from 'luxon';
import { getCdxList } from '../../src/Data';
import { defaultConfig } from '../../src/corsUrl';

describe('CDX request includes collapse=digest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends collapse=digest in the CDX query string', async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      capturedUrls.push(url);
      // Return minimal valid CDX response: one header row, no data rows.
      return Promise.resolve(new Response(JSON.stringify([['urlkey','timestamp','original','mimetype','statuscode','digest','length']]), { status: 200 }));
    });

    const interval = Interval.fromDateTimes(
      DateTime.fromISO('2020-01-01'),
      DateTime.fromISO('2020-01-02'),
    );
    // Edge path bypasses this URL composition; assert legacy proxy behaviour
    // explicitly by disabling edgeUrl. The edge worker's own test pins the
    // collapse=digest contract on the archive.org subrequest it makes.
    await getCdxList({ ...defaultConfig, edgeUrl: undefined }, 'testuser', interval);

    expect(capturedUrls.length).toBeGreaterThan(0);
    const proxied = capturedUrls[0];
    // The proxied URL wraps the CDX URL; decode it and check collapse=digest is present.
    const inner = decodeURIComponent(proxied.split('?target=')[1] ?? proxied);
    expect(inner).toContain('collapse=digest');
  });
});
