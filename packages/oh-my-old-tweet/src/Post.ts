import User from "./User";

export type ReplyInfo = {
  targetPostId?: string,
  targetUser: User,
}

interface Post {
  user: User;
  id: string;
  text?: string;
  date: Date;
  images: string[];
  tweetUrl: string;
  archiveUrl: string;
  replyInfo?: ReplyInfo;
}

export default Post;