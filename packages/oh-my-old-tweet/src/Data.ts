import Post from "./Post";
import getUrl from "./corsUrl";

// only for debugging
// type Data = {
//   name: string;
//   title: string;
//   user: string;
//   image_paths: string[];
// }

// export function getPosts(limit: number): Promise<Post[]> {
// const url = "http://localhost:5000/status/all"
// const req = `${url}/${limit}`
// return getData(req)
// }
// 
// export function getPostsByUser(id: string) {
// const url = "http://localhost:5000/status/user"
// const req = `${url}/${id}`
// return getData(req)
// }

// function getData(req: string) {
// return fetch(req)
// .then(res => res.json())
// .then(j => {
// let data = j as [Data]
// return data.map(i => new Post(new User(i.name, undefined), i.title,
// i.image_paths.map(p => {
// console.log(p)
// let img = new Image();
// let url = `http://localhost:5000${p}`;
// img.src = url;
// return ({ path: url, width: img.width, height: img.height });
// })))
// })
// }

export function filterUniqueCdxItems(cdxItems: string[][]) {
  const idSet = new Set<String>();
  const res: string[][] = [];
  cdxItems.forEach((i) => {
    const id = getCdxItemId(i);
    if (! idSet.has(id) && isValidCdxItem(i)) {
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
  const origUrl = getCdxItemUrl(cdxItem);
  const splitted = origUrl.split('/');
  const id = splitted[splitted.length - 1];
  return id;
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
    .then((res => res.text()))
    .then((res => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(res, 'text/html');

      const mainRegion = doc.querySelector('.permalink-tweet-container');
      if (mainRegion == null) {
        console.warn(`[Data.ts]: unable to find the main region. url: ${pageUrl}`);
        return;
      }

      const name = getOneElementByClassName(mainRegion, 'fullname')?.textContent ?? undefined;
      const userName = getOneElementByClassName(mainRegion, 'username')?.textContent ?? undefined;
      const text = mainRegion.querySelector<HTMLElement>('div.js-tweet-text-container > p')
        ?.firstChild
        ?.textContent ?? undefined;

      return {
        user: {
          userName: userName,
          fullName: name,
        },
        id: id,
        text: text,
        images: extractImages(mainRegion),
        origUrl: pageUrl
      };
    }))
    .catch(() => {
      console.log(`fail to load ${pageUrl}`);
      return undefined;
    });
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
      urls.push(images[i].src);
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
    const preLast = splitted[splitted.length - 2];
    return !last.match('deleted') && !preLast.match('profile') 
      && !splitted.includes('emoji');
  } else {
    return false;
  }
}