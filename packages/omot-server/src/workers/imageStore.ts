import Queue from 'bull';
import { ImageDownloadJob } from '.';
import { Client, ClientOptions } from 'minio';
import config from '../../config/config';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import sizeOf from 'image-size';
import prisma from '@/util/db';

const minioClient = new Client(config.minio as unknown as ClientOptions);

// Function to get the image file name
async function getImageFileName(url: string, responseHeaders: Headers, buffer: ArrayBuffer) {
  // If the URL ends with a valid image extension (robust check)
  const urlFileName = path.basename(url);
  const extensionRegex = /\.(jpg|jpeg|png|gif|bmp|webp|ico|tiff|tif|svg|apng|avif|jfif|pjpeg|x-png|x-icon|x-jpeg|x-png|x-tiff|x-tif)$/i;
  if (extensionRegex.test(urlFileName)) {
    return urlFileName;
  }

  // If the response contains a file name
  const contentDisposition = responseHeaders.get('content-disposition');
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      return match[1];
    }
  }

  // If unable to obtain a valid file name, generate a random UUID as the file name
  const info = await fileTypeFromBuffer(buffer);
  return `${uuidv4()}.${info?.ext ?? 'bin'}`;
}

export async function downloadImage(job: Queue.Job<ImageDownloadJob>) {
  const data = job.data;
  const url = data.url;
  const parent = data.parent;
  const imageId = data.imageId;

  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const responseHeaders = response.headers;
  const imageFileName = await getImageFileName(url, responseHeaders, buffer);
  const fileName = `${parent}/${imageFileName}`;
  const bucket = config.minio.buckets.myBucket;
  const buf = Buffer.from(buffer);
  const dimensions = sizeOf(buf);
  await minioClient.putObject(bucket, fileName, buf);

  const successInfo = `Downloaded ${data.url} and uploaded as ${imageFileName} to MinIO`;
  job.log(successInfo);

  const s3id = JSON.stringify({
    bucket: bucket,
    object: fileName,
  });
  const update = {
    id: imageId,
    s3id: s3id,
    name: imageFileName,
    width: dimensions.width,
    height: dimensions.height,
  };
  const result = await prisma.image.update({
    where: {
      id: imageId,
    },
    data: update,
  });

  job.log(`Updated image ${imageId} with ${s3id}, result: ${result}`);
  job.progress(100);
}