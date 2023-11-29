/*
  Warnings:

  - You are about to drop the column `repliesToId` on the `Post` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_repliesToId_fkey";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "repliesToId",
ADD COLUMN     "repliesToOrignalId" INTEGER;
