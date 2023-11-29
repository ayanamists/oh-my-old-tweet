/*
  Warnings:

  - A unique constraint covering the columns `[originUrl]` on the table `Image` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Image` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "s3id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Image_originUrl_key" ON "Image"("originUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Image_name_key" ON "Image"("name");
