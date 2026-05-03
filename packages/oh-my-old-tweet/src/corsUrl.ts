export type CorsProxyConfig = {
  mode: number;
  prefix: string;
  urlEncoding: boolean;
  fallbacks?: string[];
  /** omot-edge Worker base URL, e.g. https://omot-edge.your-subdomain.workers.dev */
  edgeUrl?: string;
  /** Bearer token for omot-edge — leave blank if OMOT_API_KEY is not set on the Worker */
  apiKey?: string;
};

const defaultPrefix = "https://cors-proxy.ayanamists.workers.dev/?target=";

const key = "omot-cors-config";

export const defaultConfig: CorsProxyConfig = {
  mode: 1,
  prefix: defaultPrefix,
  urlEncoding: true,
  fallbacks: [],
  edgeUrl: 'https://omot-edge.ayanamists.workers.dev',
};

export function getDefaultConfig(): CorsProxyConfig {
  const loaded = localStorage.getItem(key);
  if (loaded == null) return defaultConfig;
  const parsed = JSON.parse(loaded) as CorsProxyConfig;
  if (!Array.isArray(parsed.fallbacks)) parsed.fallbacks = [];
  return parsed;
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
