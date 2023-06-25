export default function getUrl(orig: string) {
  let prefix = "https://api.codetabs.com/v1/proxy/?quest=";

  return prefix + encodeURIComponent(orig);
}