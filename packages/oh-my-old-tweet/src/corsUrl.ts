export type CorsProxyConfig = {
  mode: number;
  prefix: string;
  urlEncoding: boolean;
  fallbacks?: string[];
  /** omot-edge Worker base URL, e.g. https://omot-edge.your-subdomain.workers.dev */
  edgeUrl?: string;
  /** Bearer token for omot-edge — leave blank if OMOT_API_KEY is not set on the Worker */
  apiKey?: string;
  /** Private media-cache origin, e.g. https://media.example.com */
  mediaCacheUrl?: string;
  /** Query-string key for the private media-cache origin */
  mediaCacheKey?: string;
};

const defaultPrefix = "https://cors-proxy.ayanamists.workers.dev/?target=";
const defaultEdgeUrl = 'https://omot-edge.ayanamists.workers.dev';

const key = "omot-cors-config";

export const defaultConfig: CorsProxyConfig = {
  mode: 1,
  prefix: defaultPrefix,
  urlEncoding: true,
  fallbacks: [],
  edgeUrl: defaultEdgeUrl,
};

function getRuntimeApiKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const read = (params: URLSearchParams) =>
    params.get('apikey') ?? params.get('apiKey') ?? params.get('api_key');

  const searchValue = read(new URLSearchParams(window.location.search));
  if (searchValue?.trim()) return searchValue.trim();

  const hashQueryStart = window.location.hash.indexOf('?');
  if (hashQueryStart !== -1) {
    const hashValue = read(new URLSearchParams(window.location.hash.slice(hashQueryStart + 1)));
    if (hashValue?.trim()) return hashValue.trim();
  }

  return undefined;
}

function getRuntimeMediaConfig(): Pick<CorsProxyConfig, 'mediaCacheUrl' | 'mediaCacheKey'> {
  if (typeof window === 'undefined') return {};

  const read = (params: URLSearchParams) => ({
    mediaCacheUrl: params.get('media') ?? params.get('mediaUrl') ?? params.get('media_cache_url') ?? undefined,
    mediaCacheKey: params.get('mediakey') ?? params.get('mediaKey') ?? params.get('media_key') ?? undefined,
  });

  const fromSearch = read(new URLSearchParams(window.location.search));
  const result: Pick<CorsProxyConfig, 'mediaCacheUrl' | 'mediaCacheKey'> = {};
  if (fromSearch.mediaCacheUrl?.trim()) result.mediaCacheUrl = fromSearch.mediaCacheUrl.trim();
  if (fromSearch.mediaCacheKey?.trim()) result.mediaCacheKey = fromSearch.mediaCacheKey.trim();

  const hashQueryStart = window.location.hash.indexOf('?');
  if (hashQueryStart !== -1) {
    const fromHash = read(new URLSearchParams(window.location.hash.slice(hashQueryStart + 1)));
    if (fromHash.mediaCacheUrl?.trim()) result.mediaCacheUrl = fromHash.mediaCacheUrl.trim();
    if (fromHash.mediaCacheKey?.trim()) result.mediaCacheKey = fromHash.mediaCacheKey.trim();
  }

  return result;
}

export function getDefaultConfig(): CorsProxyConfig {
  const loaded = localStorage.getItem(key);
  const parsed = (loaded == null ? {} : JSON.parse(loaded)) as CorsProxyConfig;
  if (!Array.isArray(parsed.fallbacks)) parsed.fallbacks = [];
  const next = { ...defaultConfig, ...parsed };
  const runtimeApiKey = getRuntimeApiKey();
  const runtimeMedia = getRuntimeMediaConfig();
  if (runtimeApiKey) next.apiKey = runtimeApiKey;
  if (runtimeMedia.mediaCacheUrl) next.mediaCacheUrl = runtimeMedia.mediaCacheUrl;
  if (runtimeMedia.mediaCacheKey) next.mediaCacheKey = runtimeMedia.mediaCacheKey;
  if (!next.edgeUrl) delete next.apiKey;
  if (next.edgeUrl !== defaultEdgeUrl && parsed.apiKey == null && runtimeApiKey == null) delete next.apiKey;
  return next;
}

export function buildProxiedUrls(config: CorsProxyConfig, target: string): string[] {
  if (config.mode === 2) return [target];
  const prefixes = [config.prefix, ...(config.fallbacks ?? [])];
  const encode = config.urlEncoding ? encodeURIComponent : (x: string) => x;
  return prefixes.map(prefix => {
    if (prefix.endsWith('/') || prefix.endsWith('=')) {
      return prefix + encode(target);
    }
    return prefix + '/' + encode(target);
  });
}

// Kept for backwards-compat with settings UI code that still calls getUrl directly.
export function getUrl(config: CorsProxyConfig, v: string): string {
  return buildProxiedUrls(config, v)[0];
}

export function buildMediaCacheUrl(config: CorsProxyConfig | null | undefined, target: string | undefined): string {
  if (!target || !config?.mediaCacheUrl) return target ?? '';

  const url = new URL(`${config.mediaCacheUrl.replace(/\/$/, '')}/media`);
  url.searchParams.set('url', target);
  if (config.mediaCacheKey) url.searchParams.set('key', config.mediaCacheKey);
  return url.toString();
}

export function saveToLocal(config: CorsProxyConfig): void {
  localStorage.setItem(key, JSON.stringify(config));
}

export async function fetchWithFallbacks(
  proxiedUrls: string[],
  fetchFn: (url: string) => Promise<Response> = url => fetch(url),
): Promise<Response> {
  let lastError: unknown;
  for (const url of proxiedUrls) {
    try {
      const res = await fetchFn(url);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} from proxy`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('All CORS proxies failed');
}
