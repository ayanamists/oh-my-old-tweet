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

export function getCdxList(user: string) {
  const req = `twitter.com/${user}/`
  return fetch(getUrl(`https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`))
    .then(res => res.json())
    .then(j => j as string[][]);
}

export function getOnePage(cdxItem: string[]) {
  const timeStamp = cdxItem[1];
  const origUrl = cdxItem[2];
  const pageUrl = `https://web.archive.org/web/${timeStamp}/${origUrl}`;
  return fetch(getUrl(pageUrl))
    .then((res => res.text()))
    .then((res => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(res, 'text/html');

      const mainRegion = doc.querySelector('.permalink-tweet-container');
      if (mainRegion == null) {
        console.log(pageUrl);
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
        text: text,
        images: extractImages(mainRegion),
        origUrl: pageUrl
      };
    }))
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