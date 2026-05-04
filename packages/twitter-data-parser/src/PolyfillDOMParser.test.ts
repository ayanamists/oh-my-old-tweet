import { parseDOM, setDOMBackend } from './PolyfillDOMParser';

const HTML = '<html><body><p id="target">hello</p></body></html>';

describe('parseDOM', () => {
  afterEach(() => {
    setDOMBackend(null);
  });

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

  it('uses an injected backend when set, ignoring jsdom and DOMParser', () => {
    const mockDoc = { getElementById: () => ({ textContent: 'from backend' }) } as unknown as Document;
    const backend = jest.fn().mockReturnValue(mockDoc);
    setDOMBackend(backend);

    const doc = parseDOM(HTML);
    expect(backend).toHaveBeenCalledWith(HTML);
    expect(doc.getElementById('target')?.textContent).toBe('from backend');
  });

  it('falls back to default behaviour after backend is cleared with null', () => {
    const backend = jest.fn().mockReturnValue({} as Document);
    setDOMBackend(backend);
    parseDOM(HTML);
    expect(backend).toHaveBeenCalledTimes(1);

    setDOMBackend(null);
    const doc = parseDOM(HTML);
    expect(backend).toHaveBeenCalledTimes(1); // not called again
    expect(doc.getElementById('target')?.textContent).toBe('hello');
  });
});
