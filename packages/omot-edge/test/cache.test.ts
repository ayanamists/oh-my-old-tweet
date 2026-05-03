import { describe, it, expect } from 'vitest';
import { cacheKey } from '../src/cache';

// Pure-logic tests for the cache key function — no Workers runtime needed.
describe('cacheKey', () => {
  it('includes the parser version prefix', () => {
    const key = cacheKey('https://web.archive.org/web/20200101/https://twitter.com/jack/status/1', '1');
    expect(key).toMatch(/^snapshot\/v1\//);
  });

  it('produces different keys for different parser versions', () => {
    const url = 'https://web.archive.org/web/20200101/https://twitter.com/jack/status/1';
    expect(cacheKey(url, '1')).not.toBe(cacheKey(url, '2'));
  });

  it('produces the same key for the same url and version', () => {
    const url = 'https://web.archive.org/web/20200101/https://twitter.com/jack/status/1';
    expect(cacheKey(url, '1')).toBe(cacheKey(url, '1'));
  });

  it('sanitises special characters in the URL', () => {
    const key = cacheKey('https://web.archive.org/web/20200101/https://twitter.com/jack?foo=bar&baz=1', '1');
    expect(key).not.toContain('?');
    expect(key).not.toContain('&');
    expect(key).not.toContain('=');
    expect(key).toMatch(/^[a-zA-Z0-9._\-/]+\.json$/);
  });
});
