import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(__dir, '../migrations/0001_init.sql'), 'utf8');
const rederiveSnapshotTsSql = readFileSync(
  resolve(__dir, '../migrations/0002_rederive_snapshot_ts.sql'),
  'utf8',
);

describe('0001_init.sql', () => {
  it('creates the tweets table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tweets');
  });

  it('creates tweets_fts virtual table', () => {
    expect(sql).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS tweets_fts USING fts5');
  });

  it('defines all three FTS sync triggers', () => {
    expect(sql).toContain('tweets_ai');
    expect(sql).toContain('tweets_ad');
    expect(sql).toContain('tweets_au');
  });

  it('creates the access_log table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS access_log');
  });

  it('uses IF NOT EXISTS on all DDL so migrations are idempotent', () => {
    const creates = sql.match(/CREATE\s+(TABLE|VIRTUAL TABLE|INDEX|TRIGGER)/gi) ?? [];
    const safe    = sql.match(/CREATE\s+(TABLE|VIRTUAL TABLE|INDEX|TRIGGER)\s+IF\s+NOT\s+EXISTS/gi) ?? [];
    expect(safe.length).toBe(creates.length);
  });

  it('rederives search snapshot timestamps from archive URLs', () => {
    expect(rederiveSnapshotTsSql).toContain('WITH parsed AS');
    expect(rederiveSnapshotTsSql).toContain('UPDATE tweets');
    expect(rederiveSnapshotTsSql).toContain('SET snapshot_ts =');
    expect(rederiveSnapshotTsSql).toContain('archive_url');
    expect(rederiveSnapshotTsSql).toContain('derived.capture_ts <> tweets.snapshot_ts');
  });
});
