import Queue from "bull";
import config from "../../config/config.js";
import { logger } from "@/logger";
import { CdxJob, DownloadMode, ImageDownloadJob, Source, StatusDownloadJob } from "./index";
import { parseCdxItem, parsePost } from "twitter-data-parser";
import { setGlobalDispatcher, Pool, Agent } from "undici";
import { storePost } from "./dbStore";
import { downloadImage } from "./imageStore";
import prisma from "@/util/db";
import path from "path";

setGlobalDispatcher(
  new Agent({ factory: (origin) => new Pool(origin, { connections: 32 }) })
);

const wait = (ms: any) => new Promise(resolve => setTimeout(resolve, ms));

const timeout = (ms: any, message: any) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
};

async function runTaskWithTimeout<T>(task: Promise<T>) {
  try {
    await Promise.race([
      timeout(3000, "init checking timeout"), // 3000 = the maximum time to wait
      (async () => {
        await task;
        await wait(2000);
      })()
    ]);
  } catch (error) {
    console.log(error);
  }
}

const redis = `redis://${config.redis.host}:${config.redis.port}`
export const cdxQueue = new Queue(config.queue.cdx, redis);
export const statusDownloadQueue = new Queue("statusDownload", redis);
export const imageDownloadQueue = new Queue("imageDownload", redis);

if (cdxQueue == null) {
  throw new Error("cdxQueue is null");
} else {
  const check = cdxQueue.getCompletedCount()
    .then(() => {
      logger.info(`redis connected`);
    });
  runTaskWithTimeout(check);
}

export function newCdxJob(Job: CdxJob) {
  cdxQueue.add(Job, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  });
}

export function newStatusDownloadJob(job: StatusDownloadJob) {
  statusDownloadQueue.add(job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}

function newImageDownloadJob(job: ImageDownloadJob) {
  imageDownloadQueue.add(job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}

function getCdxList(user: string) {
  const req = `twitter.com/${user}/`
  const url = `https://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`;
  logger.info(`Fetching cdx: ${url}`)
  return fetch(url)
    .then((res) => {
      if (!(res.status == 200)) {
        throw new Error(`
        req: ${url},
        response: ${res},
        status code: ${res.status} (${res.statusText})`);
      } else {
        return res
      }
    })
    .then(res => res.json())
    .then(j => j as string[][]);
}

cdxQueue.process((job) => {
  logger.info(`cdxQueue.process: ${job.id}, user @${job.data.userName}`);
  const data = job.data as CdxJob;
  return getCdxList(data.userName).then((cdxList) => {
    for (const item of cdxList.slice(1)) {
      newStatusDownloadJob({
        source: Source.Archive,
        userName: data.userName,
        info: parseCdxItem(item),
        downloadMode: data.downloadMode
      });
    }
    job.progress(100);
    job.log(`cdxList.length: ${cdxList.length}`);
  });
});

const concurrency = 10;

statusDownloadQueue.process(concurrency, async (job) => {
  const data = job.data as StatusDownloadJob;
  const item = data.info;
  const url = `https://web.archive.org/web/${item.timestamp}/${item.original}`
  const exists = await prisma.post.findUnique({
    where: {
      originalId: item.id
    }
  });
  if (exists != null && data.downloadMode === DownloadMode.Normal) {
    job.log(`skip ${url}`);
    return;
  }
  job.log(`try to download ${url}`);
  const parsedPost = await fetch(url)
    .then((res) => {
      job.log(`downloaded ${url}`);
      return res.text().then(async (text) => {
        const post = parsePost(text, { ...item, userName: data.userName });
        const imgIds: number[] = [];
        if (post == null) {
          job.log(`failed to parse ${url}`);
          return undefined;
        } else {
          // maybe duplicated images
          const visited = new Set<string>();
          for (const img of post.images) {
            const fileName = path.basename(img);
            if (fileName != null && visited.has(fileName)) {
              continue;
            } else {
              visited.add(fileName);
            }
            job.log(`img: ${img}`);
            const exists = await prisma.image.findUnique({
              where: {
                originUrl: img
              }
            });
            const imgInfo = exists ?? await prisma.image.create({
              data: {
                originUrl: img
              }
            });
            imgIds.push(imgInfo.id);
            newImageDownloadJob({
              url: img,
              parent: post.id,
              imageId: imgInfo.id
            });
          }
          job.log(`parsed ${url}`);
          return ({
            ...post,
            imageIds: imgIds
          });
        }
      });
    })
    .catch((err) => {
      const info = `error while processing ${url}: ${err}`;
      logger.error(info);
      job.log(info);
      if (!isFetchFailed(err)) {
        job.discard();
      }
      throw err;
    });
  job.progress(100);
  if (parsedPost != null) {
    return storePost(parsedPost, data);
  }
});

imageDownloadQueue.process(concurrency, async (job) => {
  const data = job.data as ImageDownloadJob;
  const info = `start downing ${data.url} ...`;
  job.log(info);
  return downloadImage(job).catch(err => {
    if (!isFetchFailed(err)) {
      job.discard();
    }
    job.log(`error while processing ${data.url}: ${err}`);
    throw err;
  })
});

function isFetchFailed(error: Error) {
  return error.message.match("fetch failed");
}
