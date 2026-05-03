import type { Env } from './types';
import { checkApiKey } from './auth';

// Route table — handlers are imported lazily so unused routes don't pull in
// parse dependencies on the healthz fast path.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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
      return handleSnapshot(request, env, ctx);
    }

    if (url.pathname === '/search') {
      if (request.method !== 'OPTIONS') {
        const deny = checkApiKey(request, env);
        if (deny) return deny;
      }
      const { handleSearch } = await import('./handlers/search');
      return handleSearch(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { handleScheduled } = await import('./handlers/prewarm');
    ctx.waitUntil(handleScheduled(env));
  },
} satisfies ExportedHandler<Env>;
