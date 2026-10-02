-- Neutral default badge text for new shops (App Store 1.1.4: no unverified "Most popular" claim).
ALTER TABLE "Shop" ALTER COLUMN "defaultBadgeText" SET DEFAULT 'Recommended';
