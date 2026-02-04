#!/usr/bin/env node

/**
 * QuickList AI - Cloudinary Migration Script
 *
 * This script migrates base64 image data from the database to Cloudinary.
 * It processes images in batches, with retry logic and error handling.
 *
 * Usage:
 *   node scripts/migrate_to_cloudinary.js [options]
 *
 * Options:
 *   --batch-size <number>   Number of images to process at once (default: 10)
 *   --dry-run              Run without making changes (for testing)
 *   --retry-failed         Retry previously failed migrations only
 *   --max-retries <number>  Maximum retry attempts per image (default: 3)
 *   --delay <ms>           Delay between batches in milliseconds (default: 1000)
 *
 * Examples:
 *   node scripts/migrate_to_cloudinary.js
 *   node scripts/migrate_to_cloudinary.js --batch-size 5 --dry-run
 *   node scripts/migrate_to_cloudinary.js --retry-failed
 */

require('dotenv').config();
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};
const hasFlag = (name) => args.includes(name);

// Configuration
const CONFIG = {
  BATCH_SIZE: parseInt(getArg('--batch-size', '10')),
  MAX_RETRIES: parseInt(getArg('--max-retries', '3')),
  RETRY_DELAY: 5000, // 5 seconds between retries
  BATCH_DELAY: parseInt(getArg('--delay', '1000')), // 1 second between batches
  DRY_RUN: hasFlag('--dry-run'),
  RETRY_FAILED_ONLY: hasFlag('--retry-failed'),
};

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((v) => console.error(`   - ${v}`));
  console.error('\nAdd these to your .env file and try again.');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
};

/**
 * Main migration function
 */
async function migrateImages() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     QuickList AI - Cloudinary Migration Script               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (CONFIG.DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
  }

  console.log('Configuration:');
  console.log(`  Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(`  Max retries: ${CONFIG.MAX_RETRIES}`);
  console.log(`  Batch delay: ${CONFIG.BATCH_DELAY}ms`);
  console.log(`  Retry failed only: ${CONFIG.RETRY_FAILED_ONLY ? 'Yes' : 'No'}\n`);

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful');

    // Test Cloudinary connection
    if (!CONFIG.DRY_RUN) {
      await cloudinary.api.ping();
      console.log('✓ Cloudinary connection successful\n');
    }

    // Get total count of images to migrate
    const whereClause = CONFIG.RETRY_FAILED_ONLY
      ? 'WHERE migration_error IS NOT NULL'
      : 'WHERE migrated_to_cloudinary = false OR migrated_to_cloudinary IS NULL';

    const countResult = await pool.query(`SELECT COUNT(*) FROM images ${whereClause}`);
    stats.total = parseInt(countResult.rows[0].count);

    if (stats.total === 0) {
      console.log('✓ No images to migrate. All done!\n');
      return;
    }

    console.log(`Found ${stats.total} images to migrate\n`);
    console.log('─'.repeat(65));

    // Process images in batches
    let batchNumber = 0;
    while (true) {
      batchNumber++;

      // Fetch batch of unmigrated images
      const result = await pool.query(
        `SELECT i.id, i.image_data, i.listing_id, l.user_id
         FROM images i
         JOIN listings l ON i.listing_id = l.id
         ${whereClause}
         ORDER BY i.created_at ASC
         LIMIT $1`,
        [CONFIG.BATCH_SIZE]
      );

      if (result.rows.length === 0) {
        break; // All images processed
      }

      console.log(`\nBatch ${batchNumber} (${result.rows.length} images):`);

      // Process each image in the batch
      for (const image of result.rows) {
        await migrateImage(image);
        printProgress();
      }

      // Delay between batches to avoid rate limits
      if (result.rows.length === CONFIG.BATCH_SIZE) {
        await sleep(CONFIG.BATCH_DELAY);
      }
    }

    console.log('\n' + '─'.repeat(65));
    printSummary();
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Migrate a single image
 */
async function migrateImage(image, retryCount = 0) {
  const { id, image_data, listing_id, user_id } = image;

  try {
    // Skip if no image data
    if (!image_data) {
      stats.skipped++;
      console.log(`  ⊘ Image ${id}: No image data (skipped)`);
      return;
    }

    // Generate public_id for Cloudinary
    const publicId = `quicklist/${user_id}/${listing_id}/${id}`;

    if (CONFIG.DRY_RUN) {
      // Dry run - just log what would happen
      stats.migrated++;
      console.log(`  ✓ Image ${id}: Would upload to ${publicId}`);
      return;
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(`data:image/jpeg;base64,${image_data}`, {
      public_id: publicId,
      folder: 'quicklist',
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      timeout: 60000, // 60 second timeout
    });

    // Generate thumbnail URL with Cloudinary transformations
    const thumbnailUrl = cloudinary.url(publicId, {
      transformation: [
        { width: 300, height: 300, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
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

    stats.migrated++;
    console.log(`  ✓ Image ${id}: Migrated successfully`);
  } catch (error) {
    // Retry logic
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`  ⟳ Image ${id}: Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES}...`);
      await sleep(CONFIG.RETRY_DELAY);
      return migrateImage(image, retryCount + 1);
    }

    // Max retries reached - log error
    stats.failed++;
    console.error(`  ✗ Image ${id}: Failed - ${error.message}`);

    if (!CONFIG.DRY_RUN) {
      // Log error to database
      await pool
        .query(
          `UPDATE images
         SET migration_error = $1,
             migration_attempted_at = NOW()
         WHERE id = $2`,
          [error.message, id]
        )
        .catch((err) => {
          console.error(`  ⚠ Failed to log error for image ${id}:`, err.message);
        });
    }
  }
}

/**
 * Print current progress
 */
function printProgress() {
  const processed = stats.migrated + stats.failed + stats.skipped;
  const percent = ((processed / stats.total) * 100).toFixed(1);
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
  const rate = (processed / elapsed).toFixed(2);

  process.stdout.write(
    `  Progress: ${processed}/${stats.total} (${percent}%) | ` +
      `Migrated: ${stats.migrated} | Failed: ${stats.failed} | ` +
      `Rate: ${rate}/sec\r`
  );
}

/**
 * Print final summary
 */
function printSummary() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
  const avgRate = (stats.migrated / elapsed).toFixed(2);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    Migration Complete                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('Summary:');
  console.log(`  Total images:      ${stats.total}`);
  console.log(`  ✓ Migrated:        ${stats.migrated}`);
  console.log(`  ✗ Failed:          ${stats.failed}`);
  console.log(`  ⊘ Skipped:         ${stats.skipped}`);
  console.log(`  Time elapsed:      ${elapsed}s`);
  console.log(`  Average rate:      ${avgRate} images/sec\n`);

  if (stats.failed > 0) {
    console.log('⚠ Some images failed to migrate.');
    console.log('  Run this query to see errors:');
    console.log(
      '  SELECT id, listing_id, migration_error FROM images WHERE migration_error IS NOT NULL;\n'
    );
    console.log('  To retry failed images, run:');
    console.log('  node scripts/migrate_to_cloudinary.js --retry-failed\n');
  }

  if (stats.migrated === stats.total && stats.failed === 0) {
    console.log('✓ All images migrated successfully!\n');
    console.log('Next steps:');
    console.log('  1. Run verification queries (see MIGRATION_INSTRUCTIONS.md)');
    console.log('  2. Update application code to use image_url');
    console.log('  3. Test thoroughly in staging environment');
    console.log('  4. Deploy to production');
    console.log('  5. Monitor for issues (30-day verification period)');
    console.log('  6. Run Phase 4 cleanup to drop image_data column\n');
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n\n⚠ Migration interrupted by user');
  printSummary();
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠ Migration terminated');
  printSummary();
  await pool.end();
  process.exit(0);
});

// Run migration
migrateImages().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
