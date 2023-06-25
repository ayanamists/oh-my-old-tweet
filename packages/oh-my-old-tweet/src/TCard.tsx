import Post from "./Post"
import TweetCard from "react-tweet-card"

export function TCard({ p }: { p: Post }) {
  if (p.text == null) {
    return null
  }
  let name = p.user.fullName ?? "";
  return <TweetCard
    author={{
      name: name,
      username: name,
      image: ""
    }}
    tweet={p.text}
    time={new Date(2021, 2, 2, 21, 3)}
    source="Twitter for iPhone"
    tweetImages={p.images.map(i => { return { src: i } } )}
  />
}