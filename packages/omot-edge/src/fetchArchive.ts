export async function fetchArchiveHtml(archiveUrl: string): Promise<string> {
  const res = await fetch(archiveUrl, {
    headers: {
      // Identify ourselves; archive.org prefers a real UA over a blank one.
      'User-Agent': 'omot-edge/1.0 (+https://github.com/ayanamists/oh-my-old-tweet)',
    },
  });
  if (!res.ok) {
    throw new Error(`archive.org returned ${res.status} for ${archiveUrl}`);
  }
  return res.text();
}
