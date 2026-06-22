import type { Env } from '../types';
import { topUsernames } from '../db';
import { getCachedPost, setCachedPost } from '../cache';
import { fetchArchiveHtml } from '../fetchArchive';
import { parsePostFromUrl } from '../parse';
import { upsertTweet } from '../db';

const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const MAX_ACCOUNTS  = 100;
const MAX_NEW_SNAPS = 20;   // per account per run, avoid burning CPU budget
const BUDGET_MS     = 4 * 60 * 1000; // 4 min hard limit

interface CdxRow {
  timestamp: string;
  original: string;
  mimetype: string;
  statuscode: string;
  id: string;
}

function isJsonSnapshot(mimetype: string): boolean {
  return mimetype.toLowerCase().includes('application/json');
}

function getArchiveUrl(row: CdxRow): string {
  const mode = isJsonSnapshot(row.mimetype) ? `${row.timestamp}if_` : row.timestamp;
  return `https://web.archive.org/web/${mode}/${row.original}`;
}

async function fetchNewSnapshots(env: Env, username: string): Promise<CdxRow[]> {
  const url = new URL(CDX_API);
  url.searchParams.set('url', `twitter.com/${username}/status`);
  url.searchParams.set('matchType', 'prefix');
  url.searchParams.set('output', 'json');
  url.searchParams.set('limit', String(MAX_NEW_SNAPS));
  url.searchParams.set('collapse', 'digest');
  url.searchParams.set('fl', 'timestamp,original,mimetype,statuscode,digest');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const rows = await res.json() as string[][];
  return rows.slice(1).map(([timestamp, original, mimetype, statuscode, digest]) => ({
    timestamp, original, mimetype, statuscode, id: digest,
  }));
}

async function warmOne(env: Env, row: CdxRow): Promise<void> {
  const archiveUrl = getArchiveUrl(row);
  try {
    const cached = await getCachedPost(env, archiveUrl);
    if (cached !== undefined) {
      if (cached) await upsertTweet(env, archiveUrl, cached);
      return;
    }

    const html = await fetchArchiveHtml(archiveUrl);
    const post = await parsePostFromUrl(html, archiveUrl) ?? null;
    await setCachedPost(env, archiveUrl, post);
    if (post) await upsertTweet(env, archiveUrl, post);
  } catch (err) {
    console.warn(`[prewarm] failed to warm ${archiveUrl}: ${err}`);
  }
}

export async function handleScheduled(env: Env): Promise<void> {
  const start = Date.now();
  const usernames = await topUsernames(env, MAX_ACCOUNTS);

  console.log(`[prewarm] warming ${usernames.length} accounts`);

  for (const username of usernames) {
    if (Date.now() - start > BUDGET_MS) {
      console.log('[prewarm] budget exhausted, stopping early');
      break;
    }
    try {
      const rows = await fetchNewSnapshots(env, username);
      for (const row of rows) {
        if (Date.now() - start > BUDGET_MS) break;
        await warmOne(env, row);
      }
    } catch (err) {
      console.warn(`[prewarm] error for ${username}: ${err}`);
    }
  }

  console.log(`[prewarm] done in ${Date.now() - start}ms`);
}
