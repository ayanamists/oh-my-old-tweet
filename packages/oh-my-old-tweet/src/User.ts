class User {
  name?: string;

  avatar?: URL;

  constructor(name: string, avatar?: URL) {
    this.name = name;
    this.avatar = avatar;
  }
}

export default User;