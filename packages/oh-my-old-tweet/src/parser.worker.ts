import { parsePost } from "twitter-data-parser";
import type { ArchiveTweetInfo } from "twitter-data-parser";

interface ParseRequest {
  id: number;
  html: string;
  meta: ArchiveTweetInfo;
}

self.addEventListener("message", (e: MessageEvent<ParseRequest>) => {
  const { id, html, meta } = e.data;
  try {
    const result = parsePost(html, meta) ?? null;
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, result: null, error: String(err) });
  }
});
