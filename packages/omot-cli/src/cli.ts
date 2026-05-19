import { Command } from "commander";

export type EdgeOptions = {
  enabled: boolean;
  url: string;
  apiKey?: string;
};

export type RuntimeOptions = {
  edge: EdgeOptions;
  concurrency: number;
  cdxConcurrency: number;
};

export type SolveArgs = { user: string };

export type MatchArgs = {
  regex: string;
  keywords: string[];
  seeds: string[];
  flags: string;
  maxDepth: number;
  maxItems: number;
};

export type CliHandlers = {
  solve: (args: SolveArgs, runtime: RuntimeOptions) => Promise<void>;
  match: (args: MatchArgs, runtime: RuntimeOptions) => Promise<void>;
};

const DEFAULT_EDGE_URL = "https://omot-edge.ayanamists.workers.dev";
const DEFAULT_CONCURRENCY = 16;
const DEFAULT_CDX_CONCURRENCY = 3;
const DEFAULT_MAX_ITEMS = 1000;

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, got ${value}`);
  }
  return parsed;
}

function buildRuntime(opts: Record<string, unknown>): RuntimeOptions {
  return {
    edge: {
      enabled: opts.edge !== false && Boolean(opts.edgeUrl),
      url: String(opts.edgeUrl ?? ""),
      apiKey: opts.edgeApiKey as string | undefined,
    },
    concurrency: opts.concurrency as number,
    cdxConcurrency: opts.cdxConcurrency as number,
  };
}

export function buildProgram(handlers: CliHandlers, version = "1.0.0"): Command {
  const program = new Command();

  program
    .name("omot-cli")
    .description("CLI for the oh-my-old-tweet (omot) archive of old twitter posts")
    .version(version)
    .showHelpAfterError()
    .option("--edge-url <url>", "omot-edge server URL", process.env.OMOT_EDGE_URL ?? DEFAULT_EDGE_URL)
    .option(
      "--edge-api-key <key>",
      "Bearer token for omot-edge (defaults to $OMOT_API_KEY)",
      process.env.OMOT_API_KEY,
    )
    .option("--no-edge", "disable omot-edge and fetch archive.org directly")
    .option(
      "-c, --concurrency <n>",
      "max concurrent snapshot requests",
      parsePositiveInt,
      parsePositiveInt(process.env.OMOT_CLI_CONCURRENCY ?? String(DEFAULT_CONCURRENCY)),
    )
    .option(
      "--cdx-concurrency <n>",
      "max concurrent CDX requests",
      parsePositiveInt,
      parsePositiveInt(process.env.OMOT_CLI_CDX_CONCURRENCY ?? String(DEFAULT_CDX_CONCURRENCY)),
    );

  program
    .command("solve")
    .description("find all possible historical usernames belonging to a user")
    .argument("<user>", "current twitter username")
    .action(async (user: string, _opts: unknown, cmd: Command) => {
      const runtime = buildRuntime(cmd.optsWithGlobals());
      await handlers.solve({ user }, runtime);
    });

  program
    .command("match")
    .description("find posts whose text matches the regex or keywords; recursively expand via reply targets")
    .argument("<regex>", "regex pattern to match against post text")
    .argument("<seeds...>", "one or more seed usernames")
    .option("-k, --keyword <keyword>", "literal keyword to match; can be repeated", collect, [])
    .option("-f, --flags <flags>", "regex flags", "i")
    .option(
      "-d, --max-depth <n>",
      "max recursion depth (0 = seeds only)",
      parseNonNegativeInt,
      1,
    )
    .option(
      "--max-items <n>",
      "max snapshot/CDX items to inspect across all users (0 = unlimited)",
      parseNonNegativeInt,
      parseNonNegativeInt(process.env.OMOT_CLI_MAX_ITEMS ?? String(DEFAULT_MAX_ITEMS)),
    )
    .action(
      async (
        regex: string,
        seeds: string[],
        opts: { flags: string; keyword?: string[]; maxDepth: number; maxItems: number },
        cmd: Command,
      ) => {
        const runtime = buildRuntime(cmd.optsWithGlobals());
        await handlers.match(
          {
            regex,
            keywords: opts.keyword ?? [],
            seeds,
            flags: opts.flags,
            maxDepth: opts.maxDepth,
            maxItems: opts.maxItems,
          },
          runtime,
        );
      },
    );

  return program;
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
