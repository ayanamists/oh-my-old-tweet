import path from 'node:path';

export function loadConfig(env = process.env) {
  const key = env.MEDIA_CACHE_KEY ?? env.OMOT_API_KEY;
  if (!key) {
    throw new Error('MEDIA_CACHE_KEY or OMOT_API_KEY is required');
  }

  return {
    key,
    rootDir: path.resolve(env.MEDIA_CACHE_DIR ?? '.cache/omot-media'),
    host: env.MEDIA_CACHE_HOST ?? '127.0.0.1',
    port: Number(env.MEDIA_CACHE_PORT ?? 8789),
    maxBytes: Number(env.MEDIA_CACHE_MAX_BYTES ?? 50 * 1024 * 1024),
    fetchTimeoutMs: Number(env.MEDIA_CACHE_FETCH_TIMEOUT_MS ?? 45_000),
    allowedHosts: (env.MEDIA_ALLOWED_HOSTS ?? 'web.archive.org,pbs.twimg.com,video.twimg.com,abs.twimg.com')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  };
}
