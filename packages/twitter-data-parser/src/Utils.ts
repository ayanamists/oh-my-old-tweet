export function getWarn(str: string) {
  return `[TWEET PARSER]: ${str}`
}

const ARCHIVE_PREFIX_RE = /^https?:\/\/web\.archive\.org\/web\/\d+(?:[a-z]+_)?\/(.+)$/;

export function stripArchivePrefix(url: string): string {
  const m = url.match(ARCHIVE_PREFIX_RE);
  return m ? m[1] : url;
}

// Wrap any URL in the snapshot's `im_` mode without touching the URL form.
// Use this for avatars and for media that the snapshot stored under its
// original `.jpg` filename (the v1 API / pre-2023 crawler era).
export function fixImageUrl(url: string, info: { timestamp: string }): string {
  const original = stripArchivePrefix(url);
  return `https://web.archive.org/web/${info.timestamp}im_/${original}`;
}

// Rewrite a Twitter media URL to the `?format=<ext>&name=orig` query form
// that newer archive.org crawls actually have captures for. Use this when
// the snapshot is recent enough that archive.org normalized media to query
// form before storing it (v2 API JSON era). Leaves URLs alone if they're
// already in `?format=&name=` form so we don't blow away the size variant.
export function fixImageUrlNew(url: string, info: { timestamp: string }): string {
  const original = stripArchivePrefix(url);
  const urlObj = new URL(original);

  // Already in query form (e.g. ?format=jpg&name=large) — preserve as-is.
  if (urlObj.searchParams.has('format')) {
    return `https://web.archive.org/web/${info.timestamp}im_/${original}`;
  }

  const path = urlObj.pathname;
  const segs = path.split('/');
  const fileName = segs[segs.length - 1];

  // Twitter sometimes appends `:large` / `:small` / `:orig` to the filename
  // (e.g. media/X.jpg:large). Strip that before splitting the extension.
  const colonIdx = fileName.indexOf(':');
  const cleanFileName = colonIdx >= 0 ? fileName.slice(0, colonIdx) : fileName;

  const dotIndex = cleanFileName.lastIndexOf('.');
  if (dotIndex < 0) {
    // No extension to convert — fall back to the plain im_ wrap.
    return `https://web.archive.org/web/${info.timestamp}im_/${original}`;
  }
  const baseName = cleanFileName.slice(0, dotIndex);
  const ext = cleanFileName.slice(dotIndex + 1);

  const newPath = path.slice(0, path.length - fileName.length) + baseName;
  return `https://web.archive.org/web/${info.timestamp}im_/${urlObj.origin}${newPath}?format=${ext}&name=orig`;
}
