-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "combineOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "combineProduct" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "combineOrderDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "combineProductDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultAccent" TEXT NOT NULL DEFAULT '#FF4A1C',
ADD COLUMN     "defaultBadgeText" TEXT NOT NULL DEFAULT 'Most popular',
ADD COLUMN     "defaultRadius" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "defaultShowTrustLine" BOOLEAN NOT NULL DEFAULT true;
