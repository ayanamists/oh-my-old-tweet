import Timeline, { DisplayTweet } from "@/componets/TimeLine";
import MainLayout from "@/layouts/MainLayout";
import { logger } from "@/logger";
import { getImageUrl, processImages, ssrConvert } from "@/util";
import prisma from "@/util/db";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";

type Props = {
  tweets: DisplayTweet[]
}

export default function User({
  tweets,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
  <MainLayout>
    <Timeline tweets={tweets} />
  </MainLayout>);
}

export const getServerSideProps = (async (context) => {
  const userName = context.params?.name;
  const showReply = context.query?.showReply ?? false;
  if (userName == null) {
    throw new Error("userName is null");
  } else if (typeof userName !== "string") {
    throw new Error(`userName is not string: ${userName}`);
  }
  const users = await prisma.user.findMany({
    where: {
      posts: {
        some: {
          userName: {
            userName: userName
          }
        }
      }
    },
  });
  if (users.length === 0) {
    const fallback = `/user/loading?userName=${userName}&falseRedirect=${true}`;
    return {
      redirect: {
        destination: fallback,
        permanent: false
      }
    }
  } else if (users.length > 1) {
    logger.warn(`Many user found: ${users.map(u => u.id)}`)
  }
  const user = users[0];
  const userId = user.id;
  const posts = await prisma.post.findMany({
    where: {
      userId: userId,
      ...(!showReply && {
        repliesToOriginalId: null
      })
    },
    include: {
      images: true,
      userName: true,
      userAvatar: {
        include: {
          img: true
        }
      } 
    },
    orderBy: {
      date: "asc"
    }
  });
  const tweets: DisplayTweet[] = posts.map(t => {
    return {
      tweet: {
        ...t,
        images: processImages(t.images)
      },
      user: {
        ...user,
        ...(t.userName ?? {
          id: -1,
          userName: "",
          fullName: "",
          postId: -1
        }),
        ...(t.userAvatar?.img?.s3id && { avatarUrl: getImageUrl(t.userAvatar.img) })
      }
    }
  });
  return {
    props: {
      tweets: ssrConvert(tweets)
    }
  };
}) satisfies GetServerSideProps<{
  tweets: Props
}>
