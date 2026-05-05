import { describe, it, expect } from 'vitest';
import { handleSearch } from '../src/handlers/search';
import type { Env } from '../src/types';

function makeEnv(): Env {
  return {
    OMOT_CACHE: null as unknown as R2Bucket,
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
  };
}

describe('handleSearch', () => {
  it('responds 204 with CORS headers for OPTIONS, including Authorization', async () => {
    const req = new Request('https://edge.example.com/search?q=hello', { method: 'OPTIONS' });
    const res = await handleSearch(req, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    // Authorization must be in Allow-Headers so browsers don't block the
    // Bearer-token preflight on cross-origin /search calls.
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/\bAuthorization\b/i);
  });

  it('returns empty results when neither q nor user is provided', async () => {
    const req = new Request('https://edge.example.com/search');
    const res = await handleSearch(req, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toEqual([]);
  });
});
