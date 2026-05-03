import { describe, it, expect } from 'vitest';
import { parseUserName } from '../../src/InputParser';

describe('parseUserName', () => {
  it('returns the username unchanged for a bare handle', () => {
    expect(parseUserName('jack')).toBe('jack');
  });

  it('strips a leading @ symbol', () => {
    expect(parseUserName('@jack')).toBe('jack');
  });

  it('extracts the handle from a twitter.com URL', () => {
    expect(parseUserName('https://twitter.com/jack')).toBe('jack');
  });

  it('extracts the handle from an x.com URL with a status path', () => {
    expect(parseUserName('https://x.com/jack/status/12345')).toBe('jack');
  });

  it('trims surrounding whitespace', () => {
    expect(parseUserName('   jack   ')).toBe('jack');
  });
});
