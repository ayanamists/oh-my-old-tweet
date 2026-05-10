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

const DEFAULT_EDGE_URL = "https://omot-edge.ayanamists.workers.dev";
const DEFAULT_CONCURRENCY = 16;
const DEFAULT_CDX_CONCURRENCY = 3;
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

type EdgeOptions = {
  enabled: boolean;
  url: string;
  apiKey?: string;
};

type RuntimeOptions = {
  edge: EdgeOptions;
  concurrency: number;
  cdxConcurrency: number;
};

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

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
    console.log(`Fetching cdx via edge: ${url.toString()}`);
    const rows = await fetchJson<string[][]>(url.toString(), {
      headers: authHeaders(edge),
    });
    return parseCdxRows(rows);
  } catch (err) {
    console.log(`edge cdx failed for ${user}, falling back to archive.org: ${err}`);
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

  console.log(`Fetching cdx: ${url.toString()}`);
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
    console.log(`url failed: ${url}, err: ${err}`);
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

process.on("SIGINT", () => {
  logResult();
  exit(-1);
});

const { Command } = require("commander");
const program = new Command();
program
  .description("cli from omot, developing")
  .argument("user", "username to process")
  .option("-s, --solve", "find all possible usernames belonging to the user")
  .option("--edge-url <url>", "omot-edge server URL", process.env.OMOT_EDGE_URL ?? DEFAULT_EDGE_URL)
  .option("--edge-api-key <key>", "Bearer token for omot-edge, defaults to OMOT_API_KEY", process.env.OMOT_API_KEY)
  .option("--no-edge", "disable omot-edge and fetch archive.org directly")
  .option(
    "-c, --concurrency <n>",
    "maximum concurrent snapshot requests",
    parsePositiveInt,
    parsePositiveInt(process.env.OMOT_CLI_CONCURRENCY ?? String(DEFAULT_CONCURRENCY)),
  )
  .option(
    "--cdx-concurrency <n>",
    "maximum concurrent CDX requests",
    parsePositiveInt,
    parsePositiveInt(process.env.OMOT_CLI_CDX_CONCURRENCY ?? String(DEFAULT_CDX_CONCURRENCY)),
  )
  .action((user: string, cliOptions: any) => {
    const runtimeOptions: RuntimeOptions = {
      edge: {
        enabled: cliOptions.edge !== false && Boolean(cliOptions.edgeUrl),
        url: cliOptions.edgeUrl,
        apiKey: cliOptions.edgeApiKey,
      },
      concurrency: cliOptions.concurrency,
      cdxConcurrency: cliOptions.cdxConcurrency,
    };

    if (cliOptions.solve) {
      solve(user, runtimeOptions).catch((err) => {
        console.error(err);
        exit(1);
      });
    }
  });

program.parse();
