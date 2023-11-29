-- DropForeignKey
ALTER TABLE "UserName" DROP CONSTRAINT "UserName_postId_fkey";

-- AddForeignKey
ALTER TABLE "UserName" ADD CONSTRAINT "UserName_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
