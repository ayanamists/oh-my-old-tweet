import type { GraphEdge, ReplyGraph } from "./replyGraph";

export type TimeRange = {
  from?: Date;
  to?: Date;
};

export type UserMetrics = {
  user: string;
  userName: string;
  id?: string;
  inDegree: number;
  outDegree: number;
  weightedInDegree: number;
  weightedOutDegree: number;
  pageRank: number;
};

export function rangeForYear(year: number): TimeRange {
  return {
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

export function filterGraphByTime(graph: ReplyGraph, range: TimeRange): ReplyGraph {
  const fromMs = range.from?.getTime();
  const toMs = range.to?.getTime();
  if (fromMs === undefined && toMs === undefined) {
    return graph;
  }
  const lo = fromMs ?? -Infinity;
  const hi = toMs ?? Infinity;

  const edges: GraphEdge[] = [];
  for (const edge of graph.edges) {
    const kept = edge.interactions.filter((it) => {
      const t = Date.parse(it.date);
      if (Number.isNaN(t)) return false;
      return t >= lo && t <= hi;
    });
    if (kept.length > 0) {
      edges.push({ source: edge.source, target: edge.target, interactions: kept });
    }
  }
  return { ...graph, edges };
}

export type PageRankOptions = {
  damping?: number;
  maxIter?: number;
  epsilon?: number;
};

export function pageRank(
  nodes: string[],
  edges: GraphEdge[],
  opts: PageRankOptions = {},
): Record<string, number> {
  const damping = opts.damping ?? 0.85;
  const maxIter = opts.maxIter ?? 100;
  const epsilon = opts.epsilon ?? 1e-6;
  const N = nodes.length;
  if (N === 0) return {};

  const outW: Record<string, number> = {};
  const inAdj: Record<string, Array<{ from: string; weight: number }>> = {};
  for (const v of nodes) {
    outW[v] = 0;
    inAdj[v] = [];
  }
  for (const edge of edges) {
    if (!(edge.source in outW) || !(edge.target in inAdj)) continue;
    const w = edge.interactions.length;
    outW[edge.source] += w;
    inAdj[edge.target].push({ from: edge.source, weight: w });
  }

  let pr: Record<string, number> = {};
  for (const v of nodes) pr[v] = 1 / N;

  for (let iter = 0; iter < maxIter; iter++) {
    let dangling = 0;
    for (const v of nodes) {
      if (outW[v] === 0) dangling += pr[v];
    }
    const teleport = (1 - damping) / N + (damping * dangling) / N;

    const next: Record<string, number> = {};
    let delta = 0;
    for (const v of nodes) {
      let sum = 0;
      for (const { from, weight } of inAdj[v]) {
        if (outW[from] > 0) sum += (pr[from] * weight) / outW[from];
      }
      next[v] = teleport + damping * sum;
      delta += Math.abs(next[v] - pr[v]);
    }
    pr = next;
    if (delta < epsilon) break;
  }

  return pr;
}

export function formatCircleTable(
  rootUser: string,
  range: TimeRange,
  filteredEdgeCount: number,
  filteredNodeCount: number,
  metrics: UserMetrics[],
): string {
  const hasBound = range.from !== undefined || range.to !== undefined;
  const rangeStr = hasBound
    ? ` [${range.from?.toISOString().slice(0, 10) ?? "*"} .. ${range.to?.toISOString().slice(0, 10) ?? "*"}]`
    : "";
  const lines: string[] = [];
  lines.push("");
  lines.push(`Circle of ${rootUser}${rangeStr}`);
  lines.push(`Graph after filter: ${filteredNodeCount} nodes, ${filteredEdgeCount} edges`);
  lines.push("");

  if (metrics.length === 0) {
    lines.push("(no users with any interactions in this range)");
    return lines.join("\n");
  }

  const userWidth = Math.max(4, ...metrics.map((m) => m.userName.length));
  const cols = [
    pad("rank", 4),
    pad("user", userWidth),
    padLeft("in", 4),
    padLeft("out", 4),
    padLeft("w-in", 6),
    padLeft("w-out", 6),
    padLeft("pagerank", 9),
  ];
  const header = cols.join("  ");
  lines.push(header);
  lines.push("-".repeat(header.length));
  metrics.forEach((m, i) => {
    lines.push(
      [
        padLeft(String(i + 1), 4),
        pad(m.userName, userWidth),
        padLeft(String(m.inDegree), 4),
        padLeft(String(m.outDegree), 4),
        padLeft(String(m.weightedInDegree), 6),
        padLeft(String(m.weightedOutDegree), 6),
        padLeft(m.pageRank.toFixed(5), 9),
      ].join("  "),
    );
  });
  return lines.join("\n");
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}

export function computeMetrics(
  graph: ReplyGraph,
  prOpts: PageRankOptions = {},
): UserMetrics[] {
  const keys = new Set<string>(Object.keys(graph.nodes));
  for (const edge of graph.edges) {
    keys.add(edge.source);
    keys.add(edge.target);
  }
  const nodeList = Array.from(keys);

  const inSet: Record<string, Set<string>> = {};
  const outSet: Record<string, Set<string>> = {};
  const wIn: Record<string, number> = {};
  const wOut: Record<string, number> = {};
  for (const u of nodeList) {
    inSet[u] = new Set();
    outSet[u] = new Set();
    wIn[u] = 0;
    wOut[u] = 0;
  }
  for (const edge of graph.edges) {
    outSet[edge.source].add(edge.target);
    inSet[edge.target].add(edge.source);
    const w = edge.interactions.length;
    wOut[edge.source] += w;
    wIn[edge.target] += w;
  }

  const pr = pageRank(nodeList, graph.edges, prOpts);

  return nodeList.map((k) => {
    const node = graph.nodes[k];
    return {
      user: k,
      userName: node?.userName ?? k,
      id: node?.id,
      inDegree: inSet[k].size,
      outDegree: outSet[k].size,
      weightedInDegree: wIn[k],
      weightedOutDegree: wOut[k],
      pageRank: pr[k] ?? 0,
    };
  });
}
