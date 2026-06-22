export interface Env {
  OMOT_CACHE: R2Bucket;
  OMOT_DB: D1Database;
  PARSER_VERSION: string;
  ARCHIVE_BASE: string;
  /** When set, protected routes must carry Authorization: Bearer <key> */
  OMOT_API_KEY?: string;
}
