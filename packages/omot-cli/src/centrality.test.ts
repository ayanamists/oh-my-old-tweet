import {
  computeMetrics,
  filterGraphByTime,
  formatCircleTable,
  pageRank,
  rangeForYear,
  UserMetrics,
} from "./centrality";
import type { ReplyGraph } from "./replyGraph";

function graphFrom(opts: {
  nodes: string[];
  edges: Array<{ source: string; target: string; dates: string[] }>;
}): ReplyGraph {
  const nodes: ReplyGraph["nodes"] = {};
  for (const n of opts.nodes) {
    nodes[n] = { userName: n, postCount: 0 };
  }
  return {
    rootUser: opts.nodes[0],
    generatedAt: "2026-05-19T00:00:00Z",
    nodes,
    edges: opts.edges.map((e) => ({
      source: e.source,
      target: e.target,
      interactions: e.dates.map((d, i) => ({
        postId: `${e.source}-${e.target}-${i}`,
        date: d,
        archiveUrl: `u-${i}`,
      })),
    })),
  };
}

describe("rangeForYear", () => {
  it("spans the full calendar year in UTC", () => {
    const r = rangeForYear(2010);
    expect(r.from?.toISOString()).toBe("2010-01-01T00:00:00.000Z");
    expect(r.to?.toISOString()).toBe("2010-12-31T23:59:59.999Z");
  });
});

describe("filterGraphByTime", () => {
  const g = graphFrom({
    nodes: ["alice", "bob", "carol"],
    edges: [
      { source: "alice", target: "bob", dates: ["2010-03-01T00:00:00Z", "2011-03-01T00:00:00Z"] },
      { source: "alice", target: "carol", dates: ["2012-03-01T00:00:00Z"] },
    ],
  });

  it("returns the same graph when range is empty", () => {
    const out = filterGraphByTime(g, {});
    expect(out).toBe(g);
  });

  it("drops edges whose interactions all fall outside the range", () => {
    const out = filterGraphByTime(g, rangeForYear(2010));
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].target).toBe("bob");
    expect(out.edges[0].interactions).toHaveLength(1);
  });

  it("keeps an edge with some interactions inside the range, trimming the rest", () => {
    const out = filterGraphByTime(g, {
      from: new Date("2010-01-01T00:00:00Z"),
      to: new Date("2011-12-31T23:59:59Z"),
    });
    const ab = out.edges.find((e) => e.target === "bob")!;
    expect(ab.interactions.map((i) => i.date)).toEqual([
      "2010-03-01T00:00:00Z",
      "2011-03-01T00:00:00Z",
    ]);
    expect(out.edges.find((e) => e.target === "carol")).toBeUndefined();
  });

  it("supports an open-ended upper bound", () => {
    const out = filterGraphByTime(g, { from: new Date("2012-01-01T00:00:00Z") });
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].target).toBe("carol");
  });
});

describe("pageRank", () => {
  it("returns an empty map for no nodes", () => {
    expect(pageRank([], [])).toEqual({});
  });

  it("gives every node equal rank for an empty edge set", () => {
    const pr = pageRank(["a", "b", "c"], []);
    expect(pr.a).toBeCloseTo(1 / 3, 6);
    expect(pr.b).toBeCloseTo(1 / 3, 6);
    expect(pr.c).toBeCloseTo(1 / 3, 6);
  });

  it("ranks a hub-and-spoke graph with the hub on top", () => {
    // a -> hub, b -> hub, c -> hub
    const g = graphFrom({
      nodes: ["hub", "a", "b", "c"],
      edges: [
        { source: "a", target: "hub", dates: ["2010-01-01T00:00:00Z"] },
        { source: "b", target: "hub", dates: ["2010-01-01T00:00:00Z"] },
        { source: "c", target: "hub", dates: ["2010-01-01T00:00:00Z"] },
      ],
    });
    const pr = pageRank(Object.keys(g.nodes), g.edges);
    expect(pr.hub).toBeGreaterThan(pr.a);
    expect(pr.hub).toBeGreaterThan(pr.b);
    expect(pr.hub).toBeGreaterThan(pr.c);
  });

  it("weights repeated interactions: heavier edges raise rank more", () => {
    // a replies to bob 10x, a replies to carol 1x. bob should outrank carol.
    const g = graphFrom({
      nodes: ["a", "bob", "carol"],
      edges: [
        {
          source: "a",
          target: "bob",
          dates: Array.from({ length: 10 }, () => "2010-01-01T00:00:00Z"),
        },
        { source: "a", target: "carol", dates: ["2010-01-01T00:00:00Z"] },
      ],
    });
    const pr = pageRank(Object.keys(g.nodes), g.edges);
    expect(pr.bob).toBeGreaterThan(pr.carol);
  });

  it("approximately sums to 1 across all nodes", () => {
    const g = graphFrom({
      nodes: ["a", "b", "c", "d"],
      edges: [
        { source: "a", target: "b", dates: ["2010-01-01T00:00:00Z"] },
        { source: "b", target: "c", dates: ["2010-01-01T00:00:00Z"] },
        { source: "c", target: "a", dates: ["2010-01-01T00:00:00Z"] },
      ],
    });
    const pr = pageRank(Object.keys(g.nodes), g.edges);
    const sum = Object.values(pr).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("computeMetrics", () => {
  it("reports in/out degree and weighted variants", () => {
    const g = graphFrom({
      nodes: ["alice", "bob", "carol"],
      edges: [
        {
          source: "alice",
          target: "bob",
          dates: ["2010-01-01T00:00:00Z", "2010-02-01T00:00:00Z"],
        },
        { source: "alice", target: "carol", dates: ["2010-01-01T00:00:00Z"] },
        { source: "carol", target: "bob", dates: ["2010-01-01T00:00:00Z"] },
      ],
    });
    const metrics = computeMetrics(g);
    const bob = metrics.find((m) => m.user === "bob")!;
    expect(bob.inDegree).toBe(2); // alice and carol
    expect(bob.outDegree).toBe(0);
    expect(bob.weightedInDegree).toBe(3); // 2 from alice + 1 from carol
    expect(bob.weightedOutDegree).toBe(0);

    const alice = metrics.find((m) => m.user === "alice")!;
    expect(alice.outDegree).toBe(2);
    expect(alice.weightedOutDegree).toBe(3);
  });

  it("preserves the userName casing recorded in the graph", () => {
    const g = graphFrom({ nodes: ["alice"], edges: [] });
    g.nodes["alice"].userName = "Alice";
    const metrics = computeMetrics(g);
    expect(metrics[0].userName).toBe("Alice");
  });
});

describe("formatCircleTable", () => {
  const metrics: UserMetrics[] = [
    {
      user: "bob",
      userName: "bob",
      id: "id-bob",
      inDegree: 2,
      outDegree: 0,
      weightedInDegree: 3,
      weightedOutDegree: 0,
      pageRank: 0.4,
    },
    {
      user: "carol",
      userName: "Carol",
      inDegree: 1,
      outDegree: 1,
      weightedInDegree: 1,
      weightedOutDegree: 1,
      pageRank: 0.2,
    },
  ];

  it("renders an aligned table with header and rule line", () => {
    const out = formatCircleTable("alice", {}, 3, 3, metrics);
    expect(out).toContain("Circle of alice");
    expect(out).toContain("rank");
    expect(out).toContain("pagerank");
    expect(out).toContain("bob");
    expect(out).toContain("Carol");
    expect(out).toContain("0.40000");
    expect(out).toContain("---");
    // No date bracket when range is empty.
    expect(out).not.toContain("[");
  });

  it("includes the date bracket when a range is given", () => {
    const out = formatCircleTable(
      "alice",
      { from: new Date("2010-01-01T00:00:00Z"), to: new Date("2010-12-31T23:59:59Z") },
      1,
      2,
      metrics,
    );
    expect(out).toContain("[2010-01-01 .. 2010-12-31]");
  });

  it("shows an empty-state message when there are no metrics", () => {
    const out = formatCircleTable("alice", {}, 0, 0, []);
    expect(out).toContain("(no users with any interactions in this range)");
    expect(out).not.toContain("rank");
  });

  it("does not contain a trailing newline (caller adds one)", () => {
    const out = formatCircleTable("alice", {}, 1, 1, metrics);
    expect(out.endsWith("\n")).toBe(false);
  });
});
