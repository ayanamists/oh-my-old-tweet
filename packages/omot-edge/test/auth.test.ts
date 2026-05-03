import { describe, it, expect } from 'vitest';
import { checkApiKey } from '../src/auth';
import type { Env } from '../src/types';

function makeEnv(key?: string): Env {
  return {
    OMOT_CACHE: null as unknown as R2Bucket,
    OMOT_DB: null as unknown as D1Database,
    PARSER_VERSION: '1',
    ARCHIVE_BASE: 'https://web.archive.org',
    OMOT_API_KEY: key,
  };
}

function req(authHeader?: string): Request {
  const headers = authHeader ? { Authorization: authHeader } : {};
  return new Request('https://edge.example.com/snapshot', { headers });
}

describe('checkApiKey', () => {
  it('allows all requests when OMOT_API_KEY is not set', () => {
    expect(checkApiKey(req(), makeEnv())).toBeNull();
    expect(checkApiKey(req('Bearer wrong'), makeEnv())).toBeNull();
  });

  it('returns 401 when key is set but Authorization header is absent', () => {
    const res = checkApiKey(req(), makeEnv('secret'));
    expect(res?.status).toBe(401);
  });

  it('returns 401 when key is set but token is wrong', () => {
    const res = checkApiKey(req('Bearer notthesecret'), makeEnv('secret'));
    expect(res?.status).toBe(401);
  });

  it('returns null when key matches', () => {
    expect(checkApiKey(req('Bearer secret'), makeEnv('secret'))).toBeNull();
  });

  it('includes CORS header on 401 so browsers get the error instead of a network opaque response', () => {
    const res = checkApiKey(req(), makeEnv('secret'))!;
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
