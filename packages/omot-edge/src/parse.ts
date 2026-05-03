import type { Post } from 'twitter-data-parser';

// Extracts ArchiveTweetInfo from an archive.org URL, then calls parsePost.
// Task 10 will make this work under the Workers runtime by swapping out the
// DOM parser backend (linkedom instead of jsdom/DOMParser).
export async function parsePostFromUrl(
  html: string,
  archiveUrl: string,
): Promise<Post | undefined> {
  // archive URL shape: https://web.archive.org/web/<timestamp>/<origUrl>
  const m = archiveUrl.match(/\/web\/(\d+)\/(https?:\/\/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+))/);
  if (!m) return undefined;

  const [, timestamp, , userName, id] = m;

  const { parsePost } = await import('twitter-data-parser');
  return parsePost(html, { id, timestamp, userName });
}
