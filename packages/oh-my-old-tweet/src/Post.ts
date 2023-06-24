import User from "./User";

interface ImageData {
  path: string;
  width: number;
  height: number;
}

class Post {
    user: User;
    text: string;
    images: ImageData[];

    constructor(user: User, text: string, image_urls: ImageData[]) {
        this.user = user;
        this.text = text;
        this.images = image_urls;
    }
};

export default Post;