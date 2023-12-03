import { logger } from "@/logger";
import { Image } from "@prisma/client";
import config from "../../config/config";

export function inDateRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function minDate(date1: Date, date2: Date) {
  return date1.getTime() <= date2.getTime() ? date1 : date2;
}

export function maxDate(date1: Date, date2: Date) {
  return date1.getTime() >= date2.getTime() ? date1 : date2;
}

export function ssrConvert(data: any) {
  return JSON.parse(JSON.stringify(data))
}

export function processImages(images: Image[]) {
  const imgs = [];
  for (const img of images) {
    if (img.s3id == null || img.width == null || img.height == null) {
      logger.warn(`Image is not valid: ${img.id}, may be not downloaded yet`)
    } else {
      imgs.push({
        url: getImageUrl(img),
        width: img.width,
        height: img.height
      })
    }
  }
  return imgs;
}

export function getImageUrl(image: Image) {
  return config.minio.getUrl(image.s3id);
}
