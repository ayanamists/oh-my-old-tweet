/*
  Warnings:

  - You are about to drop the column `userNameId` on the `Post` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[postId]` on the table `UserName` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `postId` to the `UserName` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_userNameId_fkey";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "userNameId";

-- AlterTable
ALTER TABLE "UserName" ADD COLUMN     "postId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserName_postId_key" ON "UserName"("postId");

-- AddForeignKey
ALTER TABLE "UserName" ADD CONSTRAINT "UserName_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
