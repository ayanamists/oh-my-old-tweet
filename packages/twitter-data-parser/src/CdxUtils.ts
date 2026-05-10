export type CdxItem = {
  urlKey?: string,
  timestamp: string,
  original: string,
  mimetype: string,
  statusCode: number,
  digest: string,
  length?: number,

  // appended
  id: string,
  date: Date
}

// Maps CDX column index for each consumed field. `urlKey` and `length` are
// optional because `fl=` projection on the upstream lets us drop them.
export type CdxColumns = {
  urlKey?: number,
  timestamp: number,
  original: number,
  mimetype: number,
  statusCode: number,
  digest: number,
  length?: number,
};

// Default column layout when archive.org returns the full CDX schema (no `fl=`
// projection). Indices match the historical `cdxItem[0..6]` access pattern.
const DEFAULT_COLUMNS: CdxColumns = {
  urlKey: 0,
  timestamp: 1,
  original: 2,
  mimetype: 3,
  statusCode: 4,
  digest: 5,
  length: 6,
};

const HEADER_FIELD_TO_KEY: Record<string, keyof CdxColumns> = {
  urlkey: 'urlKey',
  timestamp: 'timestamp',
  original: 'original',
  mimetype: 'mimetype',
  statuscode: 'statusCode',
  digest: 'digest',
  length: 'length',
};

export function filterUniqueCdxItems(cdxItems: string[][]) {
  const idSet = new Set<String>();
  const res: string[][] = [];
  cdxItems.forEach((i) => {
    const id = getCdxItemId(i);
    if (!idSet.has(id) && isValidCdxItem(i)) {
      res.push(i);
      idSet.add(id);
    }
  })
  res.sort((a, b) => getCdxNumberId(a) - getCdxNumberId(b));
  return res;
}

export function isValidCdxItem(cdxItem: string[]) {
  return !Number.isNaN(getCdxNumberId(cdxItem));
}

export function getCdxNumberId(cdxItem: string[]) {
  return parseInt(getCdxItemId(cdxItem));
}

export function getCdxItemUrl(cdxItem: string[]) {
  return cdxItem[2];
}

export function getCdxItemId(cdxItem: string[]) {
  // TODO: use real url library for this
  const origUrl = getCdxItemUrl(cdxItem);
  return getTweetIdByUrl(origUrl);
}

export function getTweetIdByUrl(origUrl: string) {
  const splitted = origUrl.split('/');
  const statusIdx = splitted.indexOf('status');
  if (statusIdx === -1) {
    return "NaN";
  }
  const preId = splitted[statusIdx + 1];
  const splitted2 = preId.split('?');
  return splitted2[0];
}

export function getCdxItemDate(cdxItem: string[]) {
  const timestamp = cdxItem[1];
  return parseTimeStamp(timestamp);
}

export function parseTimeStamp(timestamp: string) {
  const year = Number.parseInt(timestamp.substring(0, 4));
  const month = Number.parseInt(timestamp.substring(4, 6)) - 1;
  const day = Number.parseInt(timestamp.substring(6, 8));
  const hour = Number.parseInt(timestamp.substring(8, 10));
  const minute = Number.parseInt(timestamp.substring(10, 12));
  const second = Number.parseInt(timestamp.substring(12, 14));

  const date = new Date(year, month, day, hour, minute, second);
  return date;
}

// Returns the column layout for a CDX response header row, or undefined if it
// doesn't look like one (e.g. caller passed a data row, or the schema is
// missing fields we need to build a CdxItem).
export function parseCdxHeader(header: string[]): CdxColumns | undefined {
  if (!Array.isArray(header)) return undefined;
  const cols: Partial<CdxColumns> = {};
  for (let i = 0; i < header.length; i++) {
    const key = HEADER_FIELD_TO_KEY[header[i]];
    if (key !== undefined) {
      cols[key] = i;
    }
  }
  if (
    cols.timestamp === undefined ||
    cols.original === undefined ||
    cols.mimetype === undefined ||
    cols.statusCode === undefined ||
    cols.digest === undefined
  ) {
    return undefined;
  }
  return cols as CdxColumns;
}

export function parseCdxItem(cdxItem: string[], cols: CdxColumns = DEFAULT_COLUMNS): CdxItem {
  const original = cdxItem[cols.original];
  const timestamp = cdxItem[cols.timestamp];
  const item: CdxItem = {
    timestamp,
    original,
    mimetype: cdxItem[cols.mimetype],
    statusCode: Number.parseInt(cdxItem[cols.statusCode]),
    digest: cdxItem[cols.digest],
    id: getTweetIdByUrl(original ?? ''),
    date: parseTimeStamp(timestamp ?? ''),
  };
  if (cols.urlKey !== undefined) item.urlKey = cdxItem[cols.urlKey];
  if (cols.length !== undefined) item.length = Number.parseInt(cdxItem[cols.length]);
  return item;
}

// Parses a full archive.org CDX JSON response (header row + data rows) into
// CdxItems. Tolerates any `fl=` projection because columns are resolved by
// header name, not positional index. Skips the header row, malformed rows,
// and duplicate tweet IDs.
export function parseCdxRows(rows: string[][]): CdxItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const cols = parseCdxHeader(rows[0]);
  if (!cols) return [];
  const seen = new Set<string>();
  const items: CdxItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const item = parseCdxItem(row, cols);
    if (item.id === 'NaN' || Number.isNaN(item.date.getTime())) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
