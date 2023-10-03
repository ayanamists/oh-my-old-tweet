export type CorsProxyConfig = {
  mode: number,
  prefix: string,
  urlEncoding: boolean
}

export const defaultPrefix = "https://cors-proxy.ayanamists.workers.dev/?target=";

const key = "omot-cors-config"

export const defaultConfig = {
  mode: 1,
  prefix: defaultPrefix,
  urlEncoding: true
};

export function getDefaultConfig(): CorsProxyConfig {
  let loaded = localStorage.getItem(key);
  if (loaded == null) {
    return defaultConfig;
  } else {
    return JSON.parse(loaded);
  }
}

export function getUrl(config: CorsProxyConfig, v: string) {
  if (config.mode === 2) {
    return v;
  } else {
    let prefix = config.prefix;
    let process = config.urlEncoding ? encodeURIComponent : (x:string) => x;
    if (prefix.endsWith('/') || prefix.endsWith("=")) {
      return prefix + process(v);
    } else {
      return prefix + "/" + process(v);
    }
  }
}

export function saveToLocal(config: CorsProxyConfig) {
  localStorage.setItem(key, JSON.stringify(config));
}
