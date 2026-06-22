import type { Post } from 'twitter-data-parser';
import type { Env } from '../types';
import { cdxCacheKey } from './cdx';
import { upsertTweets } from '../db';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 20;
const D1_BATCH_SIZE = 100;
const DEFAULT_PREFIX = 'snapshot/';
const SNAPSHOT_KEY_RE = /^snapshot\/v(\d+)\/(.+)\.json$/;
const TWITTER_STATUS_RE = /(?:https?:\/\/)?(?:mobile\.)?(?:twitter|x)\.com\/([^/?#]+)\/status\/(\d+)/i;
const TIMESTAMP_RE = /\/web\/(\d{4,14})(?:[a-z]+_)?\//;

interface CdxRow {
  timestamp: string;
  original: string;
  mimetype: string;
}

interface ReindexStats {
  listed: number;
  loaded: number;
  parsed: number;
  indexed: number;
  skippedMissingObject: number;
  skippedNullPost: number;
  skippedInvalidJson: number;
  skippedInvalidArchiveUrl: number;
  cdxHits: number;
  fixedJsonPath: number;
  errors: Array<{ key: string; error: string }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function parseLimit(raw: string | null): number {
  return parseBoundedPositiveInt(raw, DEFAULT_LIMIT, MAX_LIMIT);
}

function parseConcurrency(raw: string | null): number {
  return parseBoundedPositiveInt(raw, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
}

function parseBoundedPositiveInt(raw: string | null, fallback: number, max: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function wantsWrite(url: URL): boolean {
  const raw = url.searchParams.get('write') ?? '';
  return raw === '1' || raw.toLowerCase() === 'true';
}

function checkAdminAuth(request: Request, env: Env): Response | null {
  if (!env.OMOT_API_KEY) {
    return jsonResponse({ error: 'OMOT_API_KEY is required for admin routes' }, 403);
  }
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${env.OMOT_API_KEY}`) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }
  return null;
}

function snapshotVersionFromKey(key: string): string | undefined {
  return key.match(SNAPSHOT_KEY_RE)?.[1];
}

export function archiveUrlFromSnapshotKey(key: string): string | undefined {
  const match = key.match(SNAPSHOT_KEY_RE);
  if (!match) return undefined;
  const safeUrl = match[2];
  const archiveUrl = safeUrl.replace(/(^|\/)(https?)_\/\//g, '$1$2://');
  return TIMESTAMP_RE.test(archiveUrl) ? archiveUrl : undefined;
}

function getPostArchiveUrl(post: Post): string | undefined {
  const archiveUrl = (post as Post & { archiveUrl?: unknown }).archiveUrl;
  return typeof archiveUrl === 'string' && TIMESTAMP_RE.test(archiveUrl) ? archiveUrl : undefined;
}

function getStatusParts(post: Post, archiveUrl: string): { username: string; id: string } | undefined {
  const match = archiveUrl.match(TWITTER_STATUS_RE);
  const id = post.id || match?.[2];
  const username = post.user?.userName || match?.[1];
  if (!id || !username) return undefined;
  return { username: username.toLowerCase(), id };
}

function archiveTimestamp(archiveUrl: string): string | undefined {
  const match = archiveUrl.match(TIMESTAMP_RE);
  return match?.[1]?.padEnd(14, '0');
}

function parseCdxRow(rowText: string): CdxRow | undefined {
  const row = JSON.parse(rowText) as unknown;
  if (!Array.isArray(row)) return undefined;

  const first = String(row[0] ?? '');
  const second = String(row[1] ?? '');
  if (/^\d{14}$/.test(first)) {
    return {
      timestamp: first,
      original: String(row[1] ?? ''),
      mimetype: String(row[2] ?? ''),
    };
  }
  if (/^\d{14}$/.test(second)) {
    return {
      timestamp: second,
      original: String(row[2] ?? ''),
      mimetype: String(row[3] ?? ''),
    };
  }
  return undefined;
}

function findCdxRow(body: string, timestamp: string, statusId: string): CdxRow | undefined {
  const statusNeedle = `/status/${statusId}`;
  let position = body.indexOf(timestamp);

  while (position !== -1) {
    const rowStart = body.lastIndexOf('[', position);
    const rowEnd = body.indexOf(']', position);
    if (rowStart === -1 || rowEnd === -1 || rowEnd <= rowStart) return undefined;

    const rowText = body.slice(rowStart, rowEnd + 1);
    if (rowText.includes(statusNeedle)) {
      try {
        return parseCdxRow(rowText);
      } catch {
        return undefined;
      }
    }
    position = body.indexOf(timestamp, position + timestamp.length);
  }

  return undefined;
}

async function loadCachedCdxBody(env: Env, username: string): Promise<string | undefined> {
  const normalized = username.toLowerCase();
  const keys = [cdxCacheKey(normalized), `cdx/v1/${normalized}.json`];
  for (const key of keys) {
    const obj = await env.OMOT_CACHE.get(key);
    if (!obj) continue;
    return obj.text();
  }
  return undefined;
}

function getCachedCdxBody(
  env: Env,
  username: string,
  cache: Map<string, Promise<string | undefined>>,
): Promise<string | undefined> {
  const normalized = username.toLowerCase();
  let body = cache.get(normalized);
  if (!body) {
    body = loadCachedCdxBody(env, normalized);
    cache.set(normalized, body);
  }
  return body;
}

function isJsonSnapshot(mimetype: string): boolean {
  return mimetype.toLowerCase().includes('application/json');
}

function archiveUrlFromCdxRow(row: CdxRow): string {
  const mode = isJsonSnapshot(row.mimetype) ? `${row.timestamp}if_` : row.timestamp;
  return `https://web.archive.org/web/${mode}/${row.original}`;
}

async function canonicalizeArchiveUrl(
  env: Env,
  archiveUrl: string,
  post: Post,
  stats: ReindexStats,
  cdxBodiesByUser: Map<string, Promise<string | undefined>>,
): Promise<string> {
  const parts = getStatusParts(post, archiveUrl);
  const ts = archiveTimestamp(archiveUrl);
  if (!parts || !ts) return archiveUrl;

  const body = await getCachedCdxBody(env, parts.username, cdxBodiesByUser);
  const match = body ? findCdxRow(body, ts, parts.id) : undefined;
  if (!match) return archiveUrl;

  stats.cdxHits += 1;
  const canonical = archiveUrlFromCdxRow(match);
  if (isJsonSnapshot(match.mimetype) && canonical !== archiveUrl) {
    stats.fixedJsonPath += 1;
  }
  return canonical;
}

async function loadCachedPost(obj: R2ObjectBody): Promise<Post | null> {
  const parsed = JSON.parse(await obj.text()) as { post?: Post | null };
  if (!parsed.post) return null;
  const post = parsed.post;
  if (post.date && !(post.date instanceof Date)) {
    post.date = new Date(post.date as unknown as string);
  }
  return post;
}

interface PreparedPost {
  archiveUrl: string;
  parserVersion?: string;
  post: Post;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function prepareObject(
  env: Env,
  key: string,
  stats: ReindexStats,
  cdxBodiesByUser: Map<string, Promise<string | undefined>>,
): Promise<PreparedPost | null> {
  try {
    const body = await env.OMOT_CACHE.get(key);
    if (!body) {
      stats.skippedMissingObject += 1;
      return null;
    }
    stats.loaded += 1;

    let post: Post | null;
    try {
      post = await loadCachedPost(body);
    } catch {
      stats.skippedInvalidJson += 1;
      return null;
    }
    if (!post) {
      stats.skippedNullPost += 1;
      return null;
    }
    stats.parsed += 1;

    const archiveUrl = archiveUrlFromSnapshotKey(key) ?? getPostArchiveUrl(post);
    if (!archiveUrl) {
      stats.skippedInvalidArchiveUrl += 1;
      return null;
    }

    return {
      archiveUrl: await canonicalizeArchiveUrl(env, archiveUrl, post, stats, cdxBodiesByUser),
      parserVersion: snapshotVersionFromKey(key),
      post,
    };
  } catch (err) {
    stats.errors.push({
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function handleReindex(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  const deny = checkAdminAuth(request, env);
  if (deny) return deny;

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'));
  const concurrency = parseConcurrency(url.searchParams.get('concurrency'));
  const prefix = url.searchParams.get('prefix') || DEFAULT_PREFIX;
  const cursor = url.searchParams.get('cursor') || undefined;
  const write = wantsWrite(url);

  const listed = await env.OMOT_CACHE.list({ prefix, cursor, limit });
  const stats: ReindexStats = {
    listed: listed.objects.length,
    loaded: 0,
    parsed: 0,
    indexed: 0,
    skippedMissingObject: 0,
    skippedNullPost: 0,
    skippedInvalidJson: 0,
    skippedInvalidArchiveUrl: 0,
    cdxHits: 0,
    fixedJsonPath: 0,
    errors: [],
  };

  const cdxBodiesByUser = new Map<string, Promise<string | undefined>>();
  const prepared = await mapWithConcurrency(
    listed.objects,
    concurrency,
    (object) => prepareObject(env, object.key, stats, cdxBodiesByUser),
  );

  if (write) {
    const indexable = prepared.filter((item): item is PreparedPost => item !== null);
    for (let offset = 0; offset < indexable.length; offset += D1_BATCH_SIZE) {
      const batch = indexable.slice(offset, offset + D1_BATCH_SIZE);
      await upsertTweets(env, batch);
      stats.indexed += batch.length;
    }
  }

  return jsonResponse({
    write,
    prefix,
    limit,
    concurrency,
    cursor: cursor ?? '',
    nextCursor: listed.truncated ? listed.cursor ?? '' : '',
    done: !listed.truncated,
    ...stats,
  });
}
