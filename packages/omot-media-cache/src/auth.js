export function isAuthorized(request, expectedKey) {
  if (!expectedKey) return false;

  const url = new URL(request.url, 'http://localhost');
  if (url.searchParams.get('key') === expectedKey) return true;

  const auth = request.headers.authorization ?? '';
  return auth === `Bearer ${expectedKey}`;
}
