-- `snapshot_ts` is the Wayback capture timestamp, not the tweet creation time.
-- Older Worker builds wrote `post.date` here, so rederive it from archive_url.
WITH parsed AS (
  SELECT
    rowid AS tweet_rowid,
    substr(archive_url, instr(archive_url, '/web/') + 5, 14) AS ts
  FROM tweets
  WHERE instr(archive_url, '/web/') > 0
),
derived AS (
  SELECT
    tweet_rowid,
    unixepoch(
      substr(ts, 1, 4) || '-' ||
      substr(ts, 5, 2) || '-' ||
      substr(ts, 7, 2) || ' ' ||
      substr(ts, 9, 2) || ':' ||
      substr(ts, 11, 2) || ':' ||
      substr(ts, 13, 2)
    ) AS capture_ts
  FROM parsed
  WHERE length(ts) = 14
    AND ts NOT GLOB '*[^0-9]*'
)
UPDATE tweets
SET snapshot_ts = (
  SELECT capture_ts
  FROM derived
  WHERE derived.tweet_rowid = tweets.rowid
)
WHERE EXISTS (
  SELECT 1
  FROM derived
  WHERE derived.tweet_rowid = tweets.rowid
    AND derived.capture_ts IS NOT NULL
    AND derived.capture_ts <> tweets.snapshot_ts
);
