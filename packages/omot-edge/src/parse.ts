import { DOMParser as LinkedomDOMParser } from 'linkedom';
import { setDOMBackend } from 'twitter-data-parser';
import type { Post } from 'twitter-data-parser';

// Cloudflare Workers expose neither jsdom nor a native DOMParser, so we
// register linkedom as the DOM backend at module load. Module side-effects
// run before any parsePostFromUrl call below, so the registration is in
// place by the time the parser asks for a Document.
const linkedomParser = new LinkedomDOMParser();
setDOMBackend((html) => linkedomParser.parseFromString(html, 'text/html') as unknown as Document);

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
