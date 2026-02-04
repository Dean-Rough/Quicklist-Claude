# Cloudinary Migration - Quick Reference Card

## Prerequisites Checklist

```bash
# 1. Create Cloudinary account and get credentials
# Add to .env:
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# 2. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 3. Install dependencies
npm install cloudinary
```

## 4-Step Migration Process

### Step 1: Schema Changes (< 1 second)

```bash
psql $DATABASE_URL -f schema_cloudinary_migration.sql
```

**Verify:**

```sql
\d images
-- Should show: image_url, thumbnail_url, cloudinary_public_id
```

### Step 2: Migrate Data (1-2 sec/image)

```bash
# Test first (dry run)
node scripts/migrate_to_cloudinary.js --dry-run

# Run migration
node scripts/migrate_to_cloudinary.js

# Retry failed images
node scripts/migrate_to_cloudinary.js --retry-failed
```

**Monitor progress:**

```sql
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated,
    ROUND(COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as percent
FROM images;
```

### Step 3: Verification (5 minutes)

```sql
-- All images migrated? (should return 0)
SELECT COUNT(*) FROM images WHERE migrated_to_cloudinary = false;

-- Any errors? (should return 0)
SELECT COUNT(*) FROM images WHERE migration_error IS NOT NULL;

-- Data integrity check (should return 0)
SELECT COUNT(*) FROM images
WHERE migrated_to_cloudinary = true
  AND (image_url IS NULL OR cloudinary_public_id IS NULL);
```

**Test a sample image:**

```sql
SELECT image_url FROM images WHERE migrated_to_cloudinary = true LIMIT 1;
-- Copy URL and open in browser
```

**Update application code:**

```javascript
// OLD: Use image_data
const images = await pool.query('SELECT id, image_data FROM images WHERE listing_id = $1', [
  listingId,
]);

// NEW: Use image_url
const images = await pool.query(
  'SELECT id, image_url, thumbnail_url, cloudinary_public_id FROM images WHERE listing_id = $1',
  [listingId]
);
```

### Step 4: Cleanup (After 30 days)

```bash
# Backup first!
pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d).sql

# Edit schema_cloudinary_migration.sql
# Uncomment Phase 4 section, then:
psql $DATABASE_URL -f schema_cloudinary_migration.sql
```

**Verify cleanup:**

```sql
\d images
-- Should NOT show: image_data, migrated_to_cloudinary, migration_* columns
```

## Time Estimates

| Images  | Schema | Migration | Total    |
| ------- | ------ | --------- | -------- |
| 100     | < 1s   | 2-3 min   | ~5 min   |
| 1,000   | < 1s   | 20-30 min | ~35 min  |
| 10,000  | < 1s   | 3-5 hours | ~5 hours |
| 100,000 | < 1s   | 1-2 days  | ~2 days  |

## Common Commands

### Check Migration Status

```sql
SELECT
    COUNT(*) as total_images,
    COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END) as migrated,
    COUNT(CASE WHEN migration_error IS NOT NULL THEN 1 END) as failed,
    ROUND(COUNT(CASE WHEN migrated_to_cloudinary = true THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as percent_complete
FROM images;
```

### View Failed Migrations

```sql
SELECT id, listing_id, migration_error, migration_attempted_at
FROM images
WHERE migration_error IS NOT NULL
ORDER BY migration_attempted_at DESC;
```

### Retry All Failed

```bash
node scripts/migrate_to_cloudinary.js --retry-failed
```

### Check Database Size

```sql
SELECT pg_size_pretty(pg_total_relation_size('images')) as size;
```

## Rollback (Before Cleanup)

```bash
# 1. Revert application code to use image_data

# 2. Deploy reverted code

# 3. Optional: Drop new columns
psql $DATABASE_URL << EOF
BEGIN;
ALTER TABLE images DROP COLUMN image_url;
ALTER TABLE images DROP COLUMN thumbnail_url;
ALTER TABLE images DROP COLUMN cloudinary_public_id;
ALTER TABLE images DROP COLUMN migrated_to_cloudinary;
ALTER TABLE images DROP COLUMN migration_attempted_at;
ALTER TABLE images DROP COLUMN migration_error;
COMMIT;
EOF
```

## Rollback (After Cleanup)

```bash
# Restore from backup
psql $DATABASE_URL < backup_before_cleanup_YYYYMMDD.sql
```

## Troubleshooting

| Issue               | Solution                            |
| ------------------- | ----------------------------------- |
| Rate limit exceeded | Reduce batch size: `--batch-size 5` |
| Timeout errors      | Add delay: `--delay 5000`           |
| Images not loading  | Check Cloudinary URL in browser     |
| Script crashes      | Just re-run (it resumes)            |

## Migration Script Options

```bash
# Default (batch size 10)
node scripts/migrate_to_cloudinary.js

# Custom batch size
node scripts/migrate_to_cloudinary.js --batch-size 5

# Dry run (test without changes)
node scripts/migrate_to_cloudinary.js --dry-run

# Retry failed only
node scripts/migrate_to_cloudinary.js --retry-failed

# Custom retry count
node scripts/migrate_to_cloudinary.js --max-retries 5

# Custom delay between batches
node scripts/migrate_to_cloudinary.js --delay 2000
```

## Support

- **Migration instructions:** See MIGRATION_INSTRUCTIONS.md
- **Schema file:** schema_cloudinary_migration.sql
- **Migration script:** scripts/migrate_to_cloudinary.js
- **Cloudinary docs:** https://cloudinary.com/documentation

## Post-Migration Checklist

- [ ] All images migrated (0 pending)
- [ ] No migration errors (0 failed)
- [ ] Sample images load in browser
- [ ] Application code updated
- [ ] Code deployed to staging
- [ ] End-to-end testing complete
- [ ] Deployed to production
- [ ] 30-day monitoring period started
- [ ] Final backup created
- [ ] Cleanup executed (Phase 4)
- [ ] Database size reduced

---

**Quick Start:** `psql $DATABASE_URL -f schema_cloudinary_migration.sql && node scripts/migrate_to_cloudinary.js`
