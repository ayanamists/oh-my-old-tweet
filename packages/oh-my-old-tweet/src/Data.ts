import { CorsProxyConfig, getUrl } from "./corsUrl";
import { getCdxItemUrl, getCdxItemId, parsePost, Post } from "twitter-data-parser"

export function getCdxList(config: CorsProxyConfig, user: string) {
  const req = `twitter.com/${user}/`
  return fetch(getUrl(config, `https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`))
    .then(res => res.json())
    .then(j => j as string[][]);
}


export function getOnePage(config: CorsProxyConfig, cdxItem: string[]): Promise<Post | undefined> {
  const timeStamp = cdxItem[1];
  const origUrl = getCdxItemUrl(cdxItem);
  const urlSplit = origUrl.split('/');
  const statusIdx = urlSplit.indexOf("status");
  if (statusIdx !== -1) {
    const user = urlSplit[statusIdx - 1];
    const id = getCdxItemId(cdxItem);
    const pageUrl = `https://web.archive.org/web/${timeStamp}/${origUrl}`;
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
