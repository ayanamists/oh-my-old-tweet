import Queue from "bull";
import { logger } from "@/logger";
import config from "@/config";
import { CdxJob, DownloadMode, ImageDownloadJob, Source, StatusDownloadJob } from "./index";
import { parseCdxItem, parsePost } from "twitter-data-parser";
import { setGlobalDispatcher, Pool, Agent } from "undici";
import { storePost } from "./dbStore";
import { downloadImage } from "./imageStore";
import prisma from "@/util/db";
import path from "path";

setGlobalDispatcher(
  new Agent({
    factory: (origin) => new Pool(origin, {
      connections: 32,
      connect: {
        timeout: 30_000
      }
    })
  })
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
export const galleryDlLoadingQueue = new Queue("galleryDlLoading", redis);

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
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}

function newImageDownloadJob(job: ImageDownloadJob) {
  imageDownloadQueue.add(job, {
    attempts: 5,
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

let isQueuePaused = false;
statusDownloadQueue.process(concurrency, async (job) => {
  const data = job.data as StatusDownloadJob;
  const item = data.info;
  const url = `http://web.archive.org/web/${item.timestamp}/${item.original}`
  const exists = await prisma.post.findUnique({
    where: {
      originalId: item.id
    },
    include: {
      images: true
    }
  });
  if (exists != null && data.downloadMode === DownloadMode.Normal) {
    job.log(`skip downloading ${url}`);
    job.log(`checking for images`);
    for (const img of exists.images) {
      if (img.dir == null || img.name == null) {
        job.log(`image ${img} not found, re-download`);
        newImageDownloadJob({
          url: img.originUrl,
          parent: exists.originalId,
          imageId: img.id
        });
      }
    }
    return;
  }
  job.log(`try to download ${url}`);
  const queryUserName = data.userName;
  const parsedPost = await fetch(url)
    .then(async (res) => {
      if (res.status !== 200) {
        const delayed = await statusDownloadQueue.getDelayedCount();
        // TODO: it seems that here's a concurrent race
        if ((res.status === 429 || delayed > 100) && !isQueuePaused) {
          isQueuePaused = true;
          statusDownloadQueue.pause();
          logger.warn(`bad health, pause statusDownloadQueue for 5s`);
          setTimeout(() => {
            statusDownloadQueue.resume();
            logger.info(`resume statusDownloadQueue`);
            isQueuePaused = false;
          }, 5000);
        }
        throw new Error(`fetch failed: ${res.status} (${res.statusText})`);
      }
      job.log(`downloaded ${url}`);
      return res.text().then(async (text) => {
        const post = parsePost(text, { ...item, userName: data.userName });
        const imgIds: number[] = [];
        if (post == null) {
          job.log(`failed to parse ${url}`);
          return undefined;
        } else {
          const parentDir = queryUserName;
          let avatarId: undefined | number = undefined;
          if (post.user.avatar != null) {
            avatarId = await prisma.image.upsert({
              create: {
                originUrl: post.user.avatar
              },
              update: {},
              where: {
                originUrl: post.user.avatar
              }
            }).then((img) => img.id);
            if (avatarId != null) {
              newImageDownloadJob({
                url: post.user.avatar,
                parent: parentDir,
                imageId: avatarId
              });
            }
          }
          // maybe duplicated images
          const visited = new Set<string>();
          const allImages = post.images.concat(post.videoInfo?.thumbUrl ?? []);
          for (const img of allImages) {
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
              parent: parentDir,
              imageId: imgInfo.id
            });
          }
          job.log(`parsed ${url}`);
          return ({
            ...post,
            imageIds: imgIds,
            avatarId: avatarId
          });
        }
      });
    })
    .catch((err) => {
      const info = `error while processing ${url}: ${err}`;
      job.log(info);
      if (err.cause) {
        job.log(err.cause.message + "\n" + err.cause.stack);
      }
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
    if (!isFetchFailed(err) && !err.message.match("unsupported file type")) {
      job.discard();
    }
    job.log(`error while processing ${data.url}: ${err}}`);
    throw err;
  })
});

// galleryDlLoadingQueue.process(async (job) => {
//   const data = job.data as GalleryDLLoadingJob;
//   const dirPath = data.path;
//   const info = `start loading ${data.path} ...`;
//   job.log(info);
//   const stat = await fs.stat(dirPath);
//   if (!stat.isDirectory()) {
//     job.log(`error: ${data.path} is not a directory`);
//     return;
//   }
//   // list all files in the directory
//   const files = await fs.readdir(dirPath);
//   for (const file of files) {
//     const filePath = path.join(dirPath, file);
//     const stat = await fs.stat(filePath);
//     if (stat.isDirectory()) {
//       job.log(`skip directory ${filePath}`);
//       continue;
//     } else if (filePath.endsWith(".json")) {
//       const content = await fs.readFile(filePath, "utf-8");
//       const post = JSON.parse(content);
//         await storePost(parsedPost, {
//           source: Source.Archive,
//           userName: post.userName,
//           info: {
//             id: post.id,
//             original: post.tweetUrl,
//             timestamp: post.date
//           },
//           downloadMode: DownloadMode.Normal
//         });
//       }
//     }
//   }
// });

function isFetchFailed(error: Error) {
  return error.message.match("fetch failed");
}
