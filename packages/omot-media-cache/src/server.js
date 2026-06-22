import fs from 'node:fs';
import http from 'node:http';
import { isAuthorized } from './auth.js';
import { fetchAndCacheImage } from './cache.js';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendFile(req, res, cached) {
  const headers = {
    'Content-Type': cached.meta.contentType,
    'Content-Length': String(cached.meta.bytes),
    'Cache-Control': CACHE_CONTROL,
    'X-Cache': cached.cacheStatus,
    'X-Content-Type-Options': 'nosniff',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(cached.dataPath).pipe(res);
}

export function createMediaCacheServer(config) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }

      if (url.pathname !== '/media' && url.pathname !== '/i') {
        sendJson(res, 404, { error: 'not found' });
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }

      if (!isAuthorized(req, config.key)) {
        sendJson(res, 401, { error: 'unauthorized' });
        return;
      }

      const sourceUrl = url.searchParams.get('url');
      if (!sourceUrl) {
        sendJson(res, 400, { error: 'missing url' });
        return;
      }

      const cached = await fetchAndCacheImage(sourceUrl, config);
      sendFile(req, res, cached);
    } catch (err) {
      const status = Number(err?.statusCode ?? 500);
      sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function listen(config) {
  const server = createMediaCacheServer(config);
  await new Promise((resolve) => server.listen(config.port, config.host, resolve));
  return server;
}
