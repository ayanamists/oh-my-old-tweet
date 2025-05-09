import { useContext, useEffect, useState } from "react";
import { CdxItem, Post, getPost } from "twitter-data-parser";
import { ConfigContext } from "./context/ConfigContext";
import { TCard } from "./TCard";
import { Box, CircularProgress, Paper } from "@mui/material";
import { FilterContext } from "./context/FilterContext";

export function LoadableTCard({ user, cdxItem, onProfileLoaded }: { 
  user: string, 
  cdxItem: CdxItem,
  onProfileLoaded?: (post: Post) => void 
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { config } = useContext(ConfigContext);
  const { tweetFilter } = useContext(FilterContext);
  const [shouldShow, setShouldShow] = useState(true);

  useEffect(() => {
    getPost(config!, user, cdxItem).then((p) => {
      setPost(p);
      setLoading(false);
      
      // Call the onProfileLoaded callback if provided
      if (onProfileLoaded && p) {
        onProfileLoaded(p);
      }
      
      // Filter logic
      const isReply = p.replyInfo !== undefined;
      const isPost = !isReply;
      const hasImage = p.images.length > 0;
      
      // Content type filter
      const contentTypeMatch = (
        (isReply && tweetFilter.contentBelongTo.includes("reply")) ||
        (isPost && tweetFilter.contentBelongTo.includes("post"))
      );
      
      // Image filter
      const imageFilterMatch = !tweetFilter.mustContainImage || hasImage;
      
      setShouldShow(contentTypeMatch && imageFilterMatch);
    });
  }, [config, user, cdxItem, tweetFilter, onProfileLoaded]);

  if (loading) {
    return (
      <Paper sx={{ p: 2, my: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (!shouldShow || !post) {
    return null;
  }

  return (
    <Box sx={{ my: 2 }}>
      <TCard post={post} />
    </Box>
  );
}
