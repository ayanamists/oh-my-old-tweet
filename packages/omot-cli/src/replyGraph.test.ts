import type { CdxItem, Post, User } from "twitter-data-parser";
import { buildReplyGraph, serializeGraphML, ReplyGraph } from "./replyGraph";

function cdxItem(id: string, dateIso = "2010-01-01T00:00:00Z"): CdxItem {
  return {
    urlKey: `com,twitter)/u/status/${id}`,
    timestamp: dateIso.replace(/[-:TZ.]/g, "").slice(0, 14),
    original: `https://twitter.com/u/status/${id}`,
    mimetype: "text/html",
    statusCode: 200,
    digest: id,
    id,
    date: new Date(dateIso),
  } as CdxItem;
}

function makePost(opts: {
  id: string;
  user: string;
  userId?: string;
  text?: string;
  date?: string;
  replyTo?: User;
}): Post {
  return {
    user: { userName: opts.user, id: opts.userId ?? `id-${opts.user}` },
    id: opts.id,
    text: opts.text ?? "",
    date: new Date(opts.date ?? "2010-01-01T00:00:00Z"),
    images: [],
    tweetUrl: `https://twitter.com/${opts.user}/status/${opts.id}`,
    archiveUrl: `https://web.archive.org/web/${opts.id}/${opts.user}`,
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
    return posts.map((p) => cdxItem(p.id, p.date.toISOString()));
  });

  const fetchPost = jest.fn(async (user: string, item: CdxItem): Promise<Post | undefined> => {
    postCalls.push({ user, id: item.id });
    const posts = data[user.toLowerCase()] ?? [];
    return posts.find((p) => p.id === item.id);
  });

  return { fetchCdx, fetchPost, cdxCalls, postCalls };
}

describe("buildReplyGraph", () => {
  it("captures outgoing reply edges with interaction details", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          replyTo: { userName: "bob", id: "id-bob" },
          date: "2010-03-01T12:00:00Z",
        }),
        makePost({
          id: "2",
          user: "alice",
          replyTo: { userName: "bob", id: "id-bob" },
          date: "2010-04-01T12:00:00Z",
        }),
        makePost({
          id: "3",
          user: "alice",
          replyTo: { userName: "carol", id: "id-carol" },
          date: "2010-05-01T12:00:00Z",
        }),
      ],
    };
    const fx = fixtures(data);

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 0,
      concurrency: 4,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(graph.rootUser).toBe("alice");
    expect(Object.keys(graph.nodes).sort()).toEqual(["alice", "bob", "carol"]);
    expect(graph.nodes["alice"].postCount).toBe(3);
    expect(graph.nodes["alice"].id).toBe("id-alice");
    expect(graph.nodes["bob"].id).toBe("id-bob");

    expect(graph.edges).toHaveLength(2);
    const ab = graph.edges.find((e) => e.target === "bob")!;
    expect(ab.source).toBe("alice");
    expect(ab.interactions.map((i) => i.postId).sort()).toEqual(["1", "2"]);
    const ac = graph.edges.find((e) => e.target === "carol")!;
    expect(ac.interactions).toHaveLength(1);
  });

  it("expands via reply targets when depth > 0 (yielding reciprocal edges)", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          replyTo: { userName: "bob", id: "id-bob" },
        }),
      ],
      bob: [
        makePost({
          id: "10",
          user: "bob",
          replyTo: { userName: "alice", id: "id-alice" },
        }),
        makePost({
          id: "11",
          user: "bob",
          replyTo: { userName: "carol", id: "id-carol" },
        }),
      ],
    };
    const fx = fixtures(data);

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 1,
      concurrency: 4,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(fx.cdxCalls.map((u) => u.toLowerCase()).sort()).toEqual(["alice", "bob"]);
    const sources = graph.edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(sources).toEqual(["alice->bob", "bob->alice", "bob->carol"]);
  });

  it("skips self-replies (no self-loop edges)", async () => {
    const data: Fixture = {
      alice: [
        makePost({
          id: "1",
          user: "alice",
          replyTo: { userName: "Alice", id: "id-alice" },
        }),
        makePost({
          id: "2",
          user: "alice",
          replyTo: { userName: "bob", id: "id-bob" },
        }),
      ],
    };
    const fx = fixtures(data);

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 0,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(graph.edges.map((e) => `${e.source}->${e.target}`)).toEqual(["alice->bob"]);
  });

  it("dedupes target users case-insensitively", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", replyTo: { userName: "Bob", id: "id-bob" } }),
        makePost({ id: "2", user: "alice", replyTo: { userName: "bob", id: "id-bob" } }),
        makePost({ id: "3", user: "alice", replyTo: { userName: "BOB", id: "id-bob" } }),
      ],
    };
    const fx = fixtures(data);

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 0,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].interactions).toHaveLength(3);
  });

  it("respects maxItems across users", async () => {
    const data: Fixture = {
      alice: [
        makePost({ id: "1", user: "alice", replyTo: { userName: "bob" } }),
        makePost({ id: "2", user: "alice", replyTo: { userName: "carol" } }),
      ],
      bob: [
        makePost({ id: "10", user: "bob", replyTo: { userName: "alice" } }),
        makePost({ id: "11", user: "bob", replyTo: { userName: "dan" } }),
      ],
    };
    const fx = fixtures(data);

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 1,
      maxItems: 3,
      concurrency: 2,
      fetchCdx: fx.fetchCdx,
      fetchPost: fx.fetchPost,
    });

    const totalInteractions = graph.edges.reduce((sum, e) => sum + e.interactions.length, 0);
    expect(totalInteractions).toBe(3);
  });

  it("forwards errors via onError without crashing the walk", async () => {
    const fetchCdx = jest.fn(async (user: string): Promise<CdxItem[]> => {
      if (user === "alice") return [cdxItem("1"), cdxItem("2")];
      throw new Error("cdx boom");
    });
    const fetchPost = jest.fn(
      async (user: string, item: CdxItem): Promise<Post | undefined> => {
        if (item.id === "2") throw new Error("post boom");
        return makePost({
          id: item.id,
          user,
          replyTo: { userName: "bob", id: "id-bob" },
        });
      },
    );
    const errors: Array<{ user: string; err: string }> = [];

    const graph = await buildReplyGraph({
      seed: "alice",
      maxDepth: 1,
      concurrency: 2,
      fetchCdx,
      fetchPost,
      onError: (user, err) => errors.push({ user, err: (err as Error).message }),
    });

    expect(errors.map((e) => e.err).sort()).toEqual(["cdx boom", "post boom"]);
    expect(graph.edges.map((e) => `${e.source}->${e.target}`)).toEqual(["alice->bob"]);
  });

  it("rejects an empty seed user", async () => {
    await expect(
      buildReplyGraph({
        seed: "",
        maxDepth: 0,
        concurrency: 1,
        fetchCdx: async () => [],
        fetchPost: async () => undefined,
      }),
    ).rejects.toThrow();
  });
});

describe("serializeGraphML", () => {
  const graph: ReplyGraph = {
    rootUser: "alice",
    generatedAt: "2026-05-19T00:00:00Z",
    nodes: {
      alice: { userName: "alice", id: "id-alice", postCount: 3 },
      bob: { userName: "bob", id: "id-bob", postCount: 0 },
    },
    edges: [
      {
        source: "alice",
        target: "bob",
        interactions: [
          { postId: "1", date: "2010-03-01T12:00:00Z", archiveUrl: "u1" },
          { postId: "2", date: "2010-04-01T12:00:00Z", archiveUrl: "u2" },
        ],
      },
    ],
  };

  it("emits a graphml document with weights and date range", () => {
    const xml = serializeGraphML(graph);
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<graph edgedefault="directed">');
    expect(xml).toContain('<node id="alice">');
    expect(xml).toContain('<node id="bob">');
    expect(xml).toContain('<edge id="e0" source="alice" target="bob">');
    expect(xml).toContain('<data key="d_weight">2</data>');
    expect(xml).toContain('<data key="d_firstDate">2010-03-01T12:00:00Z</data>');
    expect(xml).toContain('<data key="d_lastDate">2010-04-01T12:00:00Z</data>');
  });

  it("escapes XML special characters in user names", () => {
    const dangerous: ReplyGraph = {
      rootUser: "x",
      generatedAt: "2026-05-19T00:00:00Z",
      nodes: { x: { userName: 'A&B<"', postCount: 0 } },
      edges: [],
    };
    const xml = serializeGraphML(dangerous);
    expect(xml).toContain("A&amp;B&lt;&quot;");
    expect(xml).not.toContain('A&B<"');
  });
});
