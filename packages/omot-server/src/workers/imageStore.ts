import Queue from 'bull';
import { ImageDownloadJob } from '.';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import sizeOf from 'image-size';
import prisma from '@/util/db';
import MediaStorage from './media';

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

  // first check if the image is already downloaded
  const check = await prisma.image.findUnique({
    where: {
      id: imageId,
    },
  });
  if (check?.name != null && check?.dir != null 
    && MediaStorage.exists(check.dir, check.name)) {
    job.log(`Image ${imageId} already downloaded, skipping...`);
    job.progress(100);
    return;
  }

  const response = await fetch(url);
  const status = response.status;
  if (status === 404) {
    job.log(`Image ${url} not found, skipping...`);
    job.progress(100);
    return;
  }
  const buffer = await response.arrayBuffer();
  const responseHeaders = response.headers;
  const imageFileName = await getImageFileName(url, responseHeaders, buffer);
  const buf = Buffer.from(buffer);
  const dimensions = sizeOf(buf);

  MediaStorage.save(buf, parent, imageFileName);
  const successInfo = `Downloaded ${data.url}, name: ${imageFileName}`;
  job.log(successInfo);

  const update = {
    id: imageId,
    dir: parent,
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

  job.log(`Updated image ${imageId} with, result: ${result.dir}/${result.name}`);
  job.progress(100);
}