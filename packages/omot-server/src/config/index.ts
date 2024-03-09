import dotenv from 'dotenv';

// TODO: add checks for required env vars
// NOTE: all configs should not be used in any components directly
//       next.js will not bundle them, so they will not be available
dotenv.config();
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const mediaDir = process.env.MEDIA_STORAGE || './media';
if (redisHost == null || redisPort == null) {
  throw new Error('MINIO_PUBLIC_HOST is not set');
}

const config = {
  host: process.env.HOST || 'localhost',
  queue: {
    cdx: 'cdx'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(redisPort) || 6379,
  },
  search: {
    master_key: "MASTER_KEY",
  },
  media: {
    path: mediaDir
  }
}

export default config;
