export type CdxItem = {
  urlKey: string,
  timestamp: string,
  original: string,
  mimetype: string,
  statusCode: number,
  digest: string,
  length: number,

  // appended
  id: string,
  date: Date
}

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
  const year = Number.parseInt(timestamp.substring(0, 4));
  const month = Number.parseInt(timestamp.substring(4, 6)) - 1;
  const day = Number.parseInt(timestamp.substring(6, 8));
  const hour = Number.parseInt(timestamp.substring(8, 10));
  const minute = Number.parseInt(timestamp.substring(10, 12));
  const second = Number.parseInt(timestamp.substring(12, 14));

  const date = new Date(year, month, day, hour, minute, second);
  return date;
}

export function parseCdxItem(cdxItem: string[]): CdxItem {
  return {
    urlKey: cdxItem[0],
    timestamp: cdxItem[1],
    original: cdxItem[2],
    mimetype: cdxItem[3],
    statusCode: Number.parseInt(cdxItem[4]),
    digest: cdxItem[5],
    length: Number.parseInt(cdxItem[6]),
    id: getCdxItemId(cdxItem),
    date: getCdxItemDate(cdxItem),
  }
}