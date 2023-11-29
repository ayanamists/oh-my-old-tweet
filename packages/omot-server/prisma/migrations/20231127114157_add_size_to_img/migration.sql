/*
  Warnings:

  - A unique constraint covering the columns `[originUrl]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "name" TEXT,
ALTER COLUMN "s3id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Video_originUrl_key" ON "Video"("originUrl");
