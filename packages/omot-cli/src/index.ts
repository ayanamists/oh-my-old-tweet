#!/usr/bin/env node
import {
  CdxItem,
  Post,
  User,
  getArchiveUrl,
  parseCdxHeader,
  parseCdxItem,
  parsePost,
} from "twitter-data-parser";

import { setGlobalDispatcher, Agent, Pool } from "undici";

setGlobalDispatcher(
  new Agent({ factory: (origin) => new Pool(origin, { connections: 32 }) })
);

import fetchBuilder from "fetch-retry";
import { exit } from "process";
import * as fs from "fs";

import { matchKeyword } from "./keywordMatch";
import { buildReplyGraph, ReplyGraph, serializeGraphML } from "./replyGraph";
import {
  computeMetrics,
  filterGraphByTime,
  formatCircleTable,
  rangeForYear,
  TimeRange,
} from "./centrality";
import {
  buildProgram,
  CircleArgs,
  CliHandlers,
  EdgeOptions,
  GraphArgs,
  MatchArgs,
  RuntimeOptions,
  SolveArgs,
} from "./cli";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const fetch = fetchBuilder(global.fetch, {
  retries: 3,
  retryDelay: (attempt) => 500 * Math.pow(2, attempt),
  retryOn: (attempt, error, response) => {
    if (attempt >= 3) return false;
    if (error != null) return true;
    return response != null && RETRYABLE_STATUS.has(response.status);
  },
});

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function authHeaders(edge: EdgeOptions): HeadersInit | undefined {
  return edge.apiKey ? { Authorization: `Bearer ${edge.apiKey}` } : undefined;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return (await res.json()) as T;
}

function isUsableCdxItem(item: CdxItem): boolean {
  const hasUsableStatus = item.statusCode === 200 || Number.isNaN(item.statusCode);
  return (
    hasUsableStatus &&
    /^\d+$/.test(item.id) &&
    !Number.isNaN(item.date.getTime()) &&
    (item.mimetype === "text/html" || item.mimetype === "application/json")
  );
}

function parseCdxRows(rows: string[][]): CdxItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  // Resolve column indices from the response header so this function works
  // with both archive.org's full 7-column schema (when CLI hits archive
  // directly) and the edge worker's `fl=`-trimmed 5-column schema.
  const cols = parseCdxHeader(rows[0]);
  if (!cols) return [];

  const seen = new Set<string>();
  const items: CdxItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const item = parseCdxItem(row, cols);
    if (!isUsableCdxItem(item)) {
      continue;
    }

    const key = `${item.id}:${item.digest || item.timestamp}:${item.mimetype}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(item);
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function getCdxListFromEdge(user: string, edge: EdgeOptions): Promise<CdxItem[] | undefined> {
  try {
    const url = new URL(`${trimTrailingSlash(edge.url)}/cdx`);
    url.searchParams.set("user", user);
    console.error(`Fetching cdx via edge: ${url.toString()}`);
    const rows = await fetchJson<string[][]>(url.toString(), {
      headers: authHeaders(edge),
    });
    return parseCdxRows(rows);
  } catch (err) {
    console.error(`edge cdx failed for ${user}, falling back to archive.org: ${err}`);
    return undefined;
  }
}

async function getCdxListFromArchive(user: string): Promise<CdxItem[]> {
  const url = new URL("https://web.archive.org/cdx/search/cdx");
  url.searchParams.set("url", `twitter.com/${user}/status`);
  url.searchParams.set("matchType", "prefix");
  url.searchParams.set("output", "json");
  url.searchParams.set("limit", "100000");
  url.searchParams.set("collapse", "digest");

  console.error(`Fetching cdx: ${url.toString()}`);
  const rows = await fetchJson<string[][]>(url.toString());
  return parseCdxRows(rows);
}

async function getCdxList(user: string, options: RuntimeOptions): Promise<CdxItem[]> {
  if (options.edge.enabled) {
    const edgeItems = await getCdxListFromEdge(user, options.edge);
    if (edgeItems !== undefined) {
      return edgeItems;
    }
  }

  return getCdxListFromArchive(user);
}

function getTweetUserName(origUrl: string): string | undefined {
  try {
    const url = new URL(origUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const statusIdx = parts.indexOf("status");
    return statusIdx > 0 ? parts[statusIdx - 1] : undefined;
  } catch {
    const parts = origUrl.split("/");
    const statusIdx = parts.indexOf("status");
    return statusIdx > 0 ? parts[statusIdx - 1] : undefined;
  }
}

function getArchivePageUrl(info: CdxItem): string {
  const mode = info.mimetype === "application/json" ? `${info.timestamp}if_` : info.timestamp;
  return `https://web.archive.org/web/${mode}/${info.original}`;
}

async function getOnePageFromEdge(pageUrl: string, edge: EdgeOptions): Promise<Post | undefined> {
  if (!edge.enabled) {
    return undefined;
  }

  try {
    const url = new URL(`${trimTrailingSlash(edge.url)}/snapshot`);
    url.searchParams.set("url", pageUrl);
    const data = await fetchJson<{ post?: Post | null }>(url.toString(), {
      headers: authHeaders(edge),
    });

    if (!data.post) {
      return undefined;
    }
    if (!(data.post.date instanceof Date)) {
      data.post.date = new Date(data.post.date as unknown as string);
    }
    return data.post;
  } catch {
    return undefined;
  }
}

async function getOnePage(info: CdxItem, options: RuntimeOptions): Promise<Post | undefined> {
  const user = getTweetUserName(info.original);
  if (user == null) {
    return undefined;
  }

  const pageUrl = getArchivePageUrl(info);
  const edgePost = await getOnePageFromEdge(pageUrl, options.edge);
  if (edgePost !== undefined) {
    return edgePost;
  }

  const res = await fetch(pageUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${pageUrl}`);
  }
  const body = await res.text();
  return parsePost(body, {
    id: info.id,
    timestamp: info.timestamp,
    userName: user,
  });
}

type PostVisitor = (p: Post) => void;

async function visitPost(user: string, info: CdxItem, options: RuntimeOptions, f: PostVisitor): Promise<void> {
  try {
    const post = await getOnePage(info, options);
    if (post != null) {
      f(post);
    }
  } catch (err) {
    const url = getArchiveUrl({ id: info.id, timestamp: info.timestamp, userName: user });
    console.error(`url failed: ${url}, err: ${err}`);
  }
}

async function forEachConcurrent<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) {
          return;
        }
        await worker(items[index], index);
      }
    }),
  );
}

class AsyncLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.active -= 1;
  }
}

class TaskTracker {
  private pending = 0;
  private readonly idleResolvers: Array<() => void> = [];

  track(task: Promise<void>, label: string): void {
    this.pending += 1;
    task
      .catch((err) => console.log(`${label} failed: ${err}`))
      .finally(() => {
        this.pending -= 1;
        if (this.pending === 0) {
          const resolvers = this.idleResolvers.splice(0);
          resolvers.forEach(resolve => resolve());
        }
      });
  }

  waitForIdle(): Promise<void> {
    if (this.pending === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }
}

const userNames = new Set<string>();

function logResult() {
  process.stdout.write(`\nAll founded user names:\n`);
  process.stdout.write(`[${Array.from(userNames).join(", ")}]`);
}

async function solve(user: string, options: RuntimeOptions) {
  userNames.clear();
  userNames.add(user);

  const items = await getCdxList(user, options);
  console.log(`Fetch ${items.length} tweets belong to ${user}`);

  if (items.length === 0) {
    return;
  }
  const earliest = items[0].date;
  console.log(`Earliest archive time: ${earliest}`);

  const snapshotLimiter = new AsyncLimiter(options.concurrency);
  const cdxLimiter = new AsyncLimiter(options.cdxConcurrency);
  const reverseTracker = new TaskTracker();
  const targetKeys = new Set<string>();
  const targetNames = new Set<string>();

  let targetId: string | undefined;
  let targetIdResolved = false;
  let resolveTargetId: (id: string | undefined) => void = () => {};
  const targetIdPromise = new Promise<string | undefined>((resolve) => {
    resolveTargetId = resolve;
  });

  function publishTargetId(id: string | undefined) {
    if (targetIdResolved) {
      return;
    }
    targetIdResolved = true;
    resolveTargetId(id);
    if (id != null) {
      console.log(`User id for ${user}: ${id}`);
      console.log(`Perform computing ...`);
    }
  }

  function rememberTargetId(id: string | undefined) {
    if (id == null || targetId != null) {
      return;
    }
    targetId = id;
    publishTargetId(id);
  }

  async function reverseSearchTarget(targetUserName: string): Promise<void> {
    const id = await targetIdPromise;
    if (id == null) {
      return;
    }

    const cdx = await cdxLimiter.run(() => getCdxList(targetUserName, options));
    const toSearch = cdx.filter(v => v.date.getTime() < earliest.getTime());
    if (toSearch.length === 0) {
      return;
    }

    console.log(`Searching ${toSearch.length} tweets of ${targetUserName}`);
    let completed = 0;
    await forEachConcurrent(toSearch, options.concurrency, async (v) => {
      await snapshotLimiter.run(async () => {
        await visitPost(targetUserName, v, options, (p) => {
          if (p.replyInfo != null) {
            const thisId = p.replyInfo.targetUser.id;
            const thisUserName = p.replyInfo.targetUser.userName;
            if (thisId === id && thisUserName != null) {
              if (!userNames.has(thisUserName)) {
                console.log(`FOUND ${thisUserName}, url: ${p.archiveUrl}`);
                userNames.add(thisUserName);
              }
            }
          }
        });
      });
      completed += 1;
      if (completed % 100 === 0 || completed === toSearch.length) {
        console.log(`Processing ${completed}/${toSearch.length} of ${targetUserName}`);
      }
    });
  }

  function enqueueTarget(targetUser: User) {
    const targetUserName = targetUser.userName;
    if (targetUserName == null || targetUserName.toLowerCase() === user.toLowerCase()) {
      return;
    }

    const nameKey = targetUserName.toLowerCase();
    const key = targetUser.id != null ? `id:${targetUser.id}` : `name:${nameKey}`;
    if (targetKeys.has(key) || targetNames.has(nameKey)) {
      return;
    }

    targetKeys.add(key);
    targetNames.add(nameKey);
    reverseTracker.track(
      reverseSearchTarget(targetUserName),
      `reverse search for ${targetUserName}`,
    );
  }

  await forEachConcurrent(items, options.concurrency, async (v) => {
    await snapshotLimiter.run(async () => {
      await visitPost(user, v, options, (post) => {
        rememberTargetId(post.user.id);
        if (post.replyInfo != null) {
          const u1 = post.replyInfo.targetUser;
          enqueueTarget(u1);
          console.log(`REPLY ${user} => ${u1.userName}`);
        }
      });
    });
  });

  if (!targetIdResolved) {
    publishTargetId(undefined);
  }

  console.log(`Find ${targetNames.size} relative users`);
  await reverseTracker.waitForIdle();

  if (targetId == null) {
    return;
  }

  console.log(`all founded userNames for ${targetId}:`);
  console.log(userNames);
}

async function runMatch(args: MatchArgs, runtime: RuntimeOptions): Promise<void> {
  let patterns: RegExp[];
  try {
    patterns = [
      new RegExp(args.regex, args.flags),
      ...args.keywords.map((keyword) => new RegExp(escapeRegExp(keyword), args.flags)),
    ];
  } catch (err) {
    throw new Error(`invalid match pattern: ${err}`);
  }

  const cdxLimiter = new AsyncLimiter(runtime.cdxConcurrency);
  console.log(`Search budget: ${args.maxItems > 0 ? `${args.maxItems} items` : "unlimited"}`);
  const results = await matchKeyword({
    seeds: args.seeds,
    patterns,
    maxDepth: args.maxDepth,
    maxItems: args.maxItems,
    concurrency: runtime.concurrency,
    fetchCdx: (u) => cdxLimiter.run(() => getCdxList(u, runtime)),
    fetchPost: (_u, item) => getOnePage(item, runtime),
    onUserStart: (u, depth, total, selected, remaining) => {
      const budget = remaining === undefined ? "" : `, ${remaining} budget items left`;
      console.log(`[depth=${depth}] ${u}: inspecting ${selected}/${total} cdx items${budget}`);
    },
    onMatch: (m) => {
      const snippet = (m.post.text ?? "").replace(/\s+/g, " ").slice(0, 200);
      console.log(`MATCH [d=${m.depth}] @${m.seedUser} ${m.post.archiveUrl}\n  ${snippet}`);
    },
    onError: (u, err) => console.log(`error for ${u}: ${err}`),
  });
  console.log(`\nTotal matched posts: ${results.length}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

process.on("SIGINT", () => {
  logResult();
  exit(-1);
});

async function runGraph(args: GraphArgs, runtime: RuntimeOptions): Promise<void> {
  const graph = await crawlGraph(args.user, args, runtime);
  const out =
    args.format === "graphml" ? serializeGraphML(graph) : JSON.stringify(graph, null, 2);
  if (args.output) {
    await fs.promises.writeFile(args.output, out, "utf8");
    console.error(`Wrote ${args.output}`);
  } else {
    process.stdout.write(out);
    process.stdout.write("\n");
  }
}

async function runCircle(args: CircleArgs, runtime: RuntimeOptions): Promise<void> {
  let graph: ReplyGraph;
  if (args.fromFile) {
    const raw = await fs.promises.readFile(args.fromFile, "utf8");
    graph = JSON.parse(raw) as ReplyGraph;
    console.error(
      `Loaded graph from ${args.fromFile}: ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`,
    );
  } else if (args.user) {
    graph = await crawlGraph(args.user, args, runtime);
  } else {
    throw new Error("circle requires either <user> or --from-file");
  }

  const range = resolveTimeRange(args);
  const filtered = filterGraphByTime(graph, range);
  if (rangeHasBound(range)) {
    console.error(
      `Filtered: ${filtered.edges.length} edges remain (from ${graph.edges.length})`,
    );
  }

  const metrics = computeMetrics(filtered)
    .filter((m) => m.weightedInDegree > 0 || m.weightedOutDegree > 0)
    .sort((a, b) => b.pageRank - a.pageRank)
    .slice(0, args.top);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          rootUser: graph.rootUser,
          range: {
            from: range.from?.toISOString(),
            to: range.to?.toISOString(),
          },
          metrics,
        },
        null,
        2,
      ),
    );
    process.stdout.write("\n");
  } else {
    process.stdout.write(
      formatCircleTable(
        graph.rootUser,
        range,
        filtered.edges.length,
        Object.keys(filtered.nodes).length,
        metrics,
      ),
    );
    process.stdout.write("\n");
  }
}

async function crawlGraph(
  user: string,
  args: { maxDepth: number; maxItems: number },
  runtime: RuntimeOptions,
): Promise<ReplyGraph> {
  const cdxLimiter = new AsyncLimiter(runtime.cdxConcurrency);
  console.error(
    `Building reply graph for ${user} (depth=${args.maxDepth}, max-items=${args.maxItems > 0 ? args.maxItems : "unlimited"})`,
  );
  const graph = await buildReplyGraph({
    seed: user,
    maxDepth: args.maxDepth,
    maxItems: args.maxItems > 0 ? args.maxItems : undefined,
    concurrency: runtime.concurrency,
    fetchCdx: (u) => cdxLimiter.run(() => getCdxList(u, runtime)),
    fetchPost: (_u, item) => getOnePage(item, runtime),
    onUserStart: (u, depth, total, selected, remaining) => {
      const budget = remaining === undefined ? "" : `, ${remaining} budget items left`;
      console.error(`[depth=${depth}] ${u}: inspecting ${selected}/${total} cdx items${budget}`);
    },
    onError: (u, err) => console.error(`error for ${u}: ${err}`),
  });
  console.error(`Graph: ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);
  return graph;
}

function resolveTimeRange(args: CircleArgs): TimeRange {
  if (args.year !== undefined) return rangeForYear(args.year);
  const range: TimeRange = {};
  if (args.from) {
    const d = new Date(args.from);
    if (Number.isNaN(d.getTime())) throw new Error(`invalid --from date: ${args.from}`);
    range.from = d;
  }
  if (args.to) {
    const d = new Date(args.to);
    if (Number.isNaN(d.getTime())) throw new Error(`invalid --to date: ${args.to}`);
    range.to = d;
  }
  return range;
}

function rangeHasBound(range: TimeRange): boolean {
  return range.from !== undefined || range.to !== undefined;
}

const handlers: CliHandlers = {
  solve: async ({ user }: SolveArgs, runtime: RuntimeOptions) => {
    await solve(user, runtime);
  },
  match: runMatch,
  graph: runGraph,
  circle: runCircle,
};

const pkg = require("../package.json") as { version?: string };

buildProgram(handlers, pkg.version ?? "0.0.0")
  .parseAsync()
  .catch((err) => {
    console.error(err);
    exit(1);
  });
