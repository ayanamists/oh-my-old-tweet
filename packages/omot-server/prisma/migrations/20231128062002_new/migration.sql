/*
  Warnings:

  - You are about to drop the column `postId` on the `UserName` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userNameId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userNameId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserName" DROP CONSTRAINT "UserName_postId_fkey";

-- DropIndex
DROP INDEX "UserName_postId_key";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "userNameId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserName" DROP COLUMN "postId";

-- CreateIndex
CREATE UNIQUE INDEX "Post_userNameId_key" ON "Post"("userNameId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userNameId_fkey" FOREIGN KEY ("userNameId") REFERENCES "UserName"("id") ON DELETE CASCADE ON UPDATE CASCADE;
