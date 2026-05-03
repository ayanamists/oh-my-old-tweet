# Step 1 — Frontend Hardening

**Status:** in progress
**Cost impact:** $0/mo
**Goal:** ship a noticeably faster, more resilient pure-frontend experience without touching any backend, and stand up the test harness that Step 2/3 will rely on.

## Why

archive.org calls dominate latency. A user opening a 100-tweet timeline triggers ~100 cross-origin fetches followed by ~100 main-thread HTML parses. The frontend has no persistent cache, the parser blocks the UI, and the entire pipeline depends on a single Cloudflare Worker (`cors-proxy.ayanamists.workers.dev`) hard-coded in `src/corsUrl.ts`.

This step removes those bottlenecks while staying purely client-side, so it can ship to GitHub Pages with no infra cost.

## Scope

1. **IndexedDB persistent cache.** Replace the `localStorage`-based `useCachedFetch.ts` with an IndexedDB store keyed on `cdxItem.id` (snapshot URL hash). Snapshots are immutable — TTL can be 30 days, eviction LRU when over a configurable byte budget (default 50 MB). Survives reload; `localStorage` did not.
2. **Web Worker parser.** Today `parsePost` (jsdom in node, native DOMParser in browser) runs on the main thread; long timelines freeze input. Move the parse step into a Web Worker via a thin RPC layer. Parser code itself stays unchanged where possible — only `PolyfillDOMParser.ts` and the `parsePost` entry need a Worker-friendly wrapper.
3. **Streaming render.** `Timeline.tsx` currently waits for the full CDX list before rendering. Switch to: render skeletons for the first page immediately, replace each skeleton in place as its snapshot resolves. `LoadableTCard` already has the per-card loading shape — wire it up so cards mount before their data lands.
4. **Multi-proxy fallback.** Turn `corsUrl.ts` from a single prefix into an ordered list with health probes. On `fetch` error or non-2xx, fall through to the next entry; surface the active proxy in settings UI. Default list keeps the existing Cloudflare Worker first, plus 1–2 public CORS proxies as fallback. Self-hosters can override via existing `localStorage` config.
5. **CDX `collapse=digest`.** `fetchOneCdx` in `Data.ts` requests up to 100 000 results. Adding `collapse=digest` collapses identical-content snapshots, often halving the count. Pure URL change.

## Test harness (per CLAUDE.md)

This step also bootstraps the project's first real test setup for the frontend package.

- **Unit:** Vitest with `jsdom` environment for pure logic (cache key derivation, proxy rotation, CDX URL builder). `packages/oh-my-old-tweet/vitest.config.ts`.
- **Integration / E2E:** Playwright in **headless mode only** (`headless: true` enforced; CI and local). Used for IndexedDB, Web Worker, streaming render, multi-proxy failover — anything that depends on real browser semantics.
- The parser package keeps its existing Jest setup; not touching that here.
- A pre-commit / CI script will fail if `headless: false` appears in any Playwright config or test.

## Acceptance

- Returning user (cache hit on CDX + most snapshots) sees first 20 cards in **< 200 ms** from navigation to visible.
- Cold user sees first card in **< 1/3** of the current cold-start time on a 100-tweet timeline.
- Killing the default CORS proxy (simulated 5xx) does not break the page; a fallback takes over within one request cycle.
- All new code paths covered by either a Vitest unit test or a Playwright headless E2E test. CI green.

## Out of scope (Step 1)

- Anything that requires a server or Cloudflare account — saved for Step 2.
- Search across users — Step 3.
- Retweets/Replies parser improvements — orthogonal cleanup, not blocking UX wins.
- Mobile / iOS-specific layout fixes (the `// TODO: iOS` in `Timeline.tsx`) — track separately.

## Risk / open questions

- **Web Worker bundling under Next.js 14.** `next.config.mjs` may need a `webpack` tweak to emit a separate worker chunk. If it gets ugly, fall back to `Comlink` + `new Worker(new URL(...), { type: 'module' })` and let Next handle it.
- **IndexedDB quota on iOS Safari** is stricter than Chromium. The 50 MB default may need to be lower; expose as setting.
- **CDX `collapse=digest`** can rarely hide a tweet edit if only the digest differs. Acceptable trade-off for >50 % fetch reduction; document in README.

## File touch list (predicted)

- `packages/oh-my-old-tweet/src/useCachedFetch.ts` — rewrite around IndexedDB.
- `packages/oh-my-old-tweet/src/corsUrl.ts` — list + failover.
- `packages/oh-my-old-tweet/src/Data.ts` — CDX query change, plumb proxy failover.
- `packages/oh-my-old-tweet/src/Timeline.tsx` — streaming render.
- `packages/oh-my-old-tweet/src/LoadableTCard.tsx` — skeleton state.
- `packages/twitter-data-parser/src/index.ts` (+ new `worker.ts`) — Worker entry.
- `packages/oh-my-old-tweet/src/parserClient.ts` (new) — Worker RPC wrapper.
- `packages/oh-my-old-tweet/vitest.config.ts` (new), `playwright.config.ts` (new), `tests/` (new).
