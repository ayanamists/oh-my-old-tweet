export default function getUrl(orig: string) {
  let prefix = "https://cors-proxy.ayanamists.workers.dev/?target=";

  return prefix + encodeURIComponent(orig);
}