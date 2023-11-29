import 'dotenv/config';

// TODO: add checks for required env vars
// NOTE: all configs should not be used in any components directly
//       next.js will not bundle them, so they will not be available
const pub = process.env.MINIO_PUBLIC_HOST;
if (pub == null) {
  throw new Error('MINIO_PUBLIC_HOST is not set');
}

const config = {
  minio: {
    endPoint: process.env.MINIO_HOST || 'localhost',
    port: Number.parseInt(process.env.MINIO_PORT) || 8999,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    buckets: {
      myBucket: 'omot',
    },
    getUrl: (s3id) => {
      const j = JSON.parse(s3id)
      const bucket = j.bucket
      const object = j.object
      return `http://${pub}:${config.minio.port}/${bucket}/${object}`
    }
  },
  queue: {
    cdx: 'cdx'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT) || 6379,
  }
}

export default config;
