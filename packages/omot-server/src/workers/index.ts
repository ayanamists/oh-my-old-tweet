/* eslint-disable no-unused-vars */
import { CdxItem, Post } from "twitter-data-parser"

export type CdxJob = {
  userName: string
  downloadMode: DownloadMode
}

export enum Source {
  Twitter = "twitter",
  Archive = "archive"
}

export enum DownloadMode {
  Overwrite = "overwrite",
  Normal    = "normal"
}

export type StatusDownloadJob = {
  source: Source,
  info: CdxItem,
  downloadMode: DownloadMode,
  userName: string
}

export type ImageDownloadJob = {
  url: string,
  parent: string,
  imageId: number 
}

export type ProcessedPost = Post & {
  imageIds: number[],
  avatarId?: number
}
