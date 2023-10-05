export function parseDOM(str: string) {
  let JSDOM: typeof import('jsdom').JSDOM;
  if (typeof window === 'undefined') {
    JSDOM = require('jsdom').JSDOM;
    const doc = new JSDOM(str).window.document;
    return doc;
  } else {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    return doc;
  }
}