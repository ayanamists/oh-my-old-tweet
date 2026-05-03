export interface Env {
  OMOT_CACHE: R2Bucket;
  OMOT_DB: D1Database;
  PARSER_VERSION: string;
  ARCHIVE_BASE: string;
  /** When set, all /snapshot and /search requests must carry Authorization: Bearer <key> */
  OMOT_API_KEY?: string;
}
