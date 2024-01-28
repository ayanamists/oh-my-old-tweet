import { useTheme } from "@mui/material";
import TweetCard from "react-tweet-card"
import { Post } from "twitter-data-parser";

interface TCardProps {
  p: Post;
  shareLink: string
}

export function TCard({ p, shareLink }: TCardProps) {
  let name = p.user.fullName ?? "";
  const text = p.text ?? "";
  const theme = useTheme().palette.mode;
  const textAll = p.replyInfo != null ? `Replying to @${p.replyInfo.targetUser.userName ?? ""}:\n${text}` : text
  return (<TweetCard
    author={{
      name: name,
      username: p.user.userName ?? "",
      image: p.user.avatar ?? ""
    }}
    tweet={textAll}
    time={p.date}
    theme={theme}
    source="Twitter for iPhone"
    tweetImages={p.images.length === 0 ?
      undefined : p.images.map(i => { return { src: i } })}
    permalink={p.tweetUrl}
    archiveLink={p.archiveUrl}
    shareLink={shareLink}
  />);
}