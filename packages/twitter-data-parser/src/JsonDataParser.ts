import { Post, User } from "./types";

export function parseUser(userJson: any): User {
  if (
    typeof userJson !== "object" ||
    !userJson ||
    typeof userJson.name !== "string" ||
    typeof userJson.id !== "string"
  ) {
    throw new Error("Invalid user JSON structure.");
  }

  return {
    fullName: userJson.name,
    avatar: userJson.profile_image_url,
    userName: userJson.username,
    id: userJson.id,
  };
}

export function parsePost1(json: any): Omit<Post, "archiveUrl"> {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid JSON object.");
  }

  const authorJson = json.includes.users.find(
    (u: any) => u.id === json.data.author_id
  );
  if (!authorJson) {
    throw new Error("Author not found in includes.users.");
  }
  const user: User = parseUser(authorJson);

  const replyTarget = json.data.referenced_tweets?.find(
    (tweet: any) => tweet.type === "replied_to"
  );
  const targetUserJson = replyTarget
    ? json.includes.users.find((u: any) => u.id === json.data.in_reply_to_user_id)
    : undefined;

  const replyInfo = replyTarget && targetUserJson
    ? {
      targetPostId: replyTarget.id,
      targetUser: parseUser(targetUserJson),
    }
    : undefined;

  const images = json.data.attachments?.media_keys?.map((key: string) => {
    const media = json.includes.media.find((m: any) => m.media_key === key);
    return media?.url || null;
  }).filter(Boolean);

  const video = json.includes.media?.find(
    (m: any) => m.type === "video"
  );

  const videoInfo = video
    ? {
      thumbUrl: video.preview_image_url,
    }
    : undefined;

  return {
    user,
    id: json.data.id,
    text: json.data.text,
    date: new Date(json.data.created_at),
    images: images || [],
    tweetUrl: `https://twitter.com/${user.userName}/status/${json.data.id}`,
    replyInfo,
    videoInfo,
  };
}

function parsePost2(data: any) {
  const createUser = (userData: any): User => ({
    fullName: userData.name,
    avatar: userData.profile_image_url_https,
    userName: userData.screen_name,
    id: userData.id_str,
  });

  const user: User = createUser(data.user);

  const replyInfo = data.in_reply_to_status_id && data.in_reply_to_screen_name
    ? {
      targetPostId: data.in_reply_to_status_id_str,
      targetUser: { userName: data.in_reply_to_screen_name }
    }
    : undefined;

  const videoInfo = data.extended_entities?.media?.[0]?.type === "video"
    ? {
      thumbUrl: data.extended_entities.media[0].media_url_https,
    }
    : undefined;

  const images: string[] =
    data.entities?.media?.map((media: any) => media.media_url_https) || [];

  const tweetUrl = `https://twitter.com/${user.userName}/status/${data.id_str}`;
  const archiveUrl = data.url || ""; // Using archive URL if provided in data

  const post = {
    user,
    id: data.id_str,
    text: data.text,
    date: new Date(data.created_at),
    images,
    tweetUrl,
    archiveUrl,
    replyInfo,
    videoInfo,
  };

  return post;
}


export function safeParsePost(json: any): Omit<Post, "archiveUrl"> | undefined {
  try {
    return parsePost1(json);
  } catch (_) {
    try {
      return parsePost2(json);
    } catch (_) {
      return undefined;
    }
  }
}
