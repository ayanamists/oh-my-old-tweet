import UserList, { UserListProps } from "@/componets/UserList";
import MainLayout from "@/layouts/MainLayout";
import prisma from '@/util/db'
import { ssrConvert } from '@/util'
import { GetServerSideProps } from "next";

export default function allUser({ users }: UserListProps) {
  return (<MainLayout>
    <UserList users={users} />
  </MainLayout>)
}


export const getServerSideProps = (async (context) => {
  const userNameQuery = context.query.name;
  let userName = undefined;
  if (typeof userNameQuery === "string") {
    userName = userNameQuery;
  }
  const userList = await prisma.user.findMany({
    orderBy: {
      lastModified: "desc"
    },
    take: 500,
    include: {
      posts: {
        take: 1,
        include: {
          userName: true
        },
      }
    },
    ...(userName && {
      where: {
        posts: {
          some: {
            userName: { userName }
          }
        }
      }
    })
  });
  return {
    props: {
      users: userList.map(u => ssrConvert({
        ...u,
        ...u.posts[0].userName
      }))
    }
  }
}) satisfies GetServerSideProps<UserListProps>;
