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
  // archive URL shape: https://web.archive.org/web/<timestamp>[/mode]/<origUrl>
  // JSON captures use modes such as if_ after the timestamp.
  const m = archiveUrl.match(/\/web\/(\d+)(?:[a-z]+_)?\/(https?:\/\/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+))/);
  if (!m) return undefined;

  const [, timestamp, , userName, id] = m;
  const meta = { id, timestamp, userName };

  const { parsePost } = await import('twitter-data-parser');
  const doc = linkedomParser.parseFromString(html, 'text/html') as unknown as Document;
  const embeddedJson = doc.querySelector('#jsonview pre')?.textContent;
  if (embeddedJson) {
    const post = parsePost(embeddedJson, meta);
    if (post) return post;
  }

  return parsePost(html, meta);
}
