import type { Post, ArchiveTweetInfo } from "twitter-data-parser";

interface PendingCall {
  resolve: (value: Post | undefined) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let idCounter = 0;
const pending = new Map<number, PendingCall>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    worker.addEventListener("message", (e: MessageEvent) => {
      const { id, result, error } = e.data as { id: number; result: Post | null; error?: string };
      const call = pending.get(id);
      if (!call) return;
      pending.delete(id);
      if (error) {
        call.reject(new Error(error));
      } else {
        call.resolve(result ?? undefined);
      }
    });
    worker.addEventListener("error", (e: ErrorEvent) => {
      for (const call of pending.values()) {
        call.reject(new Error(`Parser worker error: ${e.message}`));
      }
      pending.clear();
      worker = null;
    });
  }
  return worker;
}

export function parseInWorker(html: string, meta: ArchiveTweetInfo): Promise<Post | undefined> {
  return new Promise((resolve, reject) => {
    const id = ++idCounter;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, html, meta });
  });
}
