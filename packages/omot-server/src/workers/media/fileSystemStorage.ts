import { MediaStorage } from ".";
import config from '@/config';
import { logger } from "@/logger";
import fs from 'fs';

function saveToFileSystem(buf: Buffer, dir: string, name: string) {
  // first check if the directory exists
  const absDir = config.media.path + `/${dir}`;
  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }
  fs.writeFile(getDataStoragePath(dir, name), buf, (err) => {
    if (err) {
      logger.error(err);
    }
  });
}

function existsInFileSystem(dir: string, name: string): boolean {
  return fs.existsSync(getDataStoragePath(dir, name));
}

function getRelativePath(dir: string, name: string): string {
  return `/media/${dir}/${name}`;
}

function getDataStoragePath(dir: string, name: string): string {
  return config.media.path + `/${dir}/${name}`;
}

const fileSystemStorage: MediaStorage = {
  save: saveToFileSystem,
  exists: existsInFileSystem,
  getRelativePath: getRelativePath
}

export default fileSystemStorage