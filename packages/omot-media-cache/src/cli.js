#!/usr/bin/env node
import fsp from 'node:fs/promises';
import { loadConfig } from './config.js';
import { listen } from './server.js';
import { prefetchUrls, pullMediaUrlsFromEdge } from './prefetch.js';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readUrlsFromInput() {
  const input = readArg('--input');
  if (input) {
    return (await fsp.readFile(input, 'utf8')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  const url = readArg('--url');
  if (url) return [url];

  if (process.stdin.isTTY) return [];
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function commandServe() {
  const config = loadConfig();
  const server = await listen(config);
  const address = server.address();
  console.log(`omot-media-cache listening on ${typeof address === 'string' ? address : `${config.host}:${config.port}`}`);
  console.log(`cache dir: ${config.rootDir}`);
}

async function commandPrefetch() {
  const config = loadConfig();
  const concurrency = Number(readArg('--concurrency', '4'));
  const urls = await readUrlsFromInput();
  const stats = await prefetchUrls(urls, config, { concurrency });
  console.log(JSON.stringify(stats, null, 2));
  if (stats.failed > 0 && hasFlag('--strict')) process.exitCode = 1;
}

async function commandPullEdge() {
  const config = loadConfig();
  const edgeUrl = readArg('--edge-url', process.env.OMOT_EDGE_URL ?? 'https://omot-edge.ayanamists.workers.dev');
  const apiKey = readArg('--api-key', process.env.OMOT_API_KEY ?? config.key);
  const pages = Number(readArg('--pages', '1'));
  const limit = Number(readArg('--limit', '100'));
  const concurrency = Number(readArg('--concurrency', '4'));
  const avatarsArg = readArg('--avatars');
  const avatars = avatarsArg == null ? undefined : !['0', 'false', 'no'].includes(avatarsArg.toLowerCase());
  let cursor = readArg('--cursor', '');
  const allUrls = [];

  for (let page = 0; page < pages; page += 1) {
    const result = await pullMediaUrlsFromEdge({ edgeUrl, apiKey, cursor, limit, avatars });
    allUrls.push(...result.urls.map((entry) => entry.url));
    console.log(JSON.stringify({
      page: page + 1,
      scanned: result.scanned,
      posts: result.posts,
      urls: result.urls.length,
      done: result.done,
    }));
    if (result.done || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  const stats = await prefetchUrls(allUrls, config, { concurrency });
  console.log(JSON.stringify(stats, null, 2));
  if (stats.failed > 0 && hasFlag('--strict')) process.exitCode = 1;
}

const command = process.argv[2] ?? 'serve';
if (command === 'serve') await commandServe();
else if (command === 'prefetch') await commandPrefetch();
else if (command === 'pull-edge') await commandPullEdge();
else {
  console.error('Usage: omot-media-cache <serve|prefetch|pull-edge>');
  process.exit(2);
}
