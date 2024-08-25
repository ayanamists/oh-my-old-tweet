import Timeline, { DisplayTweet } from "@/componets/TimeLine";
import MainLayout from "@/layouts/MainLayout";
import { getImageUrl, processImages, ssrConvert } from "@/util";
import prisma from "@/util/db";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";

type Props = {
  tweets: DisplayTweet[]
  showReply: boolean
}

export default function User({
  tweets,
  start,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
  <MainLayout>
    <Timeline tweets={tweets} start={start ?? 0} />
  </MainLayout>);
}

/* function processShowReply(showReply: string | string[] | undefined) {
*   if (showReply == null) {
*     return false;
*   } else if (typeof showReply === "string") {
*     return showReply === "true";
*   } else {
*     return showReply[0] === "true";
*   }
* } */

function processOriginalId(originalId: string | string[] | undefined) {
  if (typeof originalId === "string") {
    return originalId;
  } else {
    return undefined;
  }
}

function processUserId(userId: string | string[] | undefined) {
  if (typeof userId === "string") {
    return Number.parseInt(userId);
  } else {
    return undefined;
  }
}

function processTweetId(start: string | string[] | undefined) {
  if (typeof start === "string") {
    return start
  } else {
    return undefined;
  }
}

export const getServerSideProps = (async (context) => {
  const userName = context.params?.name;
  const _userId = processUserId(context.query.userId);
  const originalId = processOriginalId(context.query.originalId);
    const tweetId = processTweetId(context.query.tweetId);
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
          },
        }
      },
      ...(originalId && { originalId }),
      ...(_userId && { id: _userId })
    },
  });
  if (users.length === 0) {
    const fallback = `/user/loading?userName=${userName}&falseRedirect=${true}`;
    return {
      redirect: {
        destination: fallback,
        permanent: false
      }
    };
  } else if (users.length > 1) {
    return {
      redirect: {
        destination: `/user?userName=${userName}`,
        permanent: false
      }
    };
  }
  const user = users[0];
  const userId = user.id;
  const posts = await prisma.post.findMany({
    where: {
      userId: userId,
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
        ...(t.userAvatar?.img?.dir && { avatarUrl: getImageUrl(t.userAvatar.img) })
      }
    }
  });
  const start = (tweetId != null) ? tweets.findIndex((t) => t.tweet.originalId === tweetId) : null;
  console.log(`start : ${start}`);
  return {
    props: {
      tweets: ssrConvert(tweets),
      start,
    }
  };
}) satisfies GetServerSideProps<{
  tweets: Props
}>
