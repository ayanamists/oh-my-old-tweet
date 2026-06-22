import { useContext } from "react";
import TweetCard from "react-tweet-card";
import { Post } from "twitter-data-parser";
import { ConfigContext } from "./context/ConfigContext";
import { buildMediaCacheUrl } from "./corsUrl";

interface TCardProps {
  p: Post;
  shareLink: string;
  linkUsersInternally?: boolean;
}

function getInternalUserHref(username: string) {
  return `#/${encodeURIComponent(username)}`;
}

export function TCard({ p, shareLink, linkUsersInternally = true }: TCardProps) {
  const { config } = useContext(ConfigContext);
  const name    = p.user.fullName ?? "";
  const username = p.user.userName ?? "";
  const text    = p.text ?? "";
  const theme   = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const textAll = p.replyInfo != null
    ? `Replying to @${p.replyInfo.targetUser.userName ?? ""}:\n${text}`
    : text;
  const profileLinkHref = linkUsersInternally && username
    ? getInternalUserHref(username)
    : undefined;

  return (
    <TweetCard
      className="omot-tweet-card"
      author={{
        name,
        username,
        image: buildMediaCacheUrl(config, p.user.avatar),
      }}
      tweet={textAll}
      time={p.date}
      theme={theme}
      source="Twitter for iPhone"
      tweetImages={p.images.length === 0 ? undefined : p.images.map(i => ({ src: buildMediaCacheUrl(config, i) }))}
      permalink={p.tweetUrl}
      archiveLink={p.archiveUrl}
      shareLink={shareLink}
      clickableProfileLink={Boolean(profileLinkHref)}
      profileLinkHref={profileLinkHref}
      usernameLinkHref={linkUsersInternally ? getInternalUserHref : undefined}
    />
  );
}
