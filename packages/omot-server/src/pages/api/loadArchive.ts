import { DownloadMode } from "@/workers"
import { newCdxJob } from "@/workers/queues"
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== 'POST') {
    res.status(405).send({ message: 'Only POST requests allowed' })
    return
  }
  const body = req.body
  if (body.user == null) {
    res.status(400).send({ message: 'userName is required' })
  } else {
    newCdxJob({
      userName: body.user,
      downloadMode: body.downloadMode ?? DownloadMode.Normal
    });
    res.status(200).json({});
  }
}
