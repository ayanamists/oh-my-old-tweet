import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import express from "express";
import { cdxQueue, imageDownloadQueue, statusDownloadQueue } from '@/workers/queues';

const serverAdapter = new ExpressAdapter();
const handler = express();

createBullBoard({
  queues: [
    new BullAdapter(cdxQueue),
    new BullAdapter(statusDownloadQueue),
    new BullAdapter(imageDownloadQueue),
  ],
  serverAdapter: serverAdapter,
});

const basePath = '/api/bull/';
serverAdapter.setBasePath(basePath);

const router = serverAdapter.getRouter();

handler.use(
  basePath,
  router,
);

export const config = {
  api: {
    externalResolver: true,
  },
}

export default handler;
