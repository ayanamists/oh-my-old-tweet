# Step 2 — Edge Cache (Cloudflare Worker + R2)

**Status:** not started (blocked on Step 1 test harness)
**Cost impact:** ~$5/mo (Workers Paid plan; R2 storage is pennies on this volume; egress free)
**Goal:** turn "every visitor independently hammers archive.org" into "the community shares one R2-backed cache."

## Why

Even with Step 1's IndexedDB cache, the *first* visitor for any given snapshot still pays full archive.org latency (often 2–10 s per snapshot, occasional 5xx). Step 2 moves that cost server-side, once per snapshot for the whole world.

R2's **free egress** is the key economic enabler: a CDN-style cache without bandwidth bills. D1 / KV / Cache API are not load-bearing here — only R2 is required.

## Architecture

```
browser ── HTTPS ──▶ Worker (omot-edge)
                       │
                       ├─ R2 GET sha256(archive_url).json
                       │     ├─ hit  ──▶ return JSON
                       │     └─ miss ──▶ fetch archive.org HTML
                       │                 → parse (linkedom)
                       │                 → R2 PUT
                       │                 → return JSON
                       └─ on parser/fetch error ──▶ 502 + structured error
```

Frontend's `Data.ts` becomes:

```
getOnePage(cdxItem)
  ├─ try Worker /snapshot?url=<encoded archive url>
  │     ├─ ok          ──▶ JSON, done
  │     └─ network/5xx ──▶ direct archive.org + main-thread parser (Step 1 fallback)
```

So the Worker is an optimisation, not a hard dependency. If it goes down, the site degrades to Step 1 behaviour.

## New package: `packages/omot-edge`

```
packages/omot-edge/
  wrangler.toml            # bindings: R2 (OMOT_CACHE), env vars
  src/index.ts             # entry: routes /snapshot, /healthz
  src/cache.ts             # R2 get/put with parser_version suffix
  src/fetchArchive.ts      # CORS-free archive.org fetch
  src/parse.ts             # re-export parsePost (Workers-runtime build)
  test/                    # vitest + miniflare
  package.json
```

Workspace root `package.json` already globs `packages/*` so it gets picked up automatically.

## Parser port

`twitter-data-parser` currently uses jsdom in node and native `DOMParser` in browser. Workers runtime has neither, but supports [`linkedom`](https://github.com/WebReflection/linkedom) (lightweight, no native deps) or [`HTMLRewriter`](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/) (streaming, less convenient for our nested extraction).

Plan: extend `PolyfillDOMParser.ts` with a third branch keyed off a build-time flag (`OMOT_RUNTIME=workers`). Same `parsePost` API.

The existing Jest fixture tests are the regression oracle — output must be byte-identical to the jsdom path on every fixture.

## Cache key & invalidation

```
key = `snapshot/v${PARSER_VERSION}/${sha256(archive_url)}.json`
```

Bumping `PARSER_VERSION` invalidates everything written by older parser logic. Old keys are left to R2 lifecycle expiry (30d) — no destructive purge needed.

## Worker config

`wrangler.toml` sketch:

```toml
name = "omot-edge"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[[r2_buckets]]
binding = "OMOT_CACHE"
bucket_name = "omot-cache"

[vars]
PARSER_VERSION = "1"
ARCHIVE_BASE = "https://web.archive.org"
```

CPU limit: default 50 ms is enough for cache hits; cache misses (parse) need the 30 s extended limit (`workers_dev = true` plus `usage_model = "bundled"` on Paid plan).

## Frontend changes

- New env-driven config: `NEXT_PUBLIC_OMOT_EDGE_URL` (default `https://omot-edge.ayanamists.workers.dev`, same self-host knob as `corsUrl.ts`).
- `getOnePage(config, cdxItem)` first tries the edge URL. On any error → Step 1 fallback path (proxy → archive.org → Worker parser).
- Removes the per-card heavy parse on cache hits; main thread only does JSON deserialisation.

## Acceptance

- Cold cache: P50 latency ≤ archive.org latency + 100 ms overhead.
- Warm cache (R2 hit): P95 < 500 ms globally.
- R2 hit rate on a sampled day > 70 % after 1 week of organic traffic.
- Worker outage: site remains functional via direct archive.org path.
- Parser fixture tests pass under all three runtime targets (node, browser, workers).

## Cost ceiling

| Item                      | Free tier    | Expected use       | Paid          |
|---------------------------|--------------|--------------------|---------------|
| Workers Paid              | n/a          | 1 plan             | $5/mo         |
| Workers requests          | 10 M / mo    | < 1 M / mo         | $0            |
| R2 storage                | 10 GB free   | 5–50 GB            | $0–$0.75/mo   |
| R2 Class A ops (writes)   | 1 M free     | < 100 k / mo       | $0            |
| R2 Class B ops (reads)    | 10 M free    | < 5 M / mo         | $0            |
| **Total**                 |              |                    | **~$5–6/mo**  |

## What I need from you (deferred)

This step *can be entirely written and tested locally with Miniflare* without any Cloudflare account interaction. The intervention point is at deploy:

1. Cloudflare account (free signup).
2. Run `wrangler login` once locally.
3. `wrangler r2 bucket create omot-cache`.
4. `wrangler deploy` (you press the button — I will not have a token).

I will produce `docs/runbook-omot-edge.md` with the exact command list before asking for this step.

## Out of scope (Step 2)

- D1, search, FTS — Step 3.
- Pre-warming popular accounts — Step 3.
- Authentication / rate-limit on the Worker — defer until needed.
- Image proxying — handle via wsrv.nl in a separate small task.

## Risk / open questions

- **Parser fragility on Workers:** linkedom's `DOMParser` is a subset; some parser code may rely on jsdom-only APIs. Fixture tests will surface this; budget half a day for fixes.
- **Workers CPU limit on cache miss:** if parse takes > 30 s on a giant snapshot, we'll need to fall through to "skip cache, proxy raw HTML, parse client-side" — which is exactly the Step 1 fallback path. So even pathological cases degrade safely.
- **Privacy / TOS:** caching tweet content publicly on R2. Document in README; add a takedown contact. This is a **user decision**, not a technical one — flag before deploy.
