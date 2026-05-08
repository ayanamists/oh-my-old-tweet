import { afterEach, describe, it, expect } from 'vitest';
import { getDefaultConfig, getUrl, defaultConfig } from '../../src/corsUrl';

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
});
