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
  if (body.userIds == null) {
    res.status(400).send({ message: 'userIds is required' })
  } else {
    const userIds:number[] = (body.userIds as string[]).map((id) => Number.parseInt(id));
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No postIds provided' });
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      include: {
        userName: true,
      },
      distinct: "userId"
    });

    const userNames = posts.map(post => ({
      userId: post.userId,
      userName: post.userName.userName,
      fullName: post.userName.fullName
    }));
    res.status(200).json(userNames);
  }
}
