export function parseDOM(str: string) {
  let JSDOM: typeof import('jsdom').JSDOM;
  if (typeof window === 'undefined') {
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