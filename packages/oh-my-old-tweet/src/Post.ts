import User from "./User";

interface Post {
  user: User;
  id: string;
  text?: string;
  images: string[];
  origUrl: string;
}

export default Post;