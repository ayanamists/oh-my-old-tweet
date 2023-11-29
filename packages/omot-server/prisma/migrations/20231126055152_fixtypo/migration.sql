/*
  Warnings:

  - You are about to drop the column `repliesToOrignalId` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "repliesToOrignalId",
ADD COLUMN     "repliesToOriginalId" INTEGER;
