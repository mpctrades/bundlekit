-- Leftover offer metafields from a previous install are removed once per
-- install (first Dashboard visit), not on every Dashboard load.
ALTER TABLE "Shop" ADD COLUMN "orphansCleanedAt" TIMESTAMP(3);
