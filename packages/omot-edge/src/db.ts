import type { Env } from './types';
import type { Post } from 'twitter-data-parser';

export async function upsertTweet(env: Env, archiveUrl: string, post: Post): Promise<void> {
  if (!env.OMOT_DB) return;

  const snapshotTs = Math.floor(post.date instanceof Date
    ? post.date.getTime() / 1000
    : new Date(post.date as unknown as string).getTime() / 1000);

  await env.OMOT_DB.prepare(`
    INSERT OR REPLACE INTO tweets
      (id, username, user_id, snapshot_ts, archive_url, text, has_media, parser_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    post.id,
    post.user?.userName?.toLowerCase() ?? '',
    post.user?.userId ?? null,
    snapshotTs,
    archiveUrl,
    post.text ?? '',
    (post.images && post.images.length > 0) ? 1 : 0,
    Number(env.PARSER_VERSION ?? 1),
  ).run();
}

export async function logAccess(env: Env, username: string): Promise<void> {
  if (!env.OMOT_DB) return;
  await env.OMOT_DB.prepare(`
    INSERT INTO access_log (username, hits, last_hit)
    VALUES (?, 1, unixepoch())
    ON CONFLICT(username) DO UPDATE SET
      hits     = hits + 1,
      last_hit = unixepoch()
  `).bind(username.toLowerCase()).run();
}

export async function topUsernames(env: Env, limit = 100): Promise<string[]> {
  if (!env.OMOT_DB) return [];
  const { results } = await env.OMOT_DB.prepare(
    'SELECT username FROM access_log ORDER BY hits DESC LIMIT ?'
  ).bind(limit).all<{ username: string }>();
  return results.map(r => r.username);
}
