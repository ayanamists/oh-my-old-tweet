import { CorsProxyConfig, buildProxiedUrls, fetchWithFallbacks } from "./corsUrl";
import { parsePost, Post, parseCdxRows, CdxItem, ArchiveTweetInfo } from "twitter-data-parser"
import { Interval } from "luxon";

async function tryEdgeWorker(edgeUrl: string, archiveUrl: string, apiKey?: string): Promise<Post | undefined> {
  try {
    const endpoint = `${edgeUrl.replace(/\/$/, '')}/snapshot?url=${encodeURIComponent(archiveUrl)}`;
    const headers: HeadersInit = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000), headers });
    if (!res.ok) return undefined;
    const data = await res.json() as { post?: Post | null };
    if (!data.post) return undefined;
    if (!(data.post.date instanceof Date)) {
      data.post.date = new Date(data.post.date as unknown as string);
    }
    return data.post;
  } catch {
    return undefined;
  }
}

async function tryEdgeCdx(edgeUrl: string, user: string, apiKey?: string): Promise<CdxItem[] | undefined> {
  try {
    const endpoint = `${edgeUrl.replace(/\/$/, '')}/cdx?user=${encodeURIComponent(user)}`;
    const headers: HeadersInit = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    // Edge fetches archive.org with R2 stale-while-revalidate caching, so a
    // long timeout here only really matters for the cold-cache case.
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(45_000), headers });
    if (!res.ok) return undefined;
    const rows = await res.json() as string[][];
    if (!Array.isArray(rows)) return undefined;
    return parseCdxRows(rows);
  } catch {
    return undefined;
  }
}

async function parseMaybeInWorker(html: string, meta: ArchiveTweetInfo): Promise<Post | undefined> {
  if (typeof Worker !== 'undefined') {
    try {
      const { parseInWorker } = await import('./parserClient');
      return await parseInWorker(html, meta);
    } catch {
      // Worker unavailable or failed — fall through to main-thread parse
    }
  }
  return parsePost(html, meta);
}

// Fetch the CDX list for `user` over `interval`. Pure I/O — caching/dedup is
// the caller's responsibility (React Query owns it in the UI; CLI/edge own
// theirs). Edge worker ignores the interval and returns the full timeline;
// the legacy CORS proxy honours it. When the edge fast path errors out, fall
// through to the proxy so a single Worker outage doesn't take the UI down.
export async function getCdxList(config: CorsProxyConfig, user: string, interval: Interval): Promise<CdxItem[]> {
  if (config.edgeUrl) {
    const edgeRows = await tryEdgeCdx(config.edgeUrl, user, config.apiKey);
    if (edgeRows !== undefined) return edgeRows;
  }
  return fetchOneCdx(config, user, interval);
}

function fetchOneCdx(config: CorsProxyConfig, user: string, interval: Interval): Promise<CdxItem[]> {
  if (!interval.start || !interval.end || !interval.isValid) {
    throw new Error("Invalid interval");
  }
  const url = new URL('https://web.archive.org/cdx/search/cdx');
  url.searchParams.append('url', `twitter.com/${user}/status`);
  url.searchParams.append('matchType', 'prefix');
  url.searchParams.append('output', 'json');
  url.searchParams.append('limit', '100000');
  url.searchParams.append('from', interval.start!.toFormat('yyyyMMddHHmmss'));
  url.searchParams.append('to', interval.end!.toFormat('yyyyMMddHHmmss'));
  url.searchParams.append('collapse', 'digest');
  return fetchWithFallbacks(buildProxiedUrls(config, url.toString()))
    .then(res => res.json())
    .then((j: string[][]) => parseCdxRows(j));
}

export interface MinimalCdxInfo {
  timestamp: string;
  mimetype: string;
  id: string;
  origUrl: string;
};

function isJsonSnapshot(mimetype: string): boolean {
  return mimetype.toLowerCase().includes('application/json');
}

export function getArchivePageUrl(cdxItem: MinimalCdxInfo) {
  if (isJsonSnapshot(cdxItem.mimetype)) {
    return `https://web.archive.org/web/${cdxItem.timestamp}if_/${cdxItem.origUrl}`;
  }
  return `https://web.archive.org/web/${cdxItem.timestamp}/${cdxItem.origUrl}`;
}

export function getShareLink(user: string, cdxItem: MinimalCdxInfo) {
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  return `${baseUrl}/#/status/${user}/${cdxItem.timestamp}/${cdxItem.id}/?mimetype=${encodeURIComponent(cdxItem.mimetype)}`;
}

export async function getOnePage(config: CorsProxyConfig, cdxItem: MinimalCdxInfo): Promise<Post | undefined> {
  const timeStamp = cdxItem.timestamp;
  const origUrl = cdxItem.origUrl;
  const urlSplit = origUrl.split('/');
  const statusIdx = urlSplit.indexOf("status");
  if (statusIdx === -1) return undefined;

  const user = urlSplit[statusIdx - 1];
  const id = cdxItem.id;
  const pageUrl = getArchivePageUrl(cdxItem);

  // Fast path: edge Worker returns pre-parsed JSON from R2
  if (config.edgeUrl) {
    const edgeResult = await tryEdgeWorker(config.edgeUrl, pageUrl, config.apiKey);
    if (edgeResult !== undefined) return { ...edgeResult, archiveUrl: pageUrl };
  }

  // Fallback: direct archive.org fetch + parse (Worker or main thread)
  const html = await fetchWithFallbacks(buildProxiedUrls(config, pageUrl))
    .then(res => res.text());
  const post = await parseMaybeInWorker(html, { id, timestamp: timeStamp, userName: user });
  return post ? { ...post, archiveUrl: pageUrl } : undefined;
}
