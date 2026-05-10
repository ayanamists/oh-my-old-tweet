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

function subtractInterval(a: Interval, b: Interval): Interval[] {
  const { start: aStart, end: aEnd } = a;
  const { start: bStart, end: bEnd } = b;

  if (!aStart || !aEnd || !bStart || !bEnd) {
    throw new Error("All intervals must have both start and end");
  }

  if (!a.overlaps(b)) {
    return [a];
  }

  if (b.contains(aStart) && b.contains(aEnd)) {
    return [];
  }

  const parts: Interval[] = [];

  if (aStart < bStart) {
    parts.push(Interval.fromDateTimes(aStart, bStart));
  }

  if (aEnd > bEnd) {
    parts.push(Interval.fromDateTimes(bEnd, aEnd));
  }

  return parts;
}

function maxInterval(a: Interval, b: Interval): Interval {
  const { start: aStart, end: aEnd } = a;
  const { start: bStart, end: bEnd } = b;
  if (!aStart || !aEnd || !bStart || !bEnd) {
    throw new Error("All intervals must have both start and end");
  }
  const start = aStart < bStart ? aStart : bStart;
  const end = aEnd > bEnd ? aEnd : bEnd;
  return Interval.fromDateTimes(start, end);
}

function uniqBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    } else {
      seen.add(key);
      return true;
    }
  });
}

interface CdxCache {
  user: string;
  cdxList: CdxItem[];
  currentInterval: Interval;
}

const cdxCache: Map<string, CdxCache> = new Map();

export async function getCdxList(config: CorsProxyConfig, user: string, interval: Interval): Promise<CdxItem[]> {
  const tasks: Interval[] = [];
  if (!cdxCache.has(user)) {
    tasks.push(interval);
  } else {
    const cache = cdxCache.get(user)!;
    const { currentInterval } = cache;
    const newIntervals = subtractInterval(interval, currentInterval);
    if (newIntervals.length === 0) {
      return cache.cdxList;
    } else {
      tasks.push(...newIntervals);
    }
  }

  console.log(`Fetching ${tasks.length} intervals for user ${user}`);
  for (const task of tasks) {
    console.log(`Fetching interval ${task.start?.toFormat('yyyyMMddHHmmss')} - ${task.end?.toFormat('yyyyMMddHHmmss')}`);
  }

  // Edge fast path: when configured, the worker proxies archive.org's CDX
  // with R2 stale-while-revalidate caching, returning the user's full
  // timeline in a single call. This bypasses the legacy CORS proxy which
  // routinely 503s on cold archive.org calls (>30s upstream).
  if (config.edgeUrl) {
    const edgeRows = await tryEdgeCdx(config.edgeUrl, user, config.apiKey);
    if (edgeRows !== undefined) {
      const merged = cdxCache.has(user)
        ? [...cdxCache.get(user)!.cdxList, ...edgeRows]
        : [...edgeRows];
      const uniqueCdxList = uniqBy(merged, (i) => i.id);
      cdxCache.set(user, {
        user,
        cdxList: uniqueCdxList,
        currentInterval: cdxCache.has(user)
          ? maxInterval(cdxCache.get(user)!.currentInterval, interval)
          : interval,
      });
      return uniqueCdxList;
    }
    // Edge unreachable / non-2xx — fall through to per-interval CORS proxy path.
  }

  const newCdxList: CdxItem[] = [];
  if (cdxCache.has(user)) {
    newCdxList.push(...cdxCache.get(user)!.cdxList);
  }
  for (const task of tasks) {
    const current = await fetchOneCdx(config, user, task)
    newCdxList.push(...current);
  }

  const uniqueCdxList = uniqBy(newCdxList, (i) => i.id);

  const newInterval = cdxCache.has(user) ?
    maxInterval(cdxCache.get(user)!.currentInterval, interval) :
    interval;

  cdxCache.set(user, {
    user: user,
    cdxList: uniqueCdxList,
    currentInterval: newInterval
  });
  return uniqueCdxList;
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

export function getArchivePageUrl(cdxItem: MinimalCdxInfo) {
  if (cdxItem.mimetype === 'application/json') {
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
    if (edgeResult !== undefined) return edgeResult;
  }

  // Fallback: direct archive.org fetch + parse (Worker or main thread)
  const html = await fetchWithFallbacks(buildProxiedUrls(config, pageUrl))
    .then(res => res.text());
  return parseMaybeInWorker(html, { id, timestamp: timeStamp, userName: user });
}
