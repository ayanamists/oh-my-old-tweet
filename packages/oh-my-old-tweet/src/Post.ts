import User from "./User";

interface Post {
  user: User;
  text?: string;
  images: string[];
  origUrl: string;
}

export default Post;