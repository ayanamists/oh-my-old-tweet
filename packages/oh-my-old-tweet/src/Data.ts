import Post from "./Post";
import getUrl from "./corsUrl";

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
  return res;
}

function isValidCdxItem(cdxItem: string[]) {
  const url = getCdxItemUrl(cdxItem);
  return url.split('/').includes('status');
}

export function getCdxItemUrl(cdxItem: string[]) {
  return cdxItem[2];
}

export function getCdxItemId(cdxItem: string[]) {
  // TODO: use real url library for this
  const origUrl = getCdxItemUrl(cdxItem);
  const splitted = origUrl.split('/');
  const preId = splitted[splitted.length - 1];
  const splitted2 = preId.split('?');
  return splitted2[0];
}

export function getCdxList(user: string) {
  const req = `twitter.com/${user}/`
  return fetch(getUrl(`https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`))
    .then(res => res.json())
    .then(j => j as string[][]);
}


export function getOnePage(cdxItem: string[]): Promise<Post | undefined> {
  const timeStamp = cdxItem[1];
  const origUrl = getCdxItemUrl(cdxItem);
  const id = getCdxItemId(cdxItem);
  const pageUrl = `https://web.archive.org/web/${timeStamp}/${origUrl}`;
  return fetch(getUrl(pageUrl))
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

      const mainRegion = doc.querySelector('.permalink-tweet-container');
      if (mainRegion != null) {
        return extractFromMainRegion(mainRegion, id, pageUrl, origUrl);
      } else {
        const metaTag = findMetaTag(doc, id);
        if (metaTag != null) {
          return extractFromMetaTag(metaTag, id, pageUrl, origUrl);
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

function extractFromMetaTag(metaTag: Element, id: string, pageUrl: string, tweetUrl: string): Post | undefined {
  const div = metaTag.parentElement;
  if (div == null) {
    return;
  }
  const article = div.getElementsByTagName('article');
  if (article.length !== 1) {
    console.warn(`[Data.ts] During extraction, multiple article. url: ${pageUrl}`);
  }
  const data = article[0];
  const aRoleLinks = data.querySelectorAll('a[role="link"]');
  const userName = mayRemoveAtSym(aRoleLinks[2].textContent ?? undefined);
  const fullName = aRoleLinks[1].textContent ?? undefined;
  const text = data.querySelector('div[data-testid="tweetText"]')?.textContent ?? undefined;
  const images = extractImages(data);

  return {
    user: {
      userName: userName,
      fullName: fullName
    },
    id: id,
    text: text,
    images: images,
    archiveUrl: pageUrl,
    tweetUrl: tweetUrl
  }
}

function extractFromMainRegion(mainRegion: Element, id: string, pageUrl: string, tweetUrl: string) {
  const name = getOneElementByClassName(mainRegion, 'fullname')?.textContent ?? undefined;
  const userName = mainRegion.querySelector('.username > b')?.textContent ?? undefined;
  const textRegion = mainRegion
    .querySelector<HTMLElement>('div.js-tweet-text-container > p')
  const text = textRegion == null ? undefined : extractText(textRegion);
  const images = extractImages(mainRegion);

  // TODO: correctly handle reply:
  if (images.length === 0 && isReply(mainRegion)) {
    console.log(`${pageUrl} is reply`);
    return;
  }

  return {
    user: {
      userName: userName,
      fullName: name,
    },
    id: id,
    text: text,
    images: images,
    archiveUrl: pageUrl,
    tweetUrl: tweetUrl
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

export function mayRemoveAtSym(str: string | undefined) {
  if (str?.charAt(0) === '@') {
    return str.substring(1, str.length);
  } else {
    return str;
  }
}
