-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_repliesToId_fkey";

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "repliesToId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_repliesToId_fkey" FOREIGN KEY ("repliesToId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
