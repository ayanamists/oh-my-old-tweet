import {
  buildProgram,
  CircleArgs,
  CliHandlers,
  GraphArgs,
  MatchArgs,
  RuntimeOptions,
  SolveArgs,
} from "./cli";

type Captured = {
  solve: jest.Mock<Promise<void>, [SolveArgs, RuntimeOptions]>;
  match: jest.Mock<Promise<void>, [MatchArgs, RuntimeOptions]>;
  graph: jest.Mock<Promise<void>, [GraphArgs, RuntimeOptions]>;
  circle: jest.Mock<Promise<void>, [CircleArgs, RuntimeOptions]>;
  handlers: CliHandlers;
};

function makeCaptured(): Captured {
  const solve = jest.fn(async (_a: SolveArgs, _r: RuntimeOptions) => {});
  const match = jest.fn(async (_a: MatchArgs, _r: RuntimeOptions) => {});
  const graph = jest.fn(async (_a: GraphArgs, _r: RuntimeOptions) => {});
  const circle = jest.fn(async (_a: CircleArgs, _r: RuntimeOptions) => {});
  return { solve, match, graph, circle, handlers: { solve, match, graph, circle } };
}

async function run(handlers: CliHandlers, args: string[]): Promise<void> {
  const program = buildProgram(handlers);
  // exitOverride keeps commander from calling process.exit during tests; option-
  // parsing errors become thrown CommanderError instances we can assert on.
  // Must be applied to subcommands too — exitOverride is per-command.
  program.exitOverride();
  for (const sub of program.commands) sub.exitOverride();
  const silence = { writeOut: () => {}, writeErr: () => {} };
  program.configureOutput(silence);
  for (const sub of program.commands) sub.configureOutput(silence);
  await program.parseAsync(["node", "omot-cli", ...args]);
}

describe("buildProgram", () => {
  it("routes the solve subcommand", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["solve", "jack"]);

    expect(c.solve).toHaveBeenCalledTimes(1);
    expect(c.match).not.toHaveBeenCalled();
    const [args, runtime] = c.solve.mock.calls[0];
    expect(args).toEqual({ user: "jack" });
    expect(runtime.concurrency).toBe(16);
    expect(runtime.cdxConcurrency).toBe(3);
    expect(runtime.edge.enabled).toBe(true);
  });

  it("routes the match subcommand with a single seed", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "hello", "alice"]);

    expect(c.match).toHaveBeenCalledTimes(1);
    expect(c.solve).not.toHaveBeenCalled();
    const [args] = c.match.mock.calls[0];
    expect(args).toEqual({
      regex: "hello",
      keywords: [],
      seeds: ["alice"],
      flags: "i",
      maxDepth: 1,
      maxItems: 1000,
    });
  });

  it("collects multiple seeds as a positional variadic", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "bob", "carol"]);
    expect(c.match.mock.calls[0][0].seeds).toEqual(["alice", "bob", "carol"]);
  });

  it("respects --flags and --max-depth on match", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "--flags", "gi", "--max-depth", "3"]);
    const [args] = c.match.mock.calls[0];
    expect(args.flags).toBe("gi");
    expect(args.maxDepth).toBe(3);
  });

  it("respects --max-items on match", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "--max-items", "25"]);
    expect(c.match.mock.calls[0][0].maxItems).toBe(25);
  });

  it("allows --max-items=0 for unlimited search", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "--max-items", "0"]);
    expect(c.match.mock.calls[0][0].maxItems).toBe(0);
  });

  it("collects repeated literal keywords on match", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "--keyword", "bar", "-k", "小楚"]);
    const [args] = c.match.mock.calls[0];
    expect(args.regex).toBe("foo");
    expect(args.keywords).toEqual(["bar", "小楚"]);
  });

  it("allows --max-depth=0 (seeds only, no recursion)", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["match", "foo", "alice", "--max-depth", "0"]);
    expect(c.match.mock.calls[0][0].maxDepth).toBe(0);
  });

  it("propagates global options to the subcommand handler", async () => {
    const c = makeCaptured();
    await run(c.handlers, [
      "--no-edge",
      "-c",
      "8",
      "--cdx-concurrency",
      "2",
      "solve",
      "jack",
    ]);

    const runtime = c.solve.mock.calls[0][1];
    expect(runtime.edge.enabled).toBe(false);
    expect(runtime.concurrency).toBe(8);
    expect(runtime.cdxConcurrency).toBe(2);
  });

  it("threads --edge-api-key through runtime options", async () => {
    const c = makeCaptured();
    await run(c.handlers, ["--edge-api-key", "secret", "solve", "jack"]);
    expect(c.solve.mock.calls[0][1].edge.apiKey).toBe("secret");
  });

  it("rejects negative --max-depth via the parser", async () => {
    const c = makeCaptured();
    await expect(
      run(c.handlers, ["match", "foo", "alice", "--max-depth", "-1"]),
    ).rejects.toThrow();
    expect(c.match).not.toHaveBeenCalled();
  });

  it("rejects --concurrency=0 via the parser", async () => {
    const c = makeCaptured();
    await expect(
      run(c.handlers, ["-c", "0", "solve", "jack"]),
    ).rejects.toThrow();
    expect(c.solve).not.toHaveBeenCalled();
  });

  it("requires the regex argument for match", async () => {
    const c = makeCaptured();
    await expect(run(c.handlers, ["match"])).rejects.toThrow();
    expect(c.match).not.toHaveBeenCalled();
  });

  it("requires at least one seed for match", async () => {
    const c = makeCaptured();
    await expect(run(c.handlers, ["match", "regex-only"])).rejects.toThrow();
    expect(c.match).not.toHaveBeenCalled();
  });

  it("requires the user argument for solve", async () => {
    const c = makeCaptured();
    await expect(run(c.handlers, ["solve"])).rejects.toThrow();
    expect(c.solve).not.toHaveBeenCalled();
  });

  it("surfaces handler errors via parseAsync", async () => {
    const handlers: CliHandlers = {
      solve: async () => {
        throw new Error("solve boom");
      },
      match: async () => {},
      graph: async () => {},
      circle: async () => {},
    };
    await expect(run(handlers, ["solve", "jack"])).rejects.toThrow("solve boom");
  });

  describe("graph subcommand", () => {
    it("uses sensible defaults", async () => {
      const c = makeCaptured();
      await run(c.handlers, ["graph", "jack"]);
      expect(c.graph).toHaveBeenCalledTimes(1);
      const [args] = c.graph.mock.calls[0];
      expect(args).toEqual({
        user: "jack",
        maxDepth: 1,
        maxItems: 1000,
        format: "json",
        output: undefined,
      });
    });

    it("accepts --format graphml and -o", async () => {
      const c = makeCaptured();
      await run(c.handlers, [
        "graph",
        "jack",
        "--format",
        "graphml",
        "-o",
        "jack.graphml",
      ]);
      const [args] = c.graph.mock.calls[0];
      expect(args.format).toBe("graphml");
      expect(args.output).toBe("jack.graphml");
    });

    it("rejects an unknown --format value", async () => {
      const c = makeCaptured();
      await expect(
        run(c.handlers, ["graph", "jack", "--format", "yaml"]),
      ).rejects.toThrow();
      expect(c.graph).not.toHaveBeenCalled();
    });

    it("propagates --max-depth and --max-items", async () => {
      const c = makeCaptured();
      await run(c.handlers, [
        "graph",
        "jack",
        "--max-depth",
        "2",
        "--max-items",
        "5000",
      ]);
      const [args] = c.graph.mock.calls[0];
      expect(args.maxDepth).toBe(2);
      expect(args.maxItems).toBe(5000);
    });

    it("requires the user argument", async () => {
      const c = makeCaptured();
      await expect(run(c.handlers, ["graph"])).rejects.toThrow();
      expect(c.graph).not.toHaveBeenCalled();
    });
  });

  describe("circle subcommand", () => {
    it("routes with sensible defaults", async () => {
      const c = makeCaptured();
      await run(c.handlers, ["circle", "jack"]);
      expect(c.circle).toHaveBeenCalledTimes(1);
      const [args] = c.circle.mock.calls[0];
      expect(args.user).toBe("jack");
      expect(args.maxDepth).toBe(1);
      expect(args.maxItems).toBe(1000);
      expect(args.top).toBe(20);
      expect(args.json).toBe(false);
      expect(args.year).toBeUndefined();
      expect(args.fromFile).toBeUndefined();
    });

    it("accepts --year, --top and --json", async () => {
      const c = makeCaptured();
      await run(c.handlers, [
        "circle",
        "jack",
        "--year",
        "2010",
        "--top",
        "5",
        "--json",
      ]);
      const [args] = c.circle.mock.calls[0];
      expect(args.year).toBe(2010);
      expect(args.top).toBe(5);
      expect(args.json).toBe(true);
    });

    it("accepts --from and --to date strings", async () => {
      const c = makeCaptured();
      await run(c.handlers, [
        "circle",
        "jack",
        "--from",
        "2010-01-01",
        "--to",
        "2010-12-31",
      ]);
      const [args] = c.circle.mock.calls[0];
      expect(args.from).toBe("2010-01-01");
      expect(args.to).toBe("2010-12-31");
    });

    it("allows omitting <user> when --from-file is set", async () => {
      const c = makeCaptured();
      await run(c.handlers, ["circle", "--from-file", "jack.json"]);
      const [args] = c.circle.mock.calls[0];
      expect(args.user).toBeUndefined();
      expect(args.fromFile).toBe("jack.json");
    });

    it("rejects when neither <user> nor --from-file is provided", async () => {
      const c = makeCaptured();
      await expect(run(c.handlers, ["circle"])).rejects.toThrow();
      expect(c.circle).not.toHaveBeenCalled();
    });

    it("rejects --top=0", async () => {
      const c = makeCaptured();
      await expect(
        run(c.handlers, ["circle", "jack", "--top", "0"]),
      ).rejects.toThrow();
      expect(c.circle).not.toHaveBeenCalled();
    });
  });
});
