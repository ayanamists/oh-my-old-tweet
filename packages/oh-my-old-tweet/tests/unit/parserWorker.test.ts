import { describe, expect, it } from 'vitest';
import { parsePost } from 'twitter-data-parser';

// The worker file and parserClient use browser APIs (Worker, import.meta.url)
// that aren't available in jsdom. We test the underlying parser logic directly
// here — that's what the worker calls. The actual Worker dispatch path is
// covered by the E2E test (tests/e2e/timeline.spec.ts).

const MINIMAL_JSON = JSON.stringify({
  data: {
    id: '523389174242488320',
    text: 'hello world',
    created_at: '2014-10-18T08:30:00.000Z',
    author_id: 'u1',
  },
  includes: {
    users: [{ id: 'u1', name: 'Jack', username: 'jack' }],
    media: [],
  },
});

describe('parsePost (worker payload handler logic)', () => {
  it('parses a minimal JSON snapshot without throwing', () => {
    const result = parsePost(MINIMAL_JSON, {
      id: '523389174242488320',
      timestamp: '20141018083000',
      userName: 'jack',
    });
    expect(result).toBeDefined();
    expect(result?.id).toBe('523389174242488320');
    expect(result?.text).toBe('hello world');
  });

  it('returns undefined for a completely unparseable payload', () => {
    const result = parsePost('<html><body>not a tweet</body></html>', {
      id: '999',
      timestamp: '20200101000000',
      userName: 'nobody',
    });
    expect(result).toBeUndefined();
  });
});
