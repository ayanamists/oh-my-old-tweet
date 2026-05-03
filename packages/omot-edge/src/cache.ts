import type { Env } from './types';
import type { Post } from 'twitter-data-parser';

export function cacheKey(archiveUrl: string, parserVersion: string): string {
  // Simple deterministic key — no crypto needed, collisions acceptable.
  // Replace characters that R2 keys disallow.
  const safe = archiveUrl.replace(/[^a-zA-Z0-9._\-/]/g, '_');
  return `snapshot/v${parserVersion}/${safe}.json`;
}

export async function getCachedPost(
  env: Env,
  archiveUrl: string,
): Promise<Post | null | undefined> {
  const key = cacheKey(archiveUrl, env.PARSER_VERSION);
  const obj = await env.OMOT_CACHE.get(key);
  if (!obj) return undefined;
  try {
    const text = await obj.text();
    const parsed = JSON.parse(text) as { post: Post | null };
    if (parsed.post && !(parsed.post.date instanceof Date)) {
      parsed.post.date = new Date(parsed.post.date as unknown as string);
    }
    return parsed.post;
  } catch {
    return undefined;
  }
}

export async function setCachedPost(
  env: Env,
  archiveUrl: string,
  post: Post | null,
): Promise<void> {
  const key = cacheKey(archiveUrl, env.PARSER_VERSION);
  const body = JSON.stringify({ post });
  await env.OMOT_CACHE.put(key, body, {
    httpMetadata: { contentType: 'application/json' },
    // R2 objects are immutable once written for the same key.
    // Bumping PARSER_VERSION invalidates old entries via key rotation.
  });
}
