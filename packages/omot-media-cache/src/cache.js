import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'svg',
]);

const CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
};

export function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

export function isAllowedSourceUrl(rawUrl, allowedHosts) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return allowedHosts.some((allowed) => {
    const normalized = allowed.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export function extensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const basename = path.basename(pathname).toLowerCase();
  const match = basename.match(/\.([a-z0-9]+)$/);
  if (!match) return undefined;
  return IMAGE_EXTENSIONS.has(match[1]) ? match[1] : undefined;
}

export function extensionFromContentType(contentType) {
  const type = contentType.split(';', 1)[0].trim().toLowerCase();
  return CONTENT_TYPE_EXTENSIONS[type];
}

export function pathsFor(rootDir, sourceUrl, extension) {
  const hash = hashUrl(sourceUrl);
  const shardA = hash.slice(0, 2);
  const shardB = hash.slice(2, 4);
  const dir = path.join(rootDir, shardA, shardB);
  return {
    hash,
    dir,
    dataPath: path.join(dir, `${hash}.${extension}`),
    metaPath: path.join(dir, `${hash}.json`),
    tempPath: path.join(dir, `${hash}.${process.pid}.${Date.now()}.tmp`),
  };
}

export async function readCachedMeta(rootDir, sourceUrl) {
  const hash = hashUrl(sourceUrl);
  const metaPath = path.join(rootDir, hash.slice(0, 2), hash.slice(2, 4), `${hash}.json`);
  try {
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    const dataPath = path.join(path.dirname(metaPath), `${hash}.${meta.extension}`);
    await fsp.access(dataPath, fs.constants.R_OK);
    return { meta, dataPath };
  } catch {
    return null;
  }
}

export async function fetchAndCacheImage(sourceUrl, options) {
  const cached = await readCachedMeta(options.rootDir, sourceUrl);
  if (cached) return { ...cached, cacheStatus: 'HIT' };

  if (!isAllowedSourceUrl(sourceUrl, options.allowedHosts)) {
    throw Object.assign(new Error('Source URL host is not allowed'), { statusCode: 400 });
  }

  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'omot-media-cache/0.1',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(options.fetchTimeoutMs),
  });

  if (!response.ok || !response.body) {
    throw Object.assign(new Error(`upstream returned ${response.status}`), { statusCode: 502 });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const extension = extensionFromContentType(contentType) ?? extensionFromUrl(sourceUrl);
  if (!extension || (contentType && !contentType.toLowerCase().startsWith('image/'))) {
    throw Object.assign(new Error(`upstream is not an image (${contentType || 'unknown type'})`), { statusCode: 502 });
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > options.maxBytes) {
    throw Object.assign(new Error(`image is too large (${declaredLength} bytes)`), { statusCode: 413 });
  }

  const paths = pathsFor(options.rootDir, sourceUrl, extension);
  await fsp.mkdir(paths.dir, { recursive: true });

  let bytes = 0;
  const out = fs.createWriteStream(paths.tempPath, { flags: 'wx' });
  try {
    for await (const chunk of Readable.fromWeb(response.body)) {
      bytes += chunk.byteLength;
      if (bytes > options.maxBytes) {
        throw Object.assign(new Error(`image is too large (${bytes} bytes)`), { statusCode: 413 });
      }
      if (!out.write(chunk)) {
        await new Promise((resolve, reject) => {
          out.once('drain', resolve);
          out.once('error', reject);
        });
      }
    }
    await new Promise((resolve, reject) => {
      out.end(resolve);
      out.once('error', reject);
    });
  } catch (err) {
    out.destroy();
    await fsp.rm(paths.tempPath, { force: true });
    throw err;
  }

  const meta = {
    sourceUrl,
    hash: paths.hash,
    extension,
    contentType: contentType || `image/${extension}`,
    bytes,
    fetchedAt: new Date().toISOString(),
  };
  await fsp.rename(paths.tempPath, paths.dataPath);
  await fsp.writeFile(paths.metaPath, JSON.stringify(meta, null, 2));

  return { meta, dataPath: paths.dataPath, cacheStatus: 'MISS' };
}
