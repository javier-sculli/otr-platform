-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_client_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
