export type User = {
  fullName?: string;
  avatar?: string;
  userName?: string;
  id?: string;
  profileInfo?: ProfileInfo;
}

export type ReplyInfo = {
  targetPostId?: string,
  targetUser: User,
}

export type VideoInfo = {
  thumbUrl: string,
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
  videoInfo?: VideoInfo;
}

export interface ProfileInfo {
  text: string;
  image?: string;
  bigAvatar?: string;
  location?: string;
  urls?: string[];
  followers?: number;
  following?: number;
  joined?: string;
}
