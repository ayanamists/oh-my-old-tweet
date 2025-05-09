import { CorsProxyConfig, getUrl } from "./corsUrl";
import { parsePost, Post, parseCdxItem, CdxItem } from "twitter-data-parser"
import { Interval } from "luxon";

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
  return fetch(getUrl(config, url.toString()))
    .then(res => res.json())
    .then((j: string[][]) => j.map(parseCdxItem));
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

export function getOnePage(config: CorsProxyConfig, cdxItem: MinimalCdxInfo): Promise<Post | undefined> {
  const timeStamp = cdxItem.timestamp;
  const origUrl = cdxItem.origUrl
  const urlSplit = origUrl.split('/');
  const statusIdx = urlSplit.indexOf("status");
  if (statusIdx !== -1) {
    const user = urlSplit[statusIdx - 1];
    const id = cdxItem.id;
    const pageUrl = getArchivePageUrl(cdxItem);
    return fetch(getUrl(config, pageUrl))
      .then(res => {
        if (!res.ok) {
          throw Error(res.statusText);
        }
        return res;
      })
      .then((res => res.text()))
      .then((res) => parsePost(res, {
        id: id,
        timestamp: timeStamp,
        userName: user
      }));
  } else {
    return Promise.resolve(undefined);
  }  
}
