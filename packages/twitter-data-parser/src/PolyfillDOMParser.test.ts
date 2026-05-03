import { parseDOM } from './PolyfillDOMParser';

const HTML = '<html><body><p id="target">hello</p></body></html>';

describe('parseDOM', () => {
  it('parses HTML in node (jsdom path) and returns a Document', () => {
    // In this jest env DOMParser is undefined, so jsdom runs.
    expect(typeof DOMParser).toBe('undefined');
    const doc = parseDOM(HTML);
    expect(doc.getElementById('target')?.textContent).toBe('hello');
  });

  it('uses native DOMParser when available (browser / Web Worker path)', () => {
    // Simulate an environment where DOMParser exists (browser or Worker).
    const mockDoc = { getElementById: () => ({ textContent: 'hello' }) };
    const mockParser = { parseFromString: jest.fn().mockReturnValue(mockDoc) };
    (global as any).DOMParser = jest.fn().mockImplementation(() => mockParser);

    const doc = parseDOM(HTML);
    expect(mockParser.parseFromString).toHaveBeenCalledWith(HTML, 'text/html');
    expect(doc.getElementById('target')?.textContent).toBe('hello');

    delete (global as any).DOMParser;
  });
});
