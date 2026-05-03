import TweetCard from "react-tweet-card";
import { Post } from "twitter-data-parser";

interface TCardProps {
  p: Post;
  shareLink: string;
}

export function TCard({ p, shareLink }: TCardProps) {
  const name    = p.user.fullName ?? "";
  const text    = p.text ?? "";
  const theme   = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const textAll = p.replyInfo != null
    ? `Replying to @${p.replyInfo.targetUser.userName ?? ""}:\n${text}`
    : text;

  return (
    <TweetCard
      author={{
        name,
        username: p.user.userName ?? "",
        image: p.user.avatar ?? "",
      }}
      tweet={textAll}
      time={p.date}
      theme={theme}
      source="Twitter for iPhone"
      tweetImages={p.images.length === 0 ? undefined : p.images.map(i => ({ src: i }))}
      permalink={p.tweetUrl}
      archiveLink={p.archiveUrl}
      shareLink={shareLink}
    />
  );
}
