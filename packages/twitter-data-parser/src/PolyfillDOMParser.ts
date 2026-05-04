type DOMBackend = (html: string) => Document;

let customBackend: DOMBackend | null = null;

// Lets a host environment override the DOM backend used by parsePost.
// Cloudflare Workers can't load jsdom (Node-only) and don't expose a
// global DOMParser, so omot-edge injects linkedom via this hook.
export function setDOMBackend(fn: DOMBackend | null): void {
  customBackend = fn;
}

export function parseDOM(str: string) {
  if (customBackend) {
    return customBackend(str);
  }
  let JSDOM: typeof import('jsdom').JSDOM;
  if (typeof DOMParser === 'undefined') {
    // Node environment (no DOMParser) — fall back to jsdom.
    const jsdom = require('jsdom');
    JSDOM = jsdom.JSDOM;
    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.on("error", () => {
      // No-op to skip console errors.
    });
    const doc = new JSDOM(str, { virtualConsole }).window.document;
    return doc;
  } else {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    return doc;
  }
}
