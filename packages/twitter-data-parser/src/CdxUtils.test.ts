import {
  parseCdxItem,
  parseCdxHeader,
  parseCdxRows,
  CdxColumns,
} from './CdxUtils';

const DEFAULT_HEADER = ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'];
const TRIMMED_HEADER = ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'];

describe('parseCdxHeader', () => {
  it('maps the default 7-column archive.org schema', () => {
    const cols = parseCdxHeader(DEFAULT_HEADER);
    expect(cols).toEqual({
      urlKey: 0, timestamp: 1, original: 2, mimetype: 3,
      statusCode: 4, digest: 5, length: 6,
    });
  });

  it('maps a fl-trimmed schema with no urlkey or length', () => {
    const cols = parseCdxHeader(TRIMMED_HEADER);
    expect(cols).toEqual({
      timestamp: 0, original: 1, mimetype: 2, statusCode: 3, digest: 4,
    });
    expect(cols?.urlKey).toBeUndefined();
    expect(cols?.length).toBeUndefined();
  });

  it('returns undefined when a required field is missing', () => {
    // No `original` column — can't build a CdxItem.
    expect(parseCdxHeader(['timestamp', 'mimetype', 'statuscode', 'digest'])).toBeUndefined();
  });

  it('returns undefined for a non-header row', () => {
    expect(parseCdxHeader(['com,twitter)/jack/status/20', '20060321205014'])).toBeUndefined();
  });
});

describe('parseCdxItem', () => {
  it('parses a default-schema row with no cols arg (legacy callers)', () => {
    const row = ['com,twitter)/jack/status/20', '20060321205014',
      'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA', '1234'];
    const item = parseCdxItem(row);
    expect(item.id).toBe('20');
    expect(item.timestamp).toBe('20060321205014');
    expect(item.original).toBe('https://twitter.com/jack/status/20');
    expect(item.mimetype).toBe('text/html');
    expect(item.statusCode).toBe(200);
    expect(item.digest).toBe('AAAA');
    expect(item.urlKey).toBe('com,twitter)/jack/status/20');
    expect(item.length).toBe(1234);
  });

  it('parses a fl-trimmed row using explicit cols, omits urlKey/length', () => {
    const cols: CdxColumns = parseCdxHeader(TRIMMED_HEADER)!;
    const row = ['20060321205014', 'https://twitter.com/jack/status/20',
      'text/html', '200', 'AAAA'];
    const item = parseCdxItem(row, cols);
    expect(item.id).toBe('20');
    expect(item.original).toBe('https://twitter.com/jack/status/20');
    expect(item.mimetype).toBe('text/html');
    expect(item.statusCode).toBe(200);
    expect(item.digest).toBe('AAAA');
    expect(item.urlKey).toBeUndefined();
    expect(item.length).toBeUndefined();
  });
});

describe('parseCdxRows', () => {
  it('parses a default-schema response, skipping the header', () => {
    const rows = [
      DEFAULT_HEADER,
      ['com,twitter)/jack/status/20', '20060321205014',
        'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA', '1234'],
      ['com,twitter)/jack/status/21', '20060322000000',
        'https://twitter.com/jack/status/21', 'text/html', '200', 'BBBB', '999'],
    ];
    const items = parseCdxRows(rows);
    expect(items.map((i) => i.id)).toEqual(['20', '21']);
    expect(items[0].length).toBe(1234);
  });

  it('parses a fl-trimmed response, skipping the header', () => {
    const rows = [
      TRIMMED_HEADER,
      ['20060321205014', 'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA'],
      ['20060322000000', 'https://twitter.com/jack/status/21', 'text/html', '200', 'BBBB'],
    ];
    const items = parseCdxRows(rows);
    expect(items.map((i) => i.id)).toEqual(['20', '21']);
    expect(items[0].length).toBeUndefined();
    expect(items[0].urlKey).toBeUndefined();
  });

  it('returns [] when given an empty array', () => {
    expect(parseCdxRows([])).toEqual([]);
  });

  it('returns [] when the first row is not a valid header', () => {
    // First row looks like data — can't infer columns.
    const rows = [
      ['com,twitter)/jack/status/20', '20060321205014',
        'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA', '1234'],
    ];
    expect(parseCdxRows(rows)).toEqual([]);
  });

  it('skips rows that have no parseable status id', () => {
    const rows = [
      DEFAULT_HEADER,
      ['com,twitter)/jack/profile', '20060321205014',
        'https://twitter.com/jack', 'text/html', '200', 'AAAA', '1234'], // no /status/
      ['com,twitter)/jack/status/22', '20060322000000',
        'https://twitter.com/jack/status/22', 'text/html', '200', 'BBBB', '999'],
    ];
    const items = parseCdxRows(rows);
    expect(items.map((i) => i.id)).toEqual(['22']);
  });

  it('deduplicates repeated tweet IDs (keeps the first occurrence)', () => {
    const rows = [
      DEFAULT_HEADER,
      ['com,twitter)/jack/status/20', '20060321205014',
        'https://twitter.com/jack/status/20', 'text/html', '200', 'AAAA', '1234'],
      ['com,twitter)/jack/status/20', '20070101000000',
        'https://twitter.com/jack/status/20', 'text/html', '200', 'CCCC', '111'],
    ];
    const items = parseCdxRows(rows);
    expect(items).toHaveLength(1);
    expect(items[0].digest).toBe('AAAA');
  });
});
