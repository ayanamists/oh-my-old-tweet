import type { Env } from '../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const user = url.searchParams.get('user') ?? '';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);

  if (!q && !user) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // D1 binding may not be configured yet (Step 3). Fail gracefully.
  if (!env.OMOT_DB) {
    return new Response(JSON.stringify({ error: 'Search not configured' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (q) {
      conditions.push('tweets_fts MATCH ?');
      params.push(q);
    }
    if (user) {
      conditions.push('t.username = ?');
      params.push(user.toLowerCase());
    }
    if (from) {
      conditions.push('t.snapshot_ts >= ?');
      params.push(Number(from));
    }
    if (to) {
      conditions.push('t.snapshot_ts <= ?');
      params.push(Number(to));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = q
      ? `SELECT t.id, t.username, t.snapshot_ts, t.archive_url, snippet(tweets_fts, 0, '<b>', '</b>', '...', 20) AS text_snippet
         FROM tweets t JOIN tweets_fts ON tweets_fts.rowid = t.rowid
         ${where} ORDER BY t.snapshot_ts DESC LIMIT ?`
      : `SELECT t.id, t.username, t.snapshot_ts, t.archive_url, substr(t.text, 1, 200) AS text_snippet
         FROM tweets t
         ${where} ORDER BY t.snapshot_ts DESC LIMIT ?`;

    params.push(limit);

    const { results } = await env.OMOT_DB.prepare(sql).bind(...params).all();
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
