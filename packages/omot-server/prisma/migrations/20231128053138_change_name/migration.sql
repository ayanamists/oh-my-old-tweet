/*
  Warnings:

  - You are about to drop the column `disableTime` on the `UserAvatar` table. All the data in the column will be lost.
  - You are about to drop the column `enableTime` on the `UserAvatar` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserAvatar` table. All the data in the column will be lost.
  - You are about to drop the column `disableTime` on the `UserName` table. All the data in the column will be lost.
  - You are about to drop the column `enableTime` on the `UserName` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserName` table. All the data in the column will be lost.
  - You are about to drop the column `disableTime` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `enableTime` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[postId]` on the table `UserAvatar` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId]` on the table `UserName` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `postId` to the `UserAvatar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postId` to the `UserName` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postId` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserAvatar" DROP CONSTRAINT "UserAvatar_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserName" DROP CONSTRAINT "UserName_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- AlterTable
ALTER TABLE "UserAvatar" DROP COLUMN "disableTime",
DROP COLUMN "enableTime",
DROP COLUMN "userId",
ADD COLUMN     "postId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserName" DROP COLUMN "disableTime",
DROP COLUMN "enableTime",
DROP COLUMN "userId",
ADD COLUMN     "postId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "disableTime",
DROP COLUMN "enableTime",
DROP COLUMN "userId",
ADD COLUMN     "postId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserAvatar_postId_key" ON "UserAvatar"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "UserName_postId_key" ON "UserName"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_postId_key" ON "UserProfile"("postId");

-- AddForeignKey
ALTER TABLE "UserName" ADD CONSTRAINT "UserName_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
