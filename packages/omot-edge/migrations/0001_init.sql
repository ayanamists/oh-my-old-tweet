-- Tweet metadata index.
-- Source of truth is R2; this table is derived and can be rebuilt.
CREATE TABLE IF NOT EXISTS tweets (
  id             TEXT    PRIMARY KEY,
  username       TEXT    NOT NULL,
  user_id        TEXT,
  snapshot_ts    INTEGER NOT NULL,
  archive_url    TEXT    NOT NULL,
  text           TEXT    NOT NULL DEFAULT '',
  has_media      INTEGER NOT NULL DEFAULT 0,
  parser_version INTEGER NOT NULL DEFAULT 1,
  inserted_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tweets_username_ts ON tweets (username, snapshot_ts);

-- FTS5 virtual table over tweet text.
CREATE VIRTUAL TABLE IF NOT EXISTS tweets_fts USING fts5 (
  text,
  content     = 'tweets',
  content_rowid = 'rowid',
  tokenize    = 'unicode61'
);

-- Keep FTS in sync with the base table.
CREATE TRIGGER IF NOT EXISTS tweets_ai AFTER INSERT ON tweets BEGIN
  INSERT INTO tweets_fts (rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS tweets_ad AFTER DELETE ON tweets BEGIN
  INSERT INTO tweets_fts (tweets_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER IF NOT EXISTS tweets_au AFTER UPDATE ON tweets BEGIN
  INSERT INTO tweets_fts (tweets_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO tweets_fts (rowid, text) VALUES (new.rowid, new.text);
END;

-- Access log for cron pre-warming: tracks per-username hit counts.
CREATE TABLE IF NOT EXISTS access_log (
  username TEXT    PRIMARY KEY,
  hits     INTEGER NOT NULL DEFAULT 0,
  last_hit INTEGER NOT NULL DEFAULT (unixepoch())
);
