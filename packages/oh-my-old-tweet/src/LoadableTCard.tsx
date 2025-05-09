import { useCallback, useContext, useState } from "react";
import { Post } from "twitter-data-parser";
import { TCard } from "./TCard";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import { FilterContext } from "./context/FilterContext";
import useCachedFetch from "./useCachedFetch";
import { getShareLink, MinimalCdxInfo } from "./Data";

export function LoadableTCard({ user, cdxItem, onProfileLoaded }: {
  user: string,
  cdxItem: MinimalCdxInfo,
  onProfileLoaded?: (post: Post) => void
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { tweetFilter } = useContext(FilterContext);
  const [shouldShow, setShouldShow] = useState(true);

  const processPost = useCallback((p: Post) => {
    setPost(p);
    setLoading(false);

    const isSameUser = p && p.user.userName === user;
    if (onProfileLoaded && p && isSameUser) {
      onProfileLoaded(p);
    }

    // Filter logic
    const isReply = p.replyInfo !== undefined;
    const isPost = !isReply;
    const hasImage = p.images && p.images.length > 0;

    // Content type filter
    const contentTypeMatch = (
      (isReply && tweetFilter.contentBelongTo.includes("reply")) ||
      (isPost && tweetFilter.contentBelongTo.includes("post"))
    );

    // Image filter
    const imageFilterMatch = !tweetFilter.mustContainImage || hasImage;

    setShouldShow(contentTypeMatch && imageFilterMatch && isSameUser);
  }, [onProfileLoaded, tweetFilter]);

  useCachedFetch(cdxItem, processPost);

  if (loading) {
    return (
      <Paper sx={{ p: 2, my: 2, display: 'flex', justifyContent: 'center' }}>
        <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
          Loading from archive : {cdxItem.origUrl}
        </Typography>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (!shouldShow || !post) {
    return null;
  }

  return (
    <Box sx={{ my: 2 }}>
      <TCard p={post} shareLink={getShareLink(user, cdxItem)} />
    </Box>
  );
}
