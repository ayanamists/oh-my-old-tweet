import User from "./User";

interface Post {
  user: User;
  id: string;
  text?: string;
  images: string[];
  tweetUrl: string;
  archiveUrl: string;
}

export default Post;