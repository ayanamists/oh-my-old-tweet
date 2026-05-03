import { describe, expect, it, vi } from 'vitest';
import { buildProxiedUrls, fetchWithFallbacks, type CorsProxyConfig } from '../../src/corsUrl';

const base: CorsProxyConfig = {
  mode: 1,
  prefix: 'https://proxy-a.example.com/?target=',
  urlEncoding: true,
};

const target = 'https://web.archive.org/cdx?url=twitter.com/jack';

describe('buildProxiedUrls', () => {
  it('returns just the target when mode is 2 (no proxy)', () => {
    expect(buildProxiedUrls({ ...base, mode: 2 }, target)).toEqual([target]);
  });

  it('returns one URL when no fallbacks are configured', () => {
    const urls = buildProxiedUrls(base, target);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('https://proxy-a.example.com/?target=' + encodeURIComponent(target));
  });

  it('returns primary + fallback URLs in order', () => {
    const cfg: CorsProxyConfig = {
      ...base,
      fallbacks: ['https://proxy-b.example.com/?target=', 'https://proxy-c.example.com/?target='],
    };
    const urls = buildProxiedUrls(cfg, target);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('proxy-a');
    expect(urls[1]).toContain('proxy-b');
    expect(urls[2]).toContain('proxy-c');
  });

  it('does not double-encode when urlEncoding is false', () => {
    const cfg = { ...base, urlEncoding: false };
    const urls = buildProxiedUrls(cfg, target);
    expect(urls[0]).toBe('https://proxy-a.example.com/?target=' + target);
  });
});

describe('fetchWithFallbacks', () => {
  function okFetch(url: string): Promise<Response> {
    return Promise.resolve(new Response('ok', { status: 200 }));
  }

  function failFetch(url: string): Promise<Response> {
    return Promise.resolve(new Response('bad', { status: 502 }));
  }

  function throwFetch(url: string): Promise<Response> {
    return Promise.reject(new Error('network error'));
  }

  it('returns the first successful response', async () => {
    const res = await fetchWithFallbacks(['https://proxy-a.example.com/?target=foo'], okFetch);
    expect(res.status).toBe(200);
  });

  it('falls through to second proxy when first returns non-ok', async () => {
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(failFetch)
      .mockImplementationOnce(okFetch);
    const res = await fetchWithFallbacks(['https://a/', 'https://b/'], fetchFn);
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('falls through to second proxy when first throws (network error)', async () => {
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(throwFetch)
      .mockImplementationOnce(okFetch);
    const res = await fetchWithFallbacks(['https://a/', 'https://b/'], fetchFn);
    expect(res.status).toBe(200);
  });

  it('throws when all proxies fail', async () => {
    const fetchFn = vi.fn().mockImplementation(failFetch);
    await expect(fetchWithFallbacks(['https://a/', 'https://b/'], fetchFn)).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
