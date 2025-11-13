# Cloudinary Migration Instructions

## Overview

This document provides step-by-step instructions for migrating from base64 image storage to Cloudinary cloud-hosted URLs. The migration is designed for zero-downtime deployment with safe rollback options.

## Prerequisites

1. **Cloudinary Account Setup**
   - Sign up at [cloudinary.com](https://cloudinary.com)
   - Note your credentials: Cloud Name, API Key, API Secret
   - Add to `.env`:
     ```env
     CLOUDINARY_CLOUD_NAME=your_cloud_name
     CLOUDINARY_API_KEY=your_api_key
     CLOUDINARY_API_SECRET=your_api_secret
     ```

2. **Database Backup**
   ```bash
   # Create backup before migration
   pg_dump $DATABASE_URL > backup_before_cloudinary_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Install Cloudinary SDK**
   ```bash
   npm install cloudinary
   ```

## Migration Phases

### Phase 1: Schema Changes (Safe - Instant)

**Time:** < 1 second
**Impact:** None - adds nullable columns only

1. **Review the migration file:**
   ```bash
   cat schema_cloudinary_migration.sql
   ```

2. **Run Phase 1 migration:**

   **Option A: Via psql command line**
   ```bash
   psql $DATABASE_URL -f schema_cloudinary_migration.sql
   ```

   **Option B: Via application endpoint** (if you implement it)
   ```bash
   curl -X POST http://localhost:4577/api/admin/run-migration \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"phase": 1}'
   ```

3. **Verify schema changes:**
   ```bash
   psql $DATABASE_URL -c "\\d images"
   ```

   You should see new columns:
   - `image_url`
   - `thumbnail_url`
   - `cloudinary_public_id`
   - `migrated_to_cloudinary`
   - `migration_attempted_at`
   - `migration_error`

4. **Check migration progress:**
   ```sql
   SELECT
       COUNT(*) as total_images,
       COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated_images,
       COUNT(CASE WHEN migrated_to_cloudinary = false THEN 1 END) as pending_images
   FROM images;
   ```

### Phase 2: Data Migration (Gradual - Hours)

**Time:** ~1-2 seconds per image
**Impact:** Increased Cloudinary API calls and database writes

This phase uploads base64 images to Cloudinary and updates database records.

#### Option A: Automated Migration Script (Recommended)

Create `scripts/migrate_to_cloudinary.js`:

```javascript
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Configuration
const BATCH_SIZE = 10; // Process 10 images at a time
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function migrateImages() {
  console.log('Starting Cloudinary migration...');

  try {
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM images WHERE migrated_to_cloudinary = false'
    );
    const totalImages = parseInt(countResult.rows[0].count);
    console.log(`Found ${totalImages} images to migrate`);

    let migrated = 0;
    let failed = 0;

    while (true) {
      // Fetch batch of unmigrated images
      const result = await pool.query(
        `SELECT i.id, i.image_data, i.listing_id, l.user_id
         FROM images i
         JOIN listings l ON i.listing_id = l.id
         WHERE i.migrated_to_cloudinary = false
         ORDER BY i.created_at ASC
         LIMIT $1`,
        [BATCH_SIZE]
      );

      if (result.rows.length === 0) {
        break; // All images migrated
      }

      console.log(`\nProcessing batch of ${result.rows.length} images...`);

      for (const image of result.rows) {
        try {
          await migrateImage(image);
          migrated++;
          console.log(`✓ Migrated image ${image.id} (${migrated}/${totalImages})`);
        } catch (error) {
          failed++;
          console.error(`✗ Failed to migrate image ${image.id}:`, error.message);

          // Log error to database
          await pool.query(
            `UPDATE images
             SET migration_error = $1,
                 migration_attempted_at = NOW()
             WHERE id = $2`,
            [error.message, image.id]
          );
        }
      }

      // Progress report
      const percent = ((migrated / totalImages) * 100).toFixed(2);
      console.log(`Progress: ${migrated}/${totalImages} (${percent}%) - Failed: ${failed}`);
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total: ${totalImages}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Failed: ${failed}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function migrateImage(image, retryCount = 0) {
  const { id, image_data, listing_id, user_id } = image;

  try {
    // Generate public_id for Cloudinary
    const publicId = `quicklist/${user_id}/${listing_id}/${id}`;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${image_data}`,
      {
        public_id: publicId,
        folder: 'quicklist',
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      }
    );

    // Generate thumbnail URL with Cloudinary transformations
    const thumbnailUrl = cloudinary.url(publicId, {
      transformation: [
        { width: 300, height: 300, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    // Update database with Cloudinary URLs
    await pool.query(
      `UPDATE images
       SET image_url = $1,
           thumbnail_url = $2,
           cloudinary_public_id = $3,
           migrated_to_cloudinary = true,
           migration_attempted_at = NOW(),
           migration_error = NULL
       WHERE id = $4`,
      [uploadResult.secure_url, thumbnailUrl, publicId, id]
    );

  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying image ${id} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return migrateImage(image, retryCount + 1);
    }
    throw error;
  }
}

// Run migration
migrateImages().catch(console.error);
```

**Run the migration:**

```bash
node scripts/migrate_to_cloudinary.js
```

**Monitor progress in separate terminal:**

```bash
watch -n 10 "psql $DATABASE_URL -c \"SELECT COUNT(*) as total, COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated FROM images;\""
```

#### Option B: Gradual Migration (Background Process)

Add migration logic to your server that processes images gradually:

1. Add route to trigger migration:
   ```javascript
   app.post('/api/admin/migrate-batch', authenticateAdmin, async (req, res) => {
     const batchSize = req.body.batchSize || 10;
     // ... run migration for batch
   });
   ```

2. Create cron job or scheduled task:
   ```bash
   # Run every 5 minutes until complete
   */5 * * * * curl -X POST http://localhost:4577/api/admin/migrate-batch
   ```

### Phase 3: Verification (Critical)

**Time:** 5-10 minutes
**Impact:** None - read-only queries

1. **Verify all images migrated:**
   ```sql
   -- Should return 0
   SELECT COUNT(*) as unmigrated_images
   FROM images
   WHERE migrated_to_cloudinary = false;
   ```

2. **Check for migration errors:**
   ```sql
   SELECT id, listing_id, migration_error
   FROM images
   WHERE migration_error IS NOT NULL;
   ```

3. **Verify data integrity:**
   ```sql
   -- Should return 0
   SELECT COUNT(*) as incomplete_migrations
   FROM images
   WHERE migrated_to_cloudinary = true
     AND (image_url IS NULL OR cloudinary_public_id IS NULL);
   ```

4. **Test a sample image:**
   ```sql
   SELECT
       id,
       listing_id,
       image_url,
       thumbnail_url,
       cloudinary_public_id,
       migrated_to_cloudinary
   FROM images
   LIMIT 1;
   ```

   Copy the `image_url` and open in browser - verify image loads correctly.

5. **Update application code** to use `image_url` instead of `image_data`:

   In `server.js`, update image queries:
   ```javascript
   // OLD
   const images = await pool.query(
     'SELECT id, image_data, image_order FROM images WHERE listing_id = $1',
     [listingId]
   );

   // NEW
   const images = await pool.query(
     'SELECT id, image_url, thumbnail_url, cloudinary_public_id, image_order FROM images WHERE listing_id = $1',
     [listingId]
   );
   ```

6. **Deploy updated application code**

7. **Test end-to-end:**
   - View existing listings with migrated images
   - Upload new images (should go directly to Cloudinary)
   - Delete a listing (should delete from Cloudinary)

### Phase 4: Cleanup (After Verification Period)

**Time:** < 1 second
**Impact:** Drops `image_data` column - **IRREVERSIBLE**
**Recommended wait:** 30 days after Phase 3

1. **Final backup before cleanup:**
   ```bash
   pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Check database size before cleanup:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('images')) as total_size;
   ```

3. **Run cleanup (UNCOMMENT Phase 4 in migration file):**
   ```bash
   # Edit schema_cloudinary_migration.sql
   # Uncomment the Phase 4 section
   psql $DATABASE_URL -f schema_cloudinary_migration.sql
   ```

4. **Verify cleanup:**
   ```sql
   -- Should NOT show image_data column
   \d images
   ```

5. **Check space savings:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('images')) as total_size;
   ```

   Expected: 60-80% reduction in table size

## Rollback Procedures

### Before Phase 4 (Safe - Data Preserved)

If issues are found before dropping `image_data`:

1. **Revert application code** to use `image_data` instead of `image_url`

2. **Deploy reverted code**

3. **Optional: Clean up Cloudinary images** (to free storage):
   ```javascript
   // scripts/cleanup_cloudinary.js
   const images = await pool.query(
     'SELECT cloudinary_public_id FROM images WHERE cloudinary_public_id IS NOT NULL'
   );

   for (const img of images.rows) {
     await cloudinary.uploader.destroy(img.cloudinary_public_id);
   }
   ```

4. **Optional: Drop new columns** (if not planning to retry):
   ```sql
   BEGIN;
   ALTER TABLE images DROP COLUMN IF EXISTS image_url;
   ALTER TABLE images DROP COLUMN IF EXISTS thumbnail_url;
   ALTER TABLE images DROP COLUMN IF EXISTS cloudinary_public_id;
   ALTER TABLE images DROP COLUMN IF EXISTS migrated_to_cloudinary;
   ALTER TABLE images DROP COLUMN IF EXISTS migration_attempted_at;
   ALTER TABLE images DROP COLUMN IF EXISTS migration_error;
   DROP INDEX IF EXISTS idx_images_cloudinary_public_id;
   DROP INDEX IF EXISTS idx_images_migrated_to_cloudinary;
   DROP INDEX IF EXISTS idx_images_listing_migration_status;
   COMMIT;
   ```

### After Phase 4 (Requires Backup Restore)

If issues are found after dropping `image_data`:

1. **Restore from backup:**
   ```bash
   psql $DATABASE_URL < backup_before_cleanup_YYYYMMDD_HHMMSS.sql
   ```

2. **Follow "Before Phase 4" rollback steps above**

## Time Estimates by Database Size

### Small Database (< 100 images)
- Phase 1: < 1 second
- Phase 2: 2-3 minutes
- Phase 3: 2 minutes
- **Total: ~5 minutes**

### Medium Database (100-1,000 images)
- Phase 1: < 1 second
- Phase 2: 20-30 minutes
- Phase 3: 5 minutes
- **Total: ~35 minutes**

### Large Database (1,000-10,000 images)
- Phase 1: < 1 second
- Phase 2: 3-5 hours
- Phase 3: 10 minutes
- **Total: ~5 hours**

### Very Large Database (> 10,000 images)
- Phase 1: < 1 second
- Phase 2: 1-2 days (run over weekend)
- Phase 3: 15 minutes
- **Total: ~2 days**

**Note:** Times assume:
- Cloudinary upload: ~1-2 seconds per image
- Network latency: 100-500ms
- Batch processing: 10 images at a time
- Database on cloud (Neon): minimal query overhead

## Monitoring

### During Migration

```sql
-- Overall progress
SELECT
    COUNT(*) as total_images,
    COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated,
    COUNT(CASE WHEN migrated_to_cloudinary = false THEN 1 END) as pending,
    COUNT(CASE WHEN migration_error IS NOT NULL THEN 1 END) as failed,
    ROUND(
      COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END)::numeric /
      COUNT(*)::numeric * 100, 2
    ) as percent_complete
FROM images;

-- Migration rate (images per hour)
SELECT
    DATE_TRUNC('hour', migration_attempted_at) as hour,
    COUNT(*) as images_processed
FROM images
WHERE migration_attempted_at IS NOT NULL
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;

-- Recent errors
SELECT id, listing_id, migration_error, migration_attempted_at
FROM images
WHERE migration_error IS NOT NULL
ORDER BY migration_attempted_at DESC
LIMIT 10;
```

### After Migration

```sql
-- Verify completion
SELECT
    'All images migrated' as status
FROM images
HAVING COUNT(*) = COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END);

-- Check Cloudinary URLs are accessible (sample)
SELECT id, image_url, thumbnail_url
FROM images
WHERE migrated_to_cloudinary = true
ORDER BY RANDOM()
LIMIT 5;
```

## Troubleshooting

### Issue: "Rate limit exceeded" from Cloudinary

**Solution:**
- Free tier: 500 uploads/hour limit
- Add delay between batches: `setTimeout(5000)` after each batch
- Upgrade to paid plan for higher limits
- Run migration during off-peak hours

### Issue: "Request timeout" errors

**Solution:**
- Reduce batch size: `BATCH_SIZE = 5`
- Increase timeout in Cloudinary config: `timeout: 60000`
- Check network connectivity
- Retry failed images with longer timeout

### Issue: Images not displaying after migration

**Solution:**
- Verify Cloudinary URLs are public
- Check CORS settings in Cloudinary dashboard
- Test URL directly in browser
- Verify `image_url` in database matches Cloudinary response

### Issue: Migration script crashes mid-way

**Solution:**
- Script is resumable - just run again
- Tracks progress via `migrated_to_cloudinary` flag
- Already migrated images are skipped
- Check error logs: `migration_error` column

## Post-Migration Best Practices

1. **Set up Cloudinary webhook** for deletion sync:
   ```javascript
   // In server.js
   app.post('/api/webhooks/cloudinary', (req, res) => {
     // Sync deletion events from Cloudinary to database
   });
   ```

2. **Implement image optimization** via Cloudinary transformations:
   - Auto format: WebP for modern browsers, JPEG for legacy
   - Auto quality: Reduce file size without visible loss
   - Lazy loading: Only load images when in viewport

3. **Set up Cloudinary backup**:
   - Enable auto-backup in Cloudinary dashboard
   - Or sync to S3 as secondary storage

4. **Monitor Cloudinary usage**:
   - Set up alerts for bandwidth limits
   - Track transformations count
   - Monitor storage usage

5. **Update image upload flow** to go directly to Cloudinary:
   ```javascript
   // In server.js - new image upload
   app.post('/api/listings/:id/images', async (req, res) => {
     const result = await cloudinary.uploader.upload(req.body.image, {
       folder: 'quicklist',
       public_id: `quicklist/${userId}/${listingId}/${imageId}`
     });

     await pool.query(
       'INSERT INTO images (listing_id, image_url, thumbnail_url, cloudinary_public_id, migrated_to_cloudinary) VALUES ($1, $2, $3, $4, true)',
       [listingId, result.secure_url, thumbnailUrl, result.public_id]
     );
   });
   ```

## Support

For issues or questions:
1. Check migration error logs: `SELECT * FROM images WHERE migration_error IS NOT NULL`
2. Review Cloudinary dashboard: https://cloudinary.com/console
3. Consult Cloudinary docs: https://cloudinary.com/documentation
4. Contact QuickList support with migration logs

## Checklist

- [ ] Cloudinary account created and credentials added to `.env`
- [ ] Database backup created
- [ ] Phase 1 schema changes applied
- [ ] Phase 1 verified (columns added)
- [ ] Migration script tested on sample data
- [ ] Phase 2 data migration completed
- [ ] Phase 2 verified (all images migrated)
- [ ] Application code updated to use `image_url`
- [ ] Updated code deployed and tested
- [ ] Phase 3 verification completed
- [ ] 30-day verification period passed
- [ ] Final backup created before cleanup
- [ ] Phase 4 cleanup executed
- [ ] Space savings verified
- [ ] Post-migration monitoring in place

---

**Last Updated:** 2025-11-13
**Version:** 1.0
