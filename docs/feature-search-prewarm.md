# Step 3 — Search & Pre-warm (D1 + Cron)

**Status:** not started (blocked on Step 2 Worker)
**Cost impact:** still $5–8/mo total (D1 free tier covers expected load)
**Goal:** add the one feature the current pure-frontend lacks vs. the abandoned `omot-server` — full-text search across cached tweets — and make first-visit fast for popular accounts.

## Why

After Step 2, every tweet anyone has ever loaded lives in R2 as parsed JSON. R2 is a key/value store: great for "give me this snapshot," useless for "find tweets containing X." A small SQL+FTS index over the same data unlocks search at near-zero cost. D1's free tier (5 GB, 5 M reads/day) is more than enough for the metadata.

A daily cron pre-warming top accounts means even *first*-time visitors of popular pages get an R2 hit, not an archive.org wait.

## Architecture

```
Worker /snapshot (Step 2)
     ├─ R2 PUT  ── async ─▶  D1 UPSERT tweets(...)        # side-write, best-effort
     └─ ...

Worker /search?q=&user=&from=&to=
     └─ D1 SELECT ... FROM tweets_fts WHERE ... LIMIT 50

Worker cron (daily 04:00 UTC)
     ├─ D1 SELECT top 100 usernames by recent access
     └─ for each: re-run CDX, fetch newly-seen snapshots into R2/D1
```

D1 is **derived state**. R2 is the source of truth. Losing D1 just means rebuilding the index by replaying R2 — never blocks the main fetch path.

## D1 schema

```sql
CREATE TABLE tweets (
  id              TEXT PRIMARY KEY,        -- archive snapshot id
  username        TEXT NOT NULL,
  user_id         TEXT,                    -- twitter numeric id when known
  snapshot_ts     INTEGER NOT NULL,        -- unix seconds
  archive_url     TEXT NOT NULL,
  text            TEXT NOT NULL,
  has_media       INTEGER NOT NULL DEFAULT 0,
  parser_version  INTEGER NOT NULL,
  inserted_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_tweets_username_ts ON tweets(username, snapshot_ts);

CREATE VIRTUAL TABLE tweets_fts USING fts5(
  text,
  content='tweets',
  content_rowid='rowid',
  tokenize = 'unicode61'
);

CREATE TRIGGER tweets_ai AFTER INSERT ON tweets BEGIN
  INSERT INTO tweets_fts(rowid, text) VALUES (new.rowid, new.text);
END;
-- (matching AD/AU triggers omitted for brevity; see migrations/0001_init.sql)

CREATE TABLE access_log (
  username    TEXT PRIMARY KEY,
  hits        INTEGER NOT NULL DEFAULT 0,
  last_hit    INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Migrations live in `packages/omot-edge/migrations/`. Wrangler manages them.

## /search endpoint

```
GET /search?q=<query>&user=<optional>&from=<unix>&to=<unix>&limit=50
```

- `q`: FTS5 MATCH against `tweets_fts.text`.
- `user`: exact match on `username` (case-insensitive).
- `from` / `to`: range on `snapshot_ts`.
- Result shape: `{ id, username, snapshot_ts, archive_url, text_snippet }`.
- Cache `Cache-Control: public, max-age=60` — fresh enough; cheap miss.

Failure modes:
- D1 unavailable → 503; frontend hides search UI gracefully.
- Empty FTS → 200 with empty array.

## Side-write semantics

The Worker writes D1 via `ctx.waitUntil(...)` so the main /snapshot response isn't blocked. If D1 write fails, log + continue — search index will be slightly stale but R2 is still authoritative.

```ts
ctx.waitUntil(
  env.OMOT_DB.prepare('INSERT OR REPLACE INTO tweets ...').run().catch(logErr)
);
```

## Cron pre-warm

`wrangler.toml`:

```toml
[triggers]
crons = ["0 4 * * *"]
```

Worker `scheduled` handler:

1. `SELECT username FROM access_log ORDER BY hits DESC LIMIT 100`.
2. For each: call own `/snapshot` for any new CDX entries since `last_hit`.
3. Bound total runtime to 5 min; bail if hitting wall-clock budget.

Daily request volume estimate: 100 accounts × ~10 new snapshots ≈ 1 000 archive.org requests/day. Well under any rate limit.

## Frontend search UI

- New route `app/search/page.tsx`.
- Search box, optional user filter (autocompleted from D1), date range picker (reuse the existing `@mui/x-date-pickers`).
- Results: virtualised list of `LoadableTCard`s, clicking opens the existing snapshot view.
- Fully degrades: if `NEXT_PUBLIC_OMOT_EDGE_URL` not set or /search returns 503, hide the nav entry.

## Acceptance

- `/search?q=foo` P95 < 1 s with 100 k indexed tweets.
- New tweet visible in search within ≤ 60 s of first /snapshot fetch.
- Pre-warm cron completes in < 5 min, populates new snapshots for top accounts.
- Killing D1 (or feature-flag off) does not break the main timeline path.

## Cost

D1 free tier: 5 GB storage, 5 M reads/day, 100 k writes/day. At our scale this is comfortable; no expected paid usage.

Total Step 1+2+3: **~$5–8/mo**, dominated by Workers Paid plan.

## What I need from you (deferred)

Same as Step 2 + one extra:

1. `wrangler d1 create omot-db` — produces a database id you paste into `wrangler.toml`.
2. `wrangler d1 migrations apply omot-db` — first time only.
3. Approve before I run any **destructive** SQL against the prod D1 (per CLAUDE.md spirit).

## Out of scope (Step 3)

- Cross-language search / stemming — `unicode61` is enough for v1.
- User account features, saved searches, alerts.
- Image OCR / video transcript indexing.
- gallery-dl import — separate task; can be Step 1-style frontend work.

## Risk / open questions

- **D1 query timeout** on FTS over large indexes: monitor; can shard by year if needed.
- **Snippet generation:** D1 supports FTS5 `snippet()` — verify it works in Workers binding.
- **Privacy / GDPR:** indexable searchable archive of tweets has stronger implications than a per-snapshot cache. Worth a README disclaimer + an opt-out username list (denylist in D1).
