import { useContext, useRef, useState } from "react";
import { Post } from "twitter-data-parser";
import { TCard } from "./TCard";
import useCachedFetch from "./useCachedFetch";
import { ShowReplyContext } from "./context/ShowReplyContext";
import { MinimalCdxInfo, getArchivePageUrl, getShareLink } from "./Data";

export function LoadableTCard({ user, cdxItem }: { 
  user: string, 
  cdxItem: MinimalCdxInfo }) {
  const [post, setPost] = useState<Post | boolean>();

  const elementRef = useRef<HTMLDivElement>(null);

  useCachedFetch(cdxItem, setPost);

  // const pageUrl = getCdxItemUrl(cdxItem);
  const { showReply } = useContext(ShowReplyContext);
  return (<div ref={elementRef}>
    {
      (post === false || post === true || (! showReply && post?.replyInfo != null)
        || (post != null && (post.user.userName?.toLowerCase() ?? "") !== user.toLocaleLowerCase()))? null :
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
          : <TCard p={post} shareLink={getShareLink(user, cdxItem)} />
    }
  </div>);
}
