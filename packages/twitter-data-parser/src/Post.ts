import { User } from "./User";

export type ReplyInfo = {
  targetPostId?: string,
  targetUser: User,
}

export interface Post {
  user: User;
  id: string;
  text?: string;
  date: Date;
  images: string[];
  tweetUrl: string;
  archiveUrl: string;
  replyInfo?: ReplyInfo;
}
