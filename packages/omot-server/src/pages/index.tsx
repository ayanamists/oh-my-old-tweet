import Omot from '@/componets/Omot'
import UserList, { UserListProps } from '@/componets/UserList'
import MainLayout from '@/layouts/MainLayout'
import Head from 'next/head'
import prisma from '@/util/db'
import { ssrConvert } from '@/util'
import { Button, Stack, Box } from '@mui/material'
import UserNameInput from '@/componets/UserNameInput'
import { useState } from 'react'
import SendIcon from '@mui/icons-material/Send';

export default function Home({ userList }: { userList: UserListProps["users"] }) {
  const [userName, setUserName] = useState<string>("");
  return (
    <>
      <Head>
        <title>Oh My Old Tweet (Server Mode)</title>
        <meta name="description" content="The server mode for Oh-My-Old-Tweet app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <MainLayout>
          <Stack direction='column' spacing='2em' alignItems='center'>
            <Omot />
            <UserNameInput userName='' setUser={setUserName} />
            <Box>
              <Button
                variant='contained'
                onClick={() => {
                  window.location.href = `/user/${userName}`
                }}
                endIcon={<SendIcon />}
              >Goto</Button>
            </Box>
            <UserList users={userList} />
          </Stack>
        </MainLayout>
      </main>
    </>
  )
}

export async function getServerSideProps() {
  const userList = await prisma.user.findMany({
    orderBy: {
      lastModified: "desc"
    },
    take: 6,
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
      userList: userList.map(u => ssrConvert({
        ...u,
        ...u.posts[0].userName
      }))
    }
  }
}
