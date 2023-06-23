import User from "./User";

class Post {
    user: User;
    text: string;
    image_urls: URL[];

    constructor(user: User, text: string, image_urls: URL[]) {
        this.user = user;
        this.text = text;
        this.image_urls = image_urls;
    }
};

export default Post;