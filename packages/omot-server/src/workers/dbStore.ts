import { logger } from "@/logger";
import { DownloadMode, ProcessedPost, StatusDownloadJob } from ".";
import prisma from "@/util/db";

export async function storePost(post: ProcessedPost, job: StatusDownloadJob) {
  const exists = await prisma.post.findUnique({
    where: {
      originalId: post.id
    }
  });
  if (exists != null) {
    if (job.downloadMode == DownloadMode.Normal) {
      // skip, but the callee should not let it happen
      return;
    }
  }

  const user = post.user;
  if (user == null || user.id == null || user.userName == null) {
    logger.warn(`invalid post: ${post.id}, user info incomplete: ${user}`)
    return;
  }
  const id = user.id;
  const dbUser = await prisma.user.upsert({
    create: {
      originalId: id
    },
    update: {
      lastModified: new Date()
    },
    where: {
      originalId: id
    }
  });

  const nameProp = {
    userName: user.userName,
    fullName: user.fullName ?? ""
  };
  const imageProps = post.imageIds.map((id) => {
    return {
      id: id
    }
  });

  const props = {
    originalId: post.id,
    content: post.text ?? "",
    date: post.date,
    user: {
      connect: {
        id: dbUser.id
      }
    },
    tweetUrl: post.tweetUrl,
    archiveUrl: post.archiveUrl,
    source: job.source,
    ...post.replyInfo?.targetPostId && {
      repliesToOriginalId: post.replyInfo.targetPostId
    },
    images: {
      set: imageProps
    },
    userName: {
      create: nameProp
    },
    ...(post.avatarId && {
      userAvatar: {
        create: {
          img: {
            connect: {
              id: post.avatarId
            }
          }
        }
      }
    }),
    ...(post.replyInfo && {
      repliesToOriginalId: post.replyInfo?.targetPostId,
      repliesToUserName: post.replyInfo?.targetUser.userName,
    }),
    lastModified: new Date()
  };
  await (prisma.post.upsert({
    create: {
      ...props,
      images: {
        connect: imageProps
      }
    },
    update: props,
    where: {
      originalId: post.id
    }
  })
    .catch((e) => {
      logger.error(`failed to store post ${post.id}: ${e}`)
    }))
}
