import type { CdxItem, Post } from "twitter-data-parser";

export type CdxFetcher = (user: string) => Promise<CdxItem[]>;
export type PostFetcher = (user: string, item: CdxItem) => Promise<Post | undefined>;

export type MatchedPost = {
  post: Post;
  seedUser: string;
  depth: number;
};

export type KeywordMatchOptions = {
  seeds: string[];
  patterns: RegExp[];
  maxDepth: number;
  maxItems?: number;
  concurrency: number;
  fetchCdx: CdxFetcher;
  fetchPost: PostFetcher;
  onMatch?: (m: MatchedPost) => void;
  onUserStart?: (user: string, depth: number, total: number, selected: number, remaining: number | undefined) => void;
  onError?: (user: string, err: unknown) => void;
};

export async function matchKeyword(opts: KeywordMatchOptions): Promise<MatchedPost[]> {
  const visited = new Set<string>();
  const results: MatchedPost[] = [];
  const queue: Array<{ user: string; depth: number }> = [];
  const maxItems = opts.maxItems && opts.maxItems > 0 ? opts.maxItems : undefined;
  let inspectedItems = 0;

  for (const seed of opts.seeds) {
    const key = seed.toLowerCase();
    if (key && !visited.has(key)) {
      visited.add(key);
      queue.push({ user: seed, depth: 0 });
    }
  }

  while (queue.length > 0) {
    if (maxItems !== undefined && inspectedItems >= maxItems) break;

    const { user, depth } = queue.shift()!;

    let items: CdxItem[];
    try {
      items = await opts.fetchCdx(user);
    } catch (err) {
      opts.onError?.(user, err);
      continue;
    }

    if (items.length === 0) continue;

    const remainingBefore = maxItems === undefined ? undefined : Math.max(0, maxItems - inspectedItems);
    const selectedItems = remainingBefore === undefined ? items : items.slice(0, remainingBefore);
    inspectedItems += selectedItems.length;

    opts.onUserStart?.(
      user,
      depth,
      items.length,
      selectedItems.length,
      maxItems === undefined ? undefined : Math.max(0, maxItems - inspectedItems),
    );

    await forEachConcurrent(selectedItems, opts.concurrency, async (item) => {
      let post: Post | undefined;
      try {
        post = await opts.fetchPost(user, item);
      } catch (err) {
        opts.onError?.(user, err);
        return;
      }
      if (!post) return;

      if (depth < opts.maxDepth) {
        const target = post.replyInfo?.targetUser?.userName;
        if (target) {
          const key = target.toLowerCase();
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ user: target, depth: depth + 1 });
          }
        }
      }

      if (!testPatterns(opts.patterns, post.text ?? "")) return;

      const matched: MatchedPost = { post, seedUser: user, depth };
      results.push(matched);
      opts.onMatch?.(matched);
    });
  }

  return results;
}

function testPatterns(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => testPattern(pattern, text));
}

function testPattern(pattern: RegExp, text: string): boolean {
  // Reset state so /g and /y patterns don't carry lastIndex between calls.
  pattern.lastIndex = 0;
  return pattern.test(text);
}

async function forEachConcurrent<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    }),
  );
}
