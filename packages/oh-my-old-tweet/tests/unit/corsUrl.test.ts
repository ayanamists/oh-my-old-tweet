import { describe, it, expect } from 'vitest';
import { getUrl, defaultConfig } from '../../src/corsUrl';

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
