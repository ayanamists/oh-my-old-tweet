import { openDB, IDBPDatabase } from 'idb';
import type { Post } from 'twitter-data-parser';

const DB_NAME = 'omot-cache';
const DB_VERSION = 1;
const STORE = 'snapshots';

export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CachedEntry {
  id: string;
  post: Post | null;
  cachedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt');
        }
      },
    });
  }
  return dbPromise;
}

function reviveDate(post: Post | null): Post | null {
  if (post && !(post.date instanceof Date)) {
    post.date = new Date(post.date as unknown as string);
  }
  return post;
}

export type CacheLookup =
  | { kind: 'miss' }
  | { kind: 'hit'; post: Post }
  | { kind: 'negative' };

export async function getCached(id: string, ttlMs: number = DEFAULT_TTL_MS): Promise<CacheLookup> {
  const db = await getDb();
  const entry = (await db.get(STORE, id)) as CachedEntry | undefined;
  if (!entry) return { kind: 'miss' };
  if (Date.now() - entry.cachedAt >= ttlMs) return { kind: 'miss' };
  if (entry.post == null) return { kind: 'negative' };
  return { kind: 'hit', post: reviveDate(entry.post) as Post };
}

export async function setCached(id: string, post: Post | null): Promise<void> {
  const db = await getDb();
  const entry: CachedEntry = { id, post, cachedAt: Date.now() };
  try {
    await db.put(STORE, entry);
  } catch (err) {
    if (isQuotaExceeded(err)) {
      await evictOldest(db, 0.5);
      try {
        await db.put(STORE, entry);
      } catch {
        // best-effort: drop the write rather than crash the page
      }
    } else {
      console.warn('[IdbCache] put failed', err);
    }
  }
}

function isQuotaExceeded(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
}

async function evictOldest(db: IDBPDatabase, fraction: number): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite');
  const total = await tx.store.count();
  let toDelete = Math.ceil(total * fraction);
  if (toDelete <= 0) {
    await tx.done;
    return;
  }
  let cursor = await tx.store.index('cachedAt').openCursor();
  while (cursor && toDelete > 0) {
    await cursor.delete();
    cursor = await cursor.continue();
    toDelete--;
  }
  await tx.done;
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

export async function countCached(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

export function __resetForTests(): void {
  dbPromise = null;
}
