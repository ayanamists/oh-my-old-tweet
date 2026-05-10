/* eslint-disable no-cond-assign, no-plusplus, no-useless-escape, no-param-reassign */

import React, { useEffect } from 'react';

type LinkOptions = {
  usernameLinkHref?: (username: string) => string;
  usernameLinkTarget?: string;
};

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function getGroups(str: string, regex: RegExp, index: number) {
  let m;
  const results = [];

  while ((m = regex.exec(str)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    if (m.length > 1) {
      results.push(m[index]);
    }
  }

  return results;
}

function findUsernames(str: string) {
  const regex = /([^a-zA-Z0-9_]|^)(@([a-zA-Z0-9_]+))/gm;
  return getGroups(str, regex, 3);
}

function findLinks(str: string) {
  const regex = /((\s|^)((((http|ftp|https):\/\/)*)([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])))/gm;
  return getGroups(str, regex, 3);
}

function findHashtags(str: string) {
  const regex = /([\s\W]|^)#(\w+)/gm;
  return getGroups(str, regex, 2);
}

function replaceLinks(str: string) {
  let finalStr = str;
  const links = findLinks(str);
  links.forEach((link) => {
    finalStr = finalStr.replace(
      link,
      `<a target="_blank" class="react-tweet-card--link-in-tweet" href="${link}">${link}</a>`,
    );
  });
  return finalStr;
}

function replaceUsernames(str: string, options: LinkOptions = {}) {
  let finalStr = str;
  const usernames = findUsernames(str);
  usernames.forEach((username) => {
    const href = options.usernameLinkHref?.(username) ?? `https://twitter.com/${username}`;
    const target = options.usernameLinkTarget ?? (options.usernameLinkHref ? undefined : '_blank');
    const targetAttr = target ? ` target="${escapeAttribute(target)}"` : '';
    const relAttr = target === '_blank' ? ' rel="noreferrer"' : '';
    finalStr = finalStr.replace(
      `@${username}`,
      `<a${targetAttr}${relAttr} class="react-tweet-card--username-in-tweet" href="${escapeAttribute(href)}">@${username}</a>`,
    );
  });
  return finalStr;
}

function replaceHashtags(str: string) {
  let finalStr = str;
  const hashtags = findHashtags(str);
  hashtags.forEach((hashtag) => {
    finalStr = finalStr.replace(
      `#${hashtag}`,
      `<a target="_blank" class="react-tweet-card--hashtag-in-tweet" href="https://twitter.com/hashtag/${hashtag}">#${hashtag}</a>`,
    );
  });
  return finalStr;
}

function replaceLinksUsernamesHashtags(el: HTMLElement, options: LinkOptions = {}) {
  el.innerHTML = replaceHashtags(replaceUsernames(replaceLinks(el.textContent || ''), options));
}

const useLinksUsernamesHashtags = (
  ref: React.RefObject<HTMLElement>,
  text: string,
  options: LinkOptions = {},
) => {
  useEffect(() => {
    if (ref?.current) {
      replaceLinksUsernamesHashtags(ref.current, options);
    }
  }, [ref, text, options.usernameLinkHref, options.usernameLinkTarget]);
};

export default useLinksUsernamesHashtags;
