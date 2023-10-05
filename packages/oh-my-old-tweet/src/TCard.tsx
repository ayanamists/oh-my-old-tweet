import TweetCard from "react-tweet-card"
import { Post } from "twitter-data-parser";

export function TCard({ p }: { p: Post }) {
  let name = p.user.fullName ?? "";
  const text = p.text ?? "";
  const textAll = p.replyInfo != null ? `Replying to @${p.replyInfo.targetUser.userName ?? ""}:\n${text}` : text
  return (<TweetCard
    author={{
      name: name,
      username: p.user.userName ?? "",
      image: p.user.avatar ?? ""
    }}
    tweet={textAll}
    time={p.date}
    source="Twitter for iPhone"
    tweetImages={p.images.length === 0 ?
      undefined : p.images.map(i => { return { src: i } })}
    permalink={p.tweetUrl}
    archiveLink={p.archiveUrl}
  />);
}