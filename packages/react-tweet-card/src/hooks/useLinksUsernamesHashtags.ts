/* eslint-disable no-cond-assign, no-plusplus, no-useless-escape, no-param-reassign */

import React, { useEffect } from 'react';

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

function replaceUsernames(str: string) {
  let finalStr = str;
  const usernames = findUsernames(str);
  usernames.forEach((username) => {
    finalStr = finalStr.replace(
      `@${username}`,
      `<a target="_blank" class="react-tweet-card--username-in-tweet" href="https://twitter.com/${username}">@${username}</a>`,
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

function replaceLinksUsernamesHashtags(el: HTMLElement) {
  el.innerHTML = replaceHashtags(replaceUsernames(replaceLinks(el.textContent || '')));
}

const useLinksUsernamesHashtags = (ref: React.RefObject<HTMLElement>, text: string) => {
  useEffect(() => {
    if (ref?.current) {
      replaceLinksUsernamesHashtags(ref.current);
    }
  }, [ref, text]);
};

export default useLinksUsernamesHashtags;
