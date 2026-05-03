import { useCallback, useContext, useState } from "react";
import { Post } from "twitter-data-parser";
import { TCard } from "./TCard";
import { FilterContext } from "./context/FilterContext";
import useCachedFetch from "./useCachedFetch";
import { getShareLink, MinimalCdxInfo } from "./Data";
import { SkeletonCard } from "./SkeletonCard";

export function LoadableTCard({ user, cdxItem, onProfileLoaded }: {
  user: string,
  cdxItem: MinimalCdxInfo,
  onProfileLoaded?: (post: Post) => void
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { tweetFilter } = useContext(FilterContext);
  const [shouldShow, setShouldShow] = useState(true);

  const processData = useCallback((p: Post | boolean) => {
    setLoading(false);

    if (typeof p === 'boolean') {
      if (!p) setFailed(true);
      return;
    }

    setPost(p);

    const isSameUser = p.user.userName === user;
    if (onProfileLoaded && isSameUser) onProfileLoaded(p);

    const isReply  = p.replyInfo !== undefined;
    const isPost   = !isReply;
    const hasImage = p.images && p.images.length > 0;

    const contentTypeMatch = (
      (isReply && tweetFilter.contentBelongTo.includes("reply")) ||
      (isPost  && tweetFilter.contentBelongTo.includes("post"))
    );
    const imageFilterMatch = !tweetFilter.mustContainImage || hasImage;

    setShouldShow(contentTypeMatch && imageFilterMatch && isSameUser);
  }, [onProfileLoaded, tweetFilter, user]);

  useCachedFetch(cdxItem, processData);

  if (loading) return <SkeletonCard />;

  if (failed) {
    return (
      <div className="border border-destructive/30 rounded-lg px-4 py-3 my-3 bg-card text-muted-foreground text-sm flex items-center gap-2">
        <span className="text-destructive text-base">⚠</span>
        Failed to load this tweet from archive.
      </div>
    );
  }

  if (!shouldShow || !post) return null;

  return (
    <div className="my-3">
      <TCard p={post} shareLink={getShareLink(user, cdxItem)} />
    </div>
  );
}
