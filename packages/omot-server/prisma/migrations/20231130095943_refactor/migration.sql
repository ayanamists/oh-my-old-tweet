/*
  Warnings:

  - You are about to drop the column `postId` on the `UserAvatar` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userAvatarId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "UserAvatar" DROP CONSTRAINT "UserAvatar_postId_fkey";

-- DropIndex
DROP INDEX "UserAvatar_postId_key";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "userAvatarId" INTEGER;

-- AlterTable
ALTER TABLE "UserAvatar" DROP COLUMN "postId";

-- CreateIndex
CREATE UNIQUE INDEX "Post_userAvatarId_key" ON "Post"("userAvatarId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userAvatarId_fkey" FOREIGN KEY ("userAvatarId") REFERENCES "UserAvatar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
