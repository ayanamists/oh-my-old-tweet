/*
  Warnings:

  - You are about to drop the column `postId` on the `UserName` table. All the data in the column will be lost.
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

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userNameId_fkey" FOREIGN KEY ("userNameId") REFERENCES "UserName"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
