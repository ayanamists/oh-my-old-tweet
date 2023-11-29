-- DropIndex
DROP INDEX "Image_name_key";

-- AlterTable
ALTER TABLE "Image" ALTER COLUMN "name" DROP NOT NULL;
