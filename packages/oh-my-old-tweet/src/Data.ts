import { CorsProxyConfig, getUrl } from "./corsUrl";
import { getCdxItemUrl, parsePost, Post, parseCdxItem } from "twitter-data-parser"

export function getCdxList(config: CorsProxyConfig, user: string) {
  const req = `twitter.com/${user}/`
  return fetch(getUrl(config, `https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`))
    .then(res => res.json())
    .then(j => j as string[][]);
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

export function fromCdxItem(cdxItem: string[]): MinimalCdxInfo {
  return {
    ...(parseCdxItem(cdxItem)),
    origUrl: getCdxItemUrl(cdxItem)
  };
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
