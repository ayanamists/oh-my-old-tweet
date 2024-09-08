import { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/util/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== 'POST') {
    res.status(405).send({ message: 'Only POST requests allowed' })
    return
  }
  const body = JSON.parse(req.body);
  if (body.userNameId == null) {
    res.status(400).send({ message: 'userNameId is required' })
  } else {
    const userNameId = body.userNameId;
    const userData = await prisma.userName.findUnique({
      where: {
        id: userNameId
      }
    });
    res.status(200).json(userData);
  }
}
