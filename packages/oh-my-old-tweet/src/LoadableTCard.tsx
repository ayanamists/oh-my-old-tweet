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
      <div className="my-3 flex min-w-0 items-center gap-2 rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="text-destructive text-base">⚠</span>
        <span className="min-w-0 break-words">Failed to load this tweet from archive.</span>
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
