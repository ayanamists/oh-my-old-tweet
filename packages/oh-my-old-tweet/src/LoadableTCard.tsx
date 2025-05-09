import { useContext, useRef, useState } from "react";
import { Post } from "twitter-data-parser";
import { TCard } from "./TCard";
import useCachedFetch from "./useCachedFetch";
import { FilterContext, TweetFilter } from "./context/FilterContext";
import { MinimalCdxInfo, getArchivePageUrl, getShareLink } from "./Data";

function implies(a: boolean, b: boolean) {
  return !a || b;
}

function evaluateFilter(post: Post, filter: TweetFilter) {
  const contentTypeCond =
    filter.contentBelongTo.includes("reply") && post.replyInfo != null ||
    filter.contentBelongTo.includes("post") && post.replyInfo == null;
  const imageCond = implies(filter.mustContainImage, post.images.length > 0);
  return contentTypeCond && imageCond;
}

function postBelongToUser(post: Post, user: string) {
  return post.user.userName === user;
}

export function LoadableTCard({ user, cdxItem }: {
  user: string,
  cdxItem: MinimalCdxInfo
}) {
  const [post, setPost] = useState<Post | boolean>();

  const elementRef = useRef<HTMLDivElement>(null);

  useCachedFetch(cdxItem, setPost);

  // const pageUrl = getCdxItemUrl(cdxItem);
  const { tweetFilter } = useContext(FilterContext);
  const hidePost = post != null &&
    (post === false || post === true || !evaluateFilter(post, tweetFilter)
      || !postBelongToUser(post, user));
  return (<div ref={elementRef}>
    {
      (post == null)
        ? <div style={{ height: '200px' }}
          className="text-black dark:text-white text-center flex flex-col item-center justify-center">
          Loading ...
          <a href={getArchivePageUrl(cdxItem)}
            className="text-tw-blue underline dark:text-blue-500 hover:no-underline"
            target="_blank" rel="noopener noreferrer">
            Tweet id: {cdxItem.id}
          </a>
        </div>
        : hidePost ? null
          : <TCard p={post} shareLink={getShareLink(user, cdxItem)} />
    }
  </div>);
}
