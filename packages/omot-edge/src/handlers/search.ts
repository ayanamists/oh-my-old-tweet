import type { Env } from '../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // Authorization must be in Allow-Headers so browsers don't block the
  // Bearer-token preflight on the cross-origin /search call.
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

function parseBoundedNonNegativeInt(raw: string | null, fallback: number, max: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, max);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeSnippet(text: string, query: string): string {
  if (!query) return escapeHtml(text.slice(0, 200));

  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index === -1) return escapeHtml(text.slice(0, 200));

  const radius = 90;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  const before = text.slice(start, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length, end);

  return `${prefix}${escapeHtml(before)}<b>${escapeHtml(match)}</b>${escapeHtml(after)}${suffix}`;
}

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const user = (url.searchParams.get('user') ?? '').trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseBoundedNonNegativeInt(url.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseBoundedNonNegativeInt(url.searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER);

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
      conditions.push("t.text LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(q)}%`);
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
      ? `SELECT t.id, t.username, t.snapshot_ts, t.archive_url, t.text
         FROM tweets t
         ${where} ORDER BY t.snapshot_ts DESC LIMIT ?`
      : `SELECT t.id, t.username, t.snapshot_ts, t.archive_url, substr(t.text, 1, 200) AS text_snippet
         FROM tweets t
         ${where} ORDER BY t.snapshot_ts DESC LIMIT ?`;

    params.push(limit + 1);
    const pagedSql = `${sql} OFFSET ?`;
    params.push(offset);

    const { results } = await env.OMOT_DB.prepare(pagedSql).bind(...params).all();
    const hasMore = results.length > limit;
    const page = results.slice(0, limit).map((row) => {
      if (!q) return row;
      const text = typeof row.text === 'string' ? row.text : '';
      const { text: _text, ...rest } = row;
      return { ...rest, text_snippet: makeSnippet(text, q) };
    });

    return new Response(JSON.stringify({
      results: page,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    }), {
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
