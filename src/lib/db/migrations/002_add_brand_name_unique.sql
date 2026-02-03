-- Migration: Add unique constraint on partners.brand_name
-- This prevents duplicate partners from being created during sync

-- Add unique constraint (will fail if duplicates exist - run check-duplicates.mjs first)
ALTER TABLE partners ADD CONSTRAINT partners_brand_name_unique UNIQUE (brand_name);

-- Note: If you need to remove this constraint later:
-- ALTER TABLE partners DROP CONSTRAINT partners_brand_name_unique;
