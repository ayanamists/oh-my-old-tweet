import { DownloadMode, Source } from "@/workers"
import { newStatusDownloadJob } from "@/workers/queues"
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
    newStatusDownloadJob({
      userName: body.user,
      downloadMode: DownloadMode.Overwrite,
      source: Source.Archive,
      info: {
        original: "https://twitter.com/" + body.user + "/status/" + body.id,
        timestamp: body.timestamp,
        id: body.id,
        mimetype: "text/html",
        statusCode: 200,
        digest: "",
        length: -1,
        urlKey: "",
        date: new Date()
      }
    });
    res.status(200).json({});
  }
}
