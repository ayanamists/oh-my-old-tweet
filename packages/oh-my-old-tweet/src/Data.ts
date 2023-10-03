import Post from "./Post";
import { mayRemoveAtSym } from "./Utils";
import { CorsProxyConfig, getUrl } from "./corsUrl";

interface TweetInfo {
  lang: string;
  id: string;
  pageUrl: string;
  tweetUrl: string;
};

export function filterUniqueCdxItems(cdxItems: string[][]) {
  const idSet = new Set<String>();
  const res: string[][] = [];
  cdxItems.forEach((i) => {
    const id = getCdxItemId(i);
    if (!idSet.has(id) && isValidCdxItem(i)) {
      res.push(i);
      idSet.add(id);
    }
  })
  res.sort((a, b) => getCdxNumberId(a) - getCdxNumberId(b));
  return res;
}

function isValidCdxItem(cdxItem: string[]) {
  return !Number.isNaN(getCdxNumberId(cdxItem));
}

function getCdxNumberId(cdxItem: string[]) {
  return parseInt(getCdxItemId(cdxItem));
}

export function getCdxItemUrl(cdxItem: string[]) {
  return cdxItem[2];
}

export function getCdxItemId(cdxItem: string[]) {
  // TODO: use real url library for this
  const origUrl = getCdxItemUrl(cdxItem);
  const splitted = origUrl.split('/');
  const statusIdx = splitted.indexOf('status');
  if (statusIdx === -1) {
    return "NaN";
  }
  const preId = splitted[statusIdx + 1];
  const splitted2 = preId.split('?');
  return splitted2[0];
}

export function getCdxList(config: CorsProxyConfig, user: string) {
  const req = `twitter.com/${user}/`
  return fetch(getUrl(config, `https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`))
    .then(res => res.json())
    .then(j => j as string[][]);
}


export function getOnePage(config: CorsProxyConfig, cdxItem: string[]): Promise<Post | undefined> {
  const timeStamp = cdxItem[1];
  const origUrl = getCdxItemUrl(cdxItem);
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
    .then((res => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(res, 'text/html');

      const lang = doc.getElementsByTagName('html')[0].getAttribute('lang') ?? "en";
      const mainRegion = doc.querySelector('.permalink-tweet-container');
      const info = {
        id: id,
        pageUrl: pageUrl,
        tweetUrl: origUrl,
        lang: lang
      };

      if (mainRegion != null) {
        return extractFromMainRegion(mainRegion, info);
      } else {
        const metaTag = findMetaTag(doc, id);
        if (metaTag != null) {
          return extractFromMetaTag(metaTag, info);
        } else {
          console.warn(`[Data.ts]: Cannot find possible extraction method. url: ${pageUrl}`);
          return;
        }
      }
    }));
}

function findMetaTag(doc: Document, id: string) {
  let eles = doc.querySelectorAll(`meta[content="${id}"]`)
  let target = null;
  eles.forEach((i) => {
    const parentElement = i.parentElement;
    if (parentElement == null) {
      return;
    }

    if (parentElement.tagName.toLowerCase() === "div"
      && parentElement.getAttribute("itemprop") === "hasPart") {
      target = i;
    }
  })
  return target;
}

function extractFromMetaTag(metaTag: Element, info: TweetInfo): Post | undefined {
  const div = metaTag.parentElement;
  if (div == null) {
    return;
  }
  const article = div.getElementsByTagName('article');
  if (article.length !== 1) {
    console.warn(`[Data.ts] During extraction, multiple article. url: ${info.pageUrl}`);
  }
  const data = article[0];
  const aRoleLinks = data.querySelectorAll('a[role="link"]');
  const userName = mayRemoveAtSym(aRoleLinks[2].textContent ?? undefined);
  const fullName = aRoleLinks[1].textContent ?? undefined;
  const text = data.querySelector('div[data-testid="tweetText"]')?.textContent ?? undefined;
  const images = extractImages(data);
  const timeMeta = div.querySelector('meta[itemprop="datePublished"]')?.getAttribute('content');
  const time = new Date(timeMeta ?? 0);
  const avatarRegion = div.querySelector('div[data-testid="Tweet-User-Avatar"]');
  const avatar = filterValidAvatar(avatarRegion?.querySelector('img')?.getAttribute('src'));

  return {
    user: {
      userName: userName,
      fullName: fullName,
      avatar: avatar
    },
    id: info.id,
    text: text,
    images: images,
    archiveUrl: info.pageUrl,
    tweetUrl: info.tweetUrl,
    date: time
  }
}

function extractFromMainRegion(mainRegion: Element, info: TweetInfo): Post | undefined {
  const name = getOneElementByClassName(mainRegion, 'fullname')?.textContent ?? undefined;
  const userName = mainRegion.querySelector('.username > b')?.textContent ?? undefined;
  const timeMsStr = mainRegion.querySelector('._timestamp')?.getAttribute('data-time-ms');
  const time = new Date(parseInt(timeMsStr ?? "0"));
  const textRegion = mainRegion
    .querySelector<HTMLElement>('div.js-tweet-text-container > p')
  const text = textRegion == null ? undefined : extractText(textRegion);
  const images = extractImages(mainRegion);

  const avatarRegion = mainRegion.querySelector('img.avatar');
  const avatar = filterValidAvatar(avatarRegion?.getAttribute('src'));

  // TODO: correctly handle reply:
  if (images.length === 0 && isReply(mainRegion)) {
    console.log(`${info.pageUrl} is reply`);
    return;
  }

  return {
    user: {
      userName: userName,
      fullName: name,
      avatar: avatar
    },
    id: info.id,
    text: text,
    images: images,
    archiveUrl: info.pageUrl,
    tweetUrl: info.tweetUrl,
    date: time
  };
}

function extractText(textRegion: Element) {
  let res = "";
  const nodes = textRegion.childNodes;
  for (let node in nodes) {
    res += extractOneTag(nodes[node]);
  }
  return res;
}

function extractOneTag(tag: ChildNode) {
  if (tag.nodeName === "#text") {
    return tag.textContent;
  } else if (tag.nodeName === "A") {
    const nodeA = tag as HTMLAnchorElement;
    if (nodeA.classList.contains('twitter-hashtag')) {
      return nodeA.textContent + " ";
    } else if (! nodeA.classList.contains('u-hidden')) {
        return ` ${nodeA.textContent} `;
      }
  } else if (tag.nodeName === "IMG") {
    const nodeImg = tag as HTMLImageElement;
    if (nodeImg.classList.contains('Emoji')) {
      return nodeImg.alt;
    }
  }
  return "";
}

function getOneElementByClassName(doc: Element, name: string) {
  const subElement = doc.getElementsByClassName(name);
  if (subElement.length === 1) {
    return subElement[0];
  } else {
    return null;
  }
}

function extractImages(mainRegion: Element) {
  const images = mainRegion.getElementsByTagName('img');
  const urls = [];
  for (let i = 0; i < images.length; ++i) {
    if (isValidImgTag(images[i])) {
      urls.push(toHttps(images[i].src));
    }
  }
  return urls;
}

function isValidImgTag(tag: HTMLImageElement) {
  const stage1 = !tag.classList.contains('avatar') && tag.src
  if (stage1) {
    const src = tag.src;
    const splitted = src.split('/');
    const last = splitted[splitted.length - 1];
    return !last.match('deleted') && !splitted.some(i => i.match('profile'))
      && !splitted.includes('emoji');
  } else {
    return false;
  }
}

function filterValidAvatar(url: string | undefined | null) {
  if (url == null) {
    return undefined;
  } else {
    if (url.split('/').some(i => i.match('deleted'))) {
      return undefined;
    } else {
      return toHttps(url);
    }
  }
}

function isReply(mainRegion: Element) {
  return mainRegion.classList.contains("ThreadedConversation");
}

function toHttps(url: string) {
  const urlObj = new URL(url);
  if (urlObj.protocol === 'http:') {
    urlObj.protocol = 'https:';
  }
  return urlObj.toString();
}
