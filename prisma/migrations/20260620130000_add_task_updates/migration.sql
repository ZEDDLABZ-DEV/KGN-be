-- AlterTable
ALTER TABLE "Tasks" ADD COLUMN "updates" TEXT[] DEFAULT ARRAY[]::TEXT[];
