import { safeParsePost } from "./JsonDataParser";
import { parseDOM } from "./PolyfillDOMParser";
import { getWarn } from "./Utils";
import { Post, ReplyInfo, ProfileInfo } from "./types";

export type ArchiveTweetInfo = {
  id: string;
  timestamp: string;
  userName: string
};

type ArchiveTweetInfo1 = ArchiveTweetInfo & {
  tweetUrl: string,
  pageUrl: string,
  lang: string
};

export function getTweetUrlById(userName: string, id: string) {
  return `https://twitter.com/${userName}/status/${id}`;
}

export function getArchiveUrl({ id, timestamp, userName }: ArchiveTweetInfo) {
  return `https://web.archive.org/web/${timestamp}/${getTweetUrlById(userName, id)}`;
}

export function parsePost(data: string, { id, timestamp, userName }: ArchiveTweetInfo) : Post | undefined {
  try {
    const jsonData = JSON.parse(data);
    const parsed = safeParsePost(jsonData);
    if (parsed != null) {
      return {
        ...parsed,
        archiveUrl: getArchiveUrl({ id, timestamp, userName })
      };
    } else {
      return undefined;
    }
  } catch (_) {
    return parseHtmlPost(data, { id, timestamp, userName });
  }
}

export function parseHtmlPost(html: string, { id, timestamp, userName }: ArchiveTweetInfo) {
  const doc = parseDOM(html);

  const lang = doc.getElementsByTagName('html')[0].getAttribute('lang') ?? "en";
  const mainRegion = doc.querySelector('.permalink-tweet-container');
  const origUrl = getTweetUrlById(userName, id);
  const pageUrl = getArchiveUrl({ id: id, timestamp: timestamp, userName: userName });
  const internalInfo = {
    id: id,
    pageUrl: pageUrl,
    tweetUrl: origUrl,
    lang: lang,
    userName: userName,
    timestamp: timestamp
  };

  if (mainRegion != null) {
    return extractFromMainRegion(mainRegion, internalInfo);
  } else {
    const metaTag = findMetaTag(doc, id);
    if (metaTag != null) {
      return extractFromMetaTag(metaTag, internalInfo);
    } else {
      return;
    }
  }
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

function extractIdFromMetaTag(container: Element) {
  const author = container.querySelector('div[itemprop="author"]');
  const id = author?.querySelector('meta[itemprop="identifier"]')?.getAttribute('content') ?? undefined;
  return id;
}

function extractFromMetaTag(metaTag: Element, info: ArchiveTweetInfo1): Post | undefined {
  const div = metaTag.parentElement;
  if (div == null) {
    return;
  }
  const article = div.getElementsByTagName('article');
  if (article.length !== 1) {
    console.warn(getWarn(`During extraction, multiple article. url: ${info.pageUrl}`));
  }
  const data = article[0];
  const aRoleLinks = data.querySelectorAll('a[role="link"]');
  const userName = mayRemoveAtSym(aRoleLinks[2].textContent ?? undefined);
  const fullName = aRoleLinks[1].textContent ?? undefined;
  const text = data.querySelector('div[data-testid="tweetText"]')?.textContent ?? undefined;
  const id = extractIdFromMetaTag(data) // method 1, if <meta> is inside <article>
    ?? extractIdFromMetaTag(div)        // method 2, if <meta> is outside <article>
  const images = extractImages(data, info);
  const timeMeta = div.querySelector('meta[itemprop="datePublished"]')?.getAttribute('content');
  const time = new Date(timeMeta ?? 0);
  const avatarRegion = div.querySelector('div[data-testid="Tweet-User-Avatar"]');
  const avatar = filterValidAvatar(avatarRegion?.querySelector('img')?.getAttribute('src'), info);


  return {
    user: {
      userName: userName,
      fullName: fullName,
      avatar: avatar,
      id: id
    },
    id: info.id,
    text: text,
    images: images,
    archiveUrl: info.pageUrl,
    tweetUrl: info.tweetUrl,
    date: time
  }
}

function extractFromMainRegion(mainRegion: Element, info: ArchiveTweetInfo1): Post | undefined {
  const tweetRegion = getOneElementByClassName(mainRegion, 'tweet');
  const userId = tweetRegion?.getAttribute('data-user-id') ?? undefined;
  const name = getOneElementByClassName(mainRegion, 'fullname')?.textContent ?? undefined;
  const userName = mainRegion.querySelector('.username > b')?.textContent ?? undefined;
  const timeMsStr = mainRegion.querySelector('._timestamp')?.getAttribute('data-time-ms');
  const time = new Date(parseInt(timeMsStr ?? "0"));
  const textRegion = mainRegion
    .querySelector<HTMLElement>('div.js-tweet-text-container > p')
  const text = textRegion == null ? undefined : extractText(textRegion);
  const images = extractImages(mainRegion, info);

  const avatarRegion = mainRegion.querySelector('img.avatar');
  const avatar = filterValidAvatar(avatarRegion?.getAttribute('src'), info);
  const profileInfo = extractProfileInfo(mainRegion.ownerDocument);

  const videoThumbDiv = mainRegion.querySelector('div.PlayableMedia-player');
  const videoThumbUrlWithQuote = videoThumbDiv?.getAttribute('style')?.match(/url\((.+)\)/)?.[1];
  const videoThumbUrl = videoThumbUrlWithQuote?.slice(1, -1);

  // TODO: correctly handle reply:
  let replyInfo: ReplyInfo | undefined = undefined;
  if (isReply(mainRegion)) {
    const parent = mainRegion.parentElement;
    if (parent != null) {
      const permalinkInReplyTo = getOneElementByClassName(parent, 'permalink-inner in-reply-to');
      const targetId = permalinkInReplyTo?.getAttribute('data-replied-tweet-id') ?? undefined;
      const mainReplyRegion = permalinkInReplyTo?.querySelector(`div[data-tweet-id="${targetId}"]`);
      if (mainReplyRegion != null) {
        const rUserName = mainReplyRegion.getAttribute('data-screen-name') ?? undefined;
        const rid = mainReplyRegion.getAttribute('data-user-id') ?? undefined;
        replyInfo = {
          targetUser: {
            userName: rUserName,
            id: rid
          },
          targetPostId: targetId
        }
      } else {
        // we cannot find the target post, it may be deleted
        // but we may still extract data from the classes of the tweetRegion
        const dataReplyToUsersJson = tweetRegion?.getAttribute('data-reply-to-users-json');
        if (dataReplyToUsersJson != null) {
          const replyToUsers = JSON.parse(dataReplyToUsersJson);
          const targetUser = replyToUsers.filter((i: any) => i.id_str !== userId)[0];
          replyInfo = {
            targetUser: {
              userName: targetUser.screen_name,
              id: targetUser.id_str
            }
          }
        } else {
          // finally method, use the data-mentions attribute
          const dataMentions = tweetRegion?.getAttribute('data-mentions');
          if (dataMentions != null) {
            const mentions = dataMentions.split(' ');
            const targetUser = mentions.filter((i) => i !== userName)[0];
            replyInfo = {
              targetUser: {
                userName: targetUser,
                id: undefined
              }
            }
          }
        }
      }
    }
  }

  return {
    user: {
      userName: userName,
      fullName: name,
      avatar: avatar,
      id: userId,
      profileInfo: profileInfo,
    },
    id: info.id,
    text: text,
    images: images,
    archiveUrl: info.pageUrl,
    tweetUrl: info.tweetUrl,
    date: time,
    replyInfo: replyInfo,
    ...(videoThumbUrl && { videoInfo: { thumbUrl: videoThumbUrl } })
  };
}

function extractProfileInfo(document: Document): ProfileInfo | undefined {
  const bioElement = document.querySelector('.ProfileHeaderCard-bio');
  const locationElement = document.querySelector('.ProfileHeaderCard-locationText');
  const bigAvatarElement = document.querySelector('.ProfileAvatar-image');
  const urlElement = document.querySelector('.ProfileHeaderCard-urlText a');
  const profileImageElement = document.querySelector('.ProfileCanopy-headerBg img');
  const joinedElement = document.querySelector('.ProfileHeaderCard-joinDateText');

  if (!bioElement) return undefined;

  const text = bioElement.textContent?.trim() || '';
  const location = locationElement?.textContent?.trim() || undefined;
  const bigAvatar = bigAvatarElement?.getAttribute('src') || undefined;
  const image = profileImageElement?.getAttribute('src') || undefined;
  const joined = joinedElement?.getAttribute('title') || undefined;

  const urls: string[] = [];
  if (urlElement && urlElement.getAttribute('href')) {
    const href = urlElement.getAttribute('href') || '';
    // Extract the actual URL, not the archive URL
    const urlMatch = href.match(/https:\/\/web\.archive\.org\/web\/\d+\/(https?:\/\/.+)/);
    urls.push(urlMatch ? urlMatch[1] : href);
  }

  return {
    text,
    location,
    bigAvatar,
    image,
    joined,
    urls: urls.length > 0 ? urls : undefined
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
    } else if (!nodeA.classList.contains('u-hidden')) {
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

function extractImages(mainRegion: Element, info: ArchiveTweetInfo1) {
  const images = mainRegion.getElementsByTagName('img');
  const urls = [];
  for (let i = 0; i < images.length; ++i) {
    if (isValidImgTag(images[i])) {
      urls.push(fixImageUrl(images[i].src, info));
    }
  }
  return urls;
}

function isValidImgTag(tag: HTMLImageElement) {
  const stage1 = !tag.classList.contains('avatar') && !tag.classList.contains('twitter-hashflag') && tag.src
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

function filterValidAvatar(url: string | undefined | null, info: ArchiveTweetInfo1) {
  if (url == null) {
    return undefined;
  } else {
    if (url.split('/').some(i => i.match('deleted'))) {
      return undefined;
    } else {
      return fixImageUrl(url, info);
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

function fixImageUrl(url: string, info: { timestamp: string }) {
  const urlObj = new URL(url);
  if (urlObj.hostname !== "web.archive.org") {
    return `https://web.archive.org/web/${info.timestamp}im_/${url}`
  } else {
    return toHttps(url);
  }
}

export function mayRemoveAtSym(str: string | undefined) {
  if (str?.charAt(0) === '@') {
    return str.substring(1, str.length);
  } else {
    return str;
  }
}
