import type { Env } from './types';
import { checkApiKey } from './auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function corsError(status: number, err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Route table — handlers are imported lazily so unused routes don't pull in
// parse dependencies on the healthz fast path.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/healthz') {
        return new Response('ok', { status: 200 });
      }

      if (url.pathname === '/snapshot') {
        // Skip auth on OPTIONS preflight — browser sends it without credentials
        if (request.method !== 'OPTIONS') {
          const deny = checkApiKey(request, env);
          if (deny) return deny;
        }
        const { handleSnapshot } = await import('./handlers/snapshot');
        return await handleSnapshot(request, env, ctx);
      }

      if (url.pathname === '/search') {
        if (request.method !== 'OPTIONS') {
          const deny = checkApiKey(request, env);
          if (deny) return deny;
        }
        const { handleSearch } = await import('./handlers/search');
        return await handleSearch(request, env);
      }

      if (url.pathname === '/cdx') {
        if (request.method !== 'OPTIONS') {
          const deny = checkApiKey(request, env);
          if (deny) return deny;
        }
        const { handleCdx } = await import('./handlers/cdx');
        return await handleCdx(request, env, ctx);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      if (url.pathname === '/snapshot' || url.pathname === '/search' || url.pathname === '/cdx') {
        return corsError(500, err);
      }
      throw err;
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { handleScheduled } = await import('./handlers/prewarm');
    ctx.waitUntil(handleScheduled(env));
  },
} satisfies ExportedHandler<Env>;
