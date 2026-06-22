import { afterEach, describe, it, expect } from 'vitest';
import { buildMediaCacheUrl, getDefaultConfig, getUrl, defaultConfig } from '../../src/corsUrl';

afterEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('getUrl', () => {
  const target = 'https://web.archive.org/cdx/search/cdx?url=twitter.com/jack/status';

  it('returns the bare target when mode is 2 (no proxy)', () => {
    expect(getUrl({ ...defaultConfig, mode: 2 }, target)).toBe(target);
  });

  it('appends a URL-encoded target to a prefix ending with =', () => {
    const cfg = { mode: 1, prefix: 'https://proxy.example.com/?target=', urlEncoding: true };
    expect(getUrl(cfg, target)).toBe('https://proxy.example.com/?target=' + encodeURIComponent(target));
  });

  it('appends a raw target to a prefix ending with /', () => {
    const cfg = { mode: 1, prefix: 'https://proxy.example.com/', urlEncoding: false };
    expect(getUrl(cfg, target)).toBe('https://proxy.example.com/' + target);
  });

  it('inserts a / between prefix and target when prefix has neither', () => {
    const cfg = { mode: 1, prefix: 'https://proxy.example.com', urlEncoding: false };
    expect(getUrl(cfg, target)).toBe('https://proxy.example.com/' + target);
  });
});

describe('getDefaultConfig', () => {
  it('does not ship a default API key in source config', () => {
    expect(defaultConfig.apiKey).toBeUndefined();
    expect(getDefaultConfig().apiKey).toBeUndefined();
  });

  it('uses apikey from the URL query at runtime', () => {
    window.history.replaceState({}, '', '/?apikey=urlsecret');
    expect(getDefaultConfig().apiKey).toBe('urlsecret');
  });

  it('uses apikey from the hash query at runtime', () => {
    window.history.replaceState({}, '', '/#/jack?apikey=hashsecret');
    expect(getDefaultConfig().apiKey).toBe('hashsecret');
  });

  it('keeps an API key saved through settings', () => {
    localStorage.setItem('omot-cors-config', JSON.stringify({ ...defaultConfig, apiKey: 'savedsecret' }));
    expect(getDefaultConfig().apiKey).toBe('savedsecret');
  });

  it('uses media cache config from the URL query at runtime', () => {
    window.history.replaceState({}, '', '/?media=https%3A%2F%2Fmedia.example.com&mediakey=secret');
    expect(getDefaultConfig().mediaCacheUrl).toBe('https://media.example.com');
    expect(getDefaultConfig().mediaCacheKey).toBe('secret');
  });
});

describe('buildMediaCacheUrl', () => {
  it('returns the original URL when media cache is not configured', () => {
    const target = 'https://web.archive.org/web/1im_/https://pbs.twimg.com/media/a.jpg';
    expect(buildMediaCacheUrl(defaultConfig, target)).toBe(target);
  });

  it('builds a keyed media-cache URL', () => {
    const target = 'https://web.archive.org/web/1im_/https://pbs.twimg.com/media/a.jpg';
    const url = new URL(buildMediaCacheUrl({
      ...defaultConfig,
      mediaCacheUrl: 'https://media.example.com/',
      mediaCacheKey: 'secret',
    }, target));

    expect(url.origin + url.pathname).toBe('https://media.example.com/media');
    expect(url.searchParams.get('url')).toBe(target);
    expect(url.searchParams.get('key')).toBe('secret');
  });
});
