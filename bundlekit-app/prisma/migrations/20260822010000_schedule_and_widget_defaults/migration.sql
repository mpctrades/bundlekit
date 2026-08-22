-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "endsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "defaultWidgetTitle" TEXT NOT NULL DEFAULT 'Bundle & save',
ADD COLUMN     "defaultSavingsDisplay" TEXT NOT NULL DEFAULT 'both',
ADD COLUMN     "defaultCardStyle" TEXT NOT NULL DEFAULT 'outline';
