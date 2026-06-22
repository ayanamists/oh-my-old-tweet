import type { Post } from 'twitter-data-parser';
import type { Env } from '../types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

interface MediaUrlEntry {
  url: string;
  kind: 'image' | 'avatar' | 'profile' | 'video_thumb';
  tweetId: string;
  username: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
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

function parseLimit(raw: string | null): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

async function loadPost(obj: R2ObjectBody): Promise<Post | null> {
  const parsed = JSON.parse(await obj.text()) as { post?: Post | null };
  return parsed.post ?? null;
}

function addUrl(
  entries: MediaUrlEntry[],
  seen: Set<string>,
  post: Post,
  kind: MediaUrlEntry['kind'],
  rawUrl: string | undefined,
): void {
  if (!rawUrl || seen.has(rawUrl)) return;
  seen.add(rawUrl);
  entries.push({
    url: rawUrl,
    kind,
    tweetId: post.id,
    username: post.user?.userName?.toLowerCase() ?? '',
  });
}

function collectPostMediaUrls(post: Post, includeAvatars: boolean): MediaUrlEntry[] {
  const entries: MediaUrlEntry[] = [];
  const seen = new Set<string>();

  for (const image of post.images ?? []) {
    addUrl(entries, seen, post, 'image', image);
  }
  addUrl(entries, seen, post, 'video_thumb', post.videoInfo?.thumbUrl);

  if (includeAvatars) {
    addUrl(entries, seen, post, 'avatar', post.user?.avatar);
    addUrl(entries, seen, post, 'profile', post.user?.profileInfo?.image);
    addUrl(entries, seen, post, 'profile', post.user?.profileInfo?.bigAvatar);
  }

  return entries;
}

export async function handleMediaUrls(request: Request, env: Env): Promise<Response> {
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
  const cursor = url.searchParams.get('cursor') || undefined;
  const prefix = url.searchParams.get('prefix') || 'snapshot/';
  const includeAvatars = url.searchParams.get('avatars') !== '0';

  const listed = await env.OMOT_CACHE.list({ prefix, cursor, limit });
  const seen = new Set<string>();
  const urls: MediaUrlEntry[] = [];
  let posts = 0;
  let skippedNullPost = 0;
  let skippedInvalidJson = 0;

  for (const object of listed.objects) {
    const body = await env.OMOT_CACHE.get(object.key);
    if (!body) continue;

    let post: Post | null;
    try {
      post = await loadPost(body);
    } catch {
      skippedInvalidJson += 1;
      continue;
    }

    if (!post) {
      skippedNullPost += 1;
      continue;
    }

    posts += 1;
    for (const entry of collectPostMediaUrls(post, includeAvatars)) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      urls.push(entry);
    }
  }

  return jsonResponse({
    prefix,
    limit,
    cursor: cursor ?? '',
    nextCursor: listed.truncated ? listed.cursor ?? '' : '',
    done: !listed.truncated,
    scanned: listed.objects.length,
    posts,
    skippedNullPost,
    skippedInvalidJson,
    urls,
  });
}
