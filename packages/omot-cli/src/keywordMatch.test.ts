import type { CdxItem, Post, User } from "twitter-data-parser";
import { matchKeyword, MatchedPost } from "./keywordMatch";

function cdxItem(id: string): CdxItem {
  return {
    urlKey: `com,twitter)/u/status/${id}`,
    timestamp: "20100101000000",
    original: `https://twitter.com/u/status/${id}`,
    mimetype: "text/html",
    statusCode: 200,
    digest: id,
    id,
    date: new Date("2010-01-01T00:00:00Z"),
  } as CdxItem;
}

function makePost(opts: { id: string; user: string; text: string; replyTo?: User }): Post {
  return {
    user: { userName: opts.user, id: `id-${opts.user}` },
    id: opts.id,
    text: opts.text,
    date: new Date("2010-01-01T00:00:00Z"),
    images: [],
    tweetUrl: `https://twitter.com/${opts.user}/status/${opts.id}`,
    archiveUrl: `https://web.archive.org/web/20100101/${opts.user}/${opts.id}`,
    replyInfo: opts.replyTo ? { targetUser: opts.replyTo } : undefined,
  } as Post;
}

type Fixture = Record<string, Post[]>;

function fixtures(data: Fixture) {
  const cdxCalls: string[] = [];
  const postCalls: Array<{ user: string; id: string }> = [];

  const fetchCdx = jest.fn(async (user: string): Promise<CdxItem[]> => {
    cdxCalls.push(user);
    const posts = data[user.toLowerCase()];
    if (!posts) return [];
    return posts.map((p) => cdxItem(p.id));
  });

  const fetchPost = jest.fn(async (user: string, item: CdxItem): Promise<Post | undefined> => {
    postCalls.push({ user, id: item.id });
    const posts = data[user.toLowerCase()] ?? [];
    return posts.find((p) => p.id === item.id);
  });

  return { fetchCdx, fetchPost, cdxCalls, postCalls };
}

describe("matchKeyword", () => {
  it("returns posts whose text matches the regex", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", text: "hello world" }),
        makePost({ id: "2", user: "alice", text: "another thing" }),
        makePost({ id: "3", user: "alice", text: "world peace" }),
      ],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/world/],
      maxDepth: 0,
      concurrency: 4,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "3"]);
    expect(results.every((r) => r.depth === 0)).toBe(true);
    expect(results.every((r) => r.seedUser === "alice")).toBe(true);
  });

  it("returns no results when nothing matches", async () => {
    const fx = fixtures({
      alice: [makePost({ id: "1", user: "alice", text: "hello" })],
    });

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/banana/],
      maxDepth: 1,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results).toEqual([]);
  });

  it("matches when any pattern matches", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", text: "banana split" }),
        makePost({ id: "2", user: "alice", text: "cherry pie" }),
        makePost({ id: "3", user: "alice", text: "plain toast" }),
      ],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/banana/, /cherry/],
      maxDepth: 0,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "2"]);
  });

  it("recursively expands via reply target users even when the source post does not match", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          text: "not the thing, but replying to bob",
          replyTo: { userName: "bob", id: "id-bob" },
        }),
        makePost({ id: "2", user: "alice", text: "no hit here" }),
      ],
      bob: [
        makePost({ id: "10", user: "bob", text: "MATCH from bob" }),
        makePost({ id: "11", user: "bob", text: "irrelevant" }),
      ],
    };
    const fx = fixtures(data);
    const userStarts: string[] = [];

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/MATCH/],
      maxDepth: 1,
      concurrency: 4,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
      onUserStart: (user) => userStarts.push(user),
    });

    expect(userStarts).toEqual(["alice", "bob"]);
    const ids = results.map((r) => r.post.id).sort();
    expect(ids).toEqual(["10"]);
    const bobMatch = results.find((r) => r.seedUser === "bob")!;
    expect(bobMatch.depth).toBe(1);
  });

  it("does not expand past maxDepth=0", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          text: "MATCH",
          replyTo: { userName: "bob", id: "id-bob" },
        }),
      ],
      bob: [makePost({ id: "10", user: "bob", text: "MATCH" })],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/MATCH/],
      maxDepth: 0,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id)).toEqual(["1"]);
    expect(fx.cdxCalls).toEqual(["alice"]);
  });

  it("does not revisit users in cycles", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          text: "MATCH",
          replyTo: { userName: "bob", id: "id-bob" },
        }),
      ],
      bob: [
        makePost({
          id: "10",
          user: "bob",
          text: "MATCH",
          replyTo: { userName: "Alice", id: "id-alice" },
        }),
      ],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/MATCH/],
      maxDepth: 5,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "10"]);
    expect(fx.cdxCalls.map((u) => u.toLowerCase()).sort()).toEqual(["alice", "bob"]);
  });

  it("processes multiple seeds and dedupes case-insensitively", async () => {
    const data: Fixture = {
      alice: [makePost({ id: "1", user: "alice", text: "yes hit" })],
      bob: [makePost({ id: "2", user: "bob", text: "yes" })],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice", "Alice", "bob"],
      patterns: [/yes/],
      maxDepth: 0,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "2"]);
    expect(fx.cdxCalls.length).toBe(2);
  });

  it("limits the total inspected CDX items across users", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", text: "hit 1" }),
        makePost({ id: "2", user: "alice", text: "hit 2" }),
        makePost({ id: "3", user: "alice", text: "hit 3" }),
      ],
      bob: [makePost({ id: "10", user: "bob", text: "hit bob" })],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice", "bob"],
      patterns: [/hit/],
      maxDepth: 0,
      maxItems: 2,
      concurrency: 4,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "2"]);
    expect(fx.postCalls.map((c) => c.id).sort()).toEqual(["1", "2"]);
    expect(fx.cdxCalls).toEqual(["alice"]);
  });

  it("survives fetch errors and reports them via onError", async () => {
    const fetchCdx = jest.fn(async (user: string): Promise<CdxItem[]> => {
      if (user === "broken") throw new Error("cdx boom");
      return [cdxItem("1"), cdxItem("2")];
    });
    const fetchPost = jest.fn(async (user: string, item: CdxItem): Promise<Post | undefined> => {
      if (item.id === "2") throw new Error("post boom");
      return makePost({ id: item.id, user, text: "MATCH" });
    });
    const errors: Array<{ user: string; err: string }> = [];

    const results = await matchKeyword({
      seeds: ["broken", "alice"],
      patterns: [/MATCH/],
      maxDepth: 0,
      concurrency: 2,
      fetchCdx,
      fetchPost,
      onError: (user, err) => errors.push({ user, err: (err as Error).message }),
    });

    expect(results.map((r) => r.post.id)).toEqual(["1"]);
    expect(errors).toEqual([
      { user: "broken", err: "cdx boom" },
      { user: "alice", err: "post boom" },
    ]);
  });

  it("works correctly with a /g regex across multiple texts", async () => {
    // /g regexes carry lastIndex; matchKeyword must reset it per call.
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", text: "abc abc abc" }),
        makePost({ id: "2", user: "alice", text: "abc" }),
        makePost({ id: "3", user: "alice", text: "abc" }),
      ],
    };
    const fx = fixtures(data);

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/abc/g],
      maxDepth: 0,
      concurrency: 1,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(results.map((r) => r.post.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("fires onMatch for every match in order", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", text: "M" }),
        makePost({ id: "2", user: "alice", text: "skip" }),
        makePost({ id: "3", user: "alice", text: "M" }),
      ],
    };
    const fx = fixtures(data);
    const seen: MatchedPost[] = [];

    const results = await matchKeyword({
      seeds: ["alice"],
      patterns: [/^M$/],
      maxDepth: 0,
      concurrency: 1,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
      onMatch: (m) => seen.push(m),
    });

    expect(seen.length).toBe(2);
    expect(seen.map((m) => m.post.id)).toEqual(results.map((r) => r.post.id));
  });
});
