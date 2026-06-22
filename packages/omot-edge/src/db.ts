import type { Env } from './types';
import type { Post } from 'twitter-data-parser';

function parseArchiveTimestamp(archiveUrl: string): number | undefined {
  const match = archiveUrl.match(/\/web\/(\d{4,14})(?:[a-z]+_)?\//);
  if (!match) return undefined;

  const timestamp = match[1].padEnd(14, '0');
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(4, 6));
  const day = Number(timestamp.slice(6, 8));
  const hour = Number(timestamp.slice(8, 10));
  const minute = Number(timestamp.slice(10, 12));
  const second = Number(timestamp.slice(12, 14));

  const millis = Date.UTC(year, month - 1, day, hour, minute, second);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : undefined;
}

function parsePostTimestamp(post: Post): number {
  const millis = post.date instanceof Date
    ? post.date.getTime()
    : new Date(post.date as unknown as string).getTime();
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : 0;
}

const UPSERT_TWEET_SQL = `
  INSERT OR REPLACE INTO tweets
    (id, username, user_id, snapshot_ts, archive_url, text, has_media, parser_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

function bindUpsertTweet(
  db: D1Database,
  archiveUrl: string,
  post: Post,
  parserVersion: string,
): D1PreparedStatement {
  const snapshotTs = parseArchiveTimestamp(archiveUrl) ?? parsePostTimestamp(post);

  return db.prepare(UPSERT_TWEET_SQL).bind(
    post.id,
    post.user?.userName?.toLowerCase() ?? '',
    post.user?.id ?? null,
    snapshotTs,
    archiveUrl,
    post.text ?? '',
    (post.images && post.images.length > 0) ? 1 : 0,
    Number(parserVersion ?? 1),
  );
}

export async function upsertTweet(
  env: Env,
  archiveUrl: string,
  post: Post,
  parserVersion = env.PARSER_VERSION,
): Promise<void> {
  if (!env.OMOT_DB) return;

  await bindUpsertTweet(env.OMOT_DB, archiveUrl, post, parserVersion).run();
}

export async function upsertTweets(
  env: Env,
  tweets: Array<{ archiveUrl: string; post: Post; parserVersion?: string }>,
): Promise<void> {
  if (!env.OMOT_DB || tweets.length === 0) return;

  const statements = tweets.map(({ archiveUrl, post, parserVersion }) => (
    bindUpsertTweet(env.OMOT_DB, archiveUrl, post, parserVersion ?? env.PARSER_VERSION)
  ));
  await env.OMOT_DB.batch(statements);
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
