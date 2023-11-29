import { Client } from 'minio';
import config from '../config/config.js';

const minioClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL, // true if you're using HTTPS
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const bucketName = config.minio.buckets.myBucket;

minioClient.bucketExists(bucketName, function(err, exists) {
  if (err) {
    console.error('Error checking bucket existence:', err);
    return;
  }

  if (exists) {
    console.log(`Bucket "${bucketName}" already exists.`);
  } else {
    minioClient.makeBucket(bucketName, 'us-east-1', function(err) {
      if (err) {
        console.error('Error creating bucket:', err);
        return;
      }
      console.log(`Bucket "${bucketName}" created successfully.`);
    });
  }
});
