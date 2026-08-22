-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "resolvedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
