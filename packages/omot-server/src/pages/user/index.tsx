import UserList, { UserListProps } from "@/componets/UserList";
import MainLayout from "@/layouts/MainLayout";
import prisma from '@/util/db'
import { ssrConvert } from '@/util'

export default function allUser({ users } : UserListProps) {
  return (<MainLayout>
    <UserList users={users}/>
  </MainLayout>)
}


export async function getServerSideProps() {
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
    }
  });
  return {
    props: {
      users: userList.map(u => ssrConvert({
        ...u,
        ...u.posts[0].userName
      }))
    }
  }
}
