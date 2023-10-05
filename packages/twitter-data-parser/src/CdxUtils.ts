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
  const splitted = origUrl.split('/');
  const statusIdx = splitted.indexOf('status');
  if (statusIdx === -1) {
    return "NaN";
  }
  const preId = splitted[statusIdx + 1];
  const splitted2 = preId.split('?');
  return splitted2[0];
}