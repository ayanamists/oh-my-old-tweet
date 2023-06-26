import { getOnePage } from "./Data";
import Post from "./Post";

const data: Map<number, Post | boolean> = new Map();
let postIndex: string[][] = [];

export function initPosts(posts: string[][]) {
  postIndex = posts;
}

export function isLoaded(index: number) {
  return data.has(index);
}

export function isLoadingSuccess(index: number) {
  return !!data.get(index);
}

export function getPost(index: number): Post {
  if (data.has(index)) {
    return data.get(index) as Post;
  } else {
    throw new Error(`${index} not in posts, why this function is called?`);
  }
}

export async function loadPosts(start: number, end: number) {
  await Promise.all(postIndex.slice(start, end).map(async (i, idx, _) => {
    const p = await getOnePage(i);
    data.set(idx, p ?? false);
  }));
}
