import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/util/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string[]>
) {
  const userList = await prisma.userName.findMany();
  const uniqueUserNameList = new Set<string>();
  userList.map(user => user.userName)
    .forEach((name) => {
      uniqueUserNameList.add(name);
    });
  const ret = Array.from(uniqueUserNameList);
  res.status(200).json(ret);
}
