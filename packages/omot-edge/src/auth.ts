import type { Env } from './types';

/**
 * Returns a 401 Response if OMOT_API_KEY is set and the request doesn't
 * carry a matching Bearer token. Returns null when the request is allowed.
 */
export function checkApiKey(request: Request, env: Env): Response | null {
  if (!env.OMOT_API_KEY) return null;
  const auth = request.headers.get('Authorization') ?? '';
  if (auth === `Bearer ${env.OMOT_API_KEY}`) return null;
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer', 'Access-Control-Allow-Origin': '*' },
  });
}
