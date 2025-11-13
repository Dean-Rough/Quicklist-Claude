-- ============================================================================
-- QuickList AI: Cloudinary Migration
-- ============================================================================
-- Purpose: Migrate from base64 image storage to cloud-hosted URLs (Cloudinary)
-- Date: 2025-11-13
-- Author: QuickList Development Team
--
-- MIGRATION OVERVIEW:
-- This migration adds support for cloud-hosted image URLs while maintaining
-- backward compatibility during the transition period. The migration is
-- designed to be executed in phases to ensure zero-downtime deployment.
--
-- MIGRATION PHASES:
--   Phase 1: Add new columns (this file)
--   Phase 2: Migrate existing base64 data to Cloudinary (application code)
--   Phase 3: Verify all images migrated successfully
--   Phase 4: Make image_url NOT NULL and drop image_data column
--
-- ESTIMATED MIGRATION TIME:
--   - Schema changes: < 1 second (columns are nullable)
--   - Data migration: ~1-2 seconds per image (Cloudinary upload)
--   - For 100 images: ~2-3 minutes
--   - For 1000 images: ~20-30 minutes
--   - For 10000 images: ~3-5 hours
--
-- ROLLBACK STRATEGY:
--   - Keep image_data column during migration for rollback safety
--   - If issues occur, revert application code and keep using image_data
--   - Only drop image_data after verification period (recommended: 30 days)
-- ============================================================================

-- ============================================================================
-- PHASE 1: ADD NEW COLUMNS FOR CLOUDINARY SUPPORT
-- ============================================================================

BEGIN;

-- Add new columns to images table
-- All columns are nullable initially to allow gradual migration

-- image_url: Full-size image URL from Cloudinary
-- This will become the primary image reference after migration
ALTER TABLE images
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- thumbnail_url: Optimized thumbnail URL from Cloudinary
-- Used for listing previews and faster page loads
-- Cloudinary can generate these automatically with transformations
ALTER TABLE images
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- cloudinary_public_id: Unique identifier for the image on Cloudinary
-- Required for:
--   - Deleting images from Cloudinary when listing is deleted
--   - Generating transformed versions (thumbnails, watermarks, etc.)
--   - Managing image lifecycle
-- Format: "quicklist/{user_id}/{listing_id}/{image_id}"
ALTER TABLE images
ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Add metadata columns for migration tracking
ALTER TABLE images
ADD COLUMN IF NOT EXISTS migrated_to_cloudinary BOOLEAN DEFAULT false;

ALTER TABLE images
ADD COLUMN IF NOT EXISTS migration_attempted_at TIMESTAMP;

ALTER TABLE images
ADD COLUMN IF NOT EXISTS migration_error TEXT;

-- Create indexes for performance
-- Index on cloudinary_public_id for quick lookups and deletions
CREATE INDEX IF NOT EXISTS idx_images_cloudinary_public_id
ON images(cloudinary_public_id);

-- Index on migrated_to_cloudinary for tracking migration progress
CREATE INDEX IF NOT EXISTS idx_images_migrated_to_cloudinary
ON images(migrated_to_cloudinary);

-- Composite index for finding images by listing that need migration
CREATE INDEX IF NOT EXISTS idx_images_listing_migration_status
ON images(listing_id, migrated_to_cloudinary);

-- Add comments for documentation
COMMENT ON COLUMN images.image_url IS
'Full-size image URL from Cloudinary. Will replace image_data after migration.';

COMMENT ON COLUMN images.thumbnail_url IS
'Thumbnail URL from Cloudinary (optimized for previews). Generated via Cloudinary transformations.';

COMMENT ON COLUMN images.cloudinary_public_id IS
'Unique identifier for Cloudinary image management and deletion. Format: quicklist/{user_id}/{listing_id}/{image_id}';

COMMENT ON COLUMN images.migrated_to_cloudinary IS
'Flag indicating whether this image has been successfully migrated to Cloudinary.';

COMMENT ON COLUMN images.migration_attempted_at IS
'Timestamp of last migration attempt. Used for retry logic and monitoring.';

COMMENT ON COLUMN images.migration_error IS
'Error message if migration failed. Helps diagnose migration issues.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration progress
-- Run this query to monitor how many images have been migrated
-- SELECT
--     COUNT(*) as total_images,
--     COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated_images,
--     COUNT(CASE WHEN migrated_to_cloudinary = false THEN 1 END) as pending_images,
--     COUNT(CASE WHEN migration_error IS NOT NULL THEN 1 END) as failed_images,
--     ROUND(COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as percent_complete
-- FROM images;

-- Find images that need migration
-- SELECT id, listing_id, migrated_to_cloudinary, migration_error
-- FROM images
-- WHERE migrated_to_cloudinary = false
-- ORDER BY created_at ASC
-- LIMIT 100;

-- Find images with migration errors
-- SELECT id, listing_id, migration_error, migration_attempted_at
-- FROM images
-- WHERE migration_error IS NOT NULL
-- ORDER BY migration_attempted_at DESC;

-- Verify a specific image has both old and new data during transition
-- SELECT
--     id,
--     listing_id,
--     LENGTH(image_data) as base64_size,
--     image_url,
--     thumbnail_url,
--     cloudinary_public_id,
--     migrated_to_cloudinary
-- FROM images
-- WHERE id = {image_id};

-- ============================================================================
-- PHASE 2: DATA MIGRATION (APPLICATION CODE)
-- ============================================================================

-- This phase is executed by application code, not SQL.
-- The migration script should:
--
-- 1. Query images where migrated_to_cloudinary = false
-- 2. For each image:
--    a. Decode base64 image_data
--    b. Upload to Cloudinary with public_id format: "quicklist/{user_id}/{listing_id}/{image_id}"
--    c. Generate thumbnail URL using Cloudinary transformations
--    d. Update record:
--       UPDATE images SET
--         image_url = {cloudinary_url},
--         thumbnail_url = {thumbnail_url},
--         cloudinary_public_id = {public_id},
--         migrated_to_cloudinary = true,
--         migration_attempted_at = NOW()
--       WHERE id = {image_id};
--    e. On error, log to migration_error column
-- 3. Process in batches (recommended: 10-50 images at a time)
-- 4. Implement retry logic for failed uploads
-- 5. Monitor progress with verification queries above

-- ============================================================================
-- PHASE 3: VERIFICATION (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify all images have been migrated
-- This query should return 0 rows if migration is complete
-- SELECT COUNT(*) as unmigrated_images
-- FROM images
-- WHERE migrated_to_cloudinary = false;

-- Verify data integrity
-- Check that all migrated images have required fields
-- SELECT COUNT(*) as incomplete_migrations
-- FROM images
-- WHERE migrated_to_cloudinary = true
--   AND (image_url IS NULL OR cloudinary_public_id IS NULL);

-- ============================================================================
-- PHASE 4: CLEANUP (RUN AFTER VERIFICATION PERIOD)
-- ============================================================================

-- WARNING: Only run this after:
-- 1. All images successfully migrated (verified above)
-- 2. Application code updated to use image_url instead of image_data
-- 3. Verification period complete (recommended: 30 days)
-- 4. Backup of database created

-- UNCOMMENT TO EXECUTE:
-- BEGIN;
--
-- -- Make image_url required for new images
-- ALTER TABLE images
-- ALTER COLUMN image_url SET NOT NULL;
--
-- -- Drop the old base64 column (IRREVERSIBLE - ensure backup exists!)
-- ALTER TABLE images
-- DROP COLUMN IF EXISTS image_data;
--
-- -- Drop migration tracking columns (no longer needed)
-- ALTER TABLE images
-- DROP COLUMN IF EXISTS migrated_to_cloudinary;
--
-- ALTER TABLE images
-- DROP COLUMN IF EXISTS migration_attempted_at;
--
-- ALTER TABLE images
-- DROP COLUMN IF EXISTS migration_error;
--
-- COMMIT;

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

-- If issues are discovered during migration, you can rollback safely:
--
-- OPTION 1: Rollback to base64 storage (before image_data is dropped)
-- 1. Revert application code to use image_data instead of image_url
-- 2. Optionally delete Cloudinary images to free storage:
--    - Application code should iterate through cloudinary_public_id values
--    - Call Cloudinary deletion API for each public_id
-- 3. Optionally drop new columns (but safe to keep for future attempts):
--
-- BEGIN;
-- ALTER TABLE images DROP COLUMN IF EXISTS image_url;
-- ALTER TABLE images DROP COLUMN IF EXISTS thumbnail_url;
-- ALTER TABLE images DROP COLUMN IF EXISTS cloudinary_public_id;
-- ALTER TABLE images DROP COLUMN IF EXISTS migrated_to_cloudinary;
-- ALTER TABLE images DROP COLUMN IF EXISTS migration_attempted_at;
-- ALTER TABLE images DROP COLUMN IF EXISTS migration_error;
-- DROP INDEX IF EXISTS idx_images_cloudinary_public_id;
-- DROP INDEX IF EXISTS idx_images_migrated_to_cloudinary;
-- DROP INDEX IF EXISTS idx_images_listing_migration_status;
-- COMMIT;
--
-- OPTION 2: Retry failed migrations
-- 1. Query images with migration_error IS NOT NULL
-- 2. Fix underlying issues (API limits, network, etc.)
-- 3. Clear migration_error and set migrated_to_cloudinary = false
-- 4. Re-run migration script:
--
-- UPDATE images
-- SET migrated_to_cloudinary = false,
--     migration_error = NULL
-- WHERE migration_error IS NOT NULL;

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Database size comparison (check space savings after cleanup)
-- SELECT
--     pg_size_pretty(pg_total_relation_size('images')) as total_size,
--     pg_size_pretty(pg_relation_size('images')) as table_size,
--     pg_size_pretty(pg_indexes_size('images')) as indexes_size;

-- Find largest images (useful for optimization)
-- SELECT
--     id,
--     listing_id,
--     LENGTH(image_data) as base64_size,
--     pg_size_pretty(LENGTH(image_data)::bigint) as size_pretty
-- FROM images
-- WHERE image_data IS NOT NULL
-- ORDER BY LENGTH(image_data) DESC
-- LIMIT 10;

-- Migration performance metrics
-- SELECT
--     DATE_TRUNC('hour', migration_attempted_at) as hour,
--     COUNT(*) as migrations_attempted,
--     COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as successful,
--     COUNT(CASE WHEN migration_error IS NOT NULL THEN 1 END) as failed
-- FROM images
-- WHERE migration_attempted_at IS NOT NULL
-- GROUP BY hour
-- ORDER BY hour DESC;

-- ============================================================================
-- END OF MIGRATION FILE
-- ============================================================================
