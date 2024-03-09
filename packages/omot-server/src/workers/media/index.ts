/* eslint-disable no-unused-vars */
import fileSystemStorage from "./fileSystemStorage"

export interface MediaStorage {
  save: (buf: Buffer, dir: string, name: string) => void,
  exists: (dir:string, name: string) => boolean,
  getRelativePath: (dir: string, name: string) => string
}

const defaultSystemStorage = fileSystemStorage;

export default defaultSystemStorage;