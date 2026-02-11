#!/usr/bin/env node

/**
 * Platform-Agnostic Migration Script
 *
 * Migrates the database to support multi-platform listings
 * Run with: node scripts/migrate_platform_agnostic.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(70), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(70), 'cyan');
}

async function runMigration() {
  let client;

  try {
    logSection('PLATFORM-AGNOSTIC MIGRATION STARTING');

    // Get a client from the pool
    client = await pool.connect();
    log('✓ Database connected', 'green');

    // Read SQL migration file
    const sqlPath = path.join(__dirname, '..', 'schema_platform_agnostic.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }

    log(`✓ Found migration file: ${sqlPath}`, 'green');

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into statements (simple approach)
    // Note: This doesn't handle all edge cases, but works for our structured SQL
    const statements = sqlContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    log(`✓ Parsed ${statements.length} SQL statements`, 'green');

    // Execute migration in transaction
    logSection('EXECUTING MIGRATION');

    await client.query('BEGIN');
    log('✓ Transaction started', 'blue');

    let executedCount = 0;
    let skippedCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments and empty statements
        if (
          statement.startsWith('--') ||
          statement.trim().length === 0 ||
          statement.includes('ROLLBACK INSTRUCTIONS') ||
          statement.includes('VERIFICATION QUERIES') ||
          statement.includes('MIGRATION COMPLETE')
        ) {
          skippedCount++;
          continue;
        }

        // Execute statement
        await client.query(statement + ';');
        executedCount++;

        // Log progress every 10 statements
        if (executedCount % 10 === 0) {
          log(`  Executed ${executedCount} statements...`, 'blue');
        }
      } catch (error) {
        // Some statements may fail if already executed (e.g., CREATE TABLE IF NOT EXISTS)
        // We'll log but continue
        if (error.message.includes('already exists')) {
          log(`  ⚠ Skipped: ${error.message.split(':')[0]}`, 'yellow');
          skippedCount++;
        } else {
          throw error;
        }
      }
    }

    await client.query('COMMIT');
    log(`✓ Transaction committed`, 'green');
    log(`✓ Executed ${executedCount} statements`, 'green');
    log(`✓ Skipped ${skippedCount} statements`, 'yellow');

    // Run data migration function
    logSection('MIGRATING EXISTING DATA');

    const _migrationResult = await client.query(`
      DO $$
      DECLARE
        listing_record RECORD;
        platform_value VARCHAR(50);
        migrated_count INTEGER := 0;
      BEGIN
        FOR listing_record IN
          SELECT id, platform
          FROM listings
          WHERE is_platform_agnostic = false OR is_platform_agnostic IS NULL
        LOOP
          -- Determine platform (default to 'ebay' if null)
          platform_value := COALESCE(LOWER(listing_record.platform), 'ebay');

          -- Ensure platform is valid
          IF platform_value NOT IN ('ebay', 'vinted', 'depop', 'facebook') THEN
            platform_value := 'ebay';
          END IF;

          -- Create platform status entry
          INSERT INTO listing_platform_status (listing_id, platform, status, created_at)
          VALUES (listing_record.id, platform_value, 'draft', NOW())
          ON CONFLICT (listing_id, platform) DO NOTHING;

          -- Mark listing as migrated
          UPDATE listings
          SET
            is_platform_agnostic = true,
            target_platforms = ARRAY[platform_value, 'vinted', 'depop', 'facebook'],
            updated_at = NOW()
          WHERE id = listing_record.id;

          migrated_count := migrated_count + 1;
        END LOOP;

        RAISE NOTICE 'Migrated % listings', migrated_count;
      END $$;
    `);

    log('✓ Existing listings migrated to platform-agnostic format', 'green');

    // Run verification queries
    logSection('VERIFICATION');

    const statsResult = await client.query(`
      SELECT
        COUNT(*) AS total_listings,
        COUNT(*) FILTER (WHERE is_platform_agnostic = true) AS migrated_listings,
        COUNT(*) FILTER (WHERE is_platform_agnostic = false) AS pending_listings
      FROM listings;
    `);

    const stats = statsResult.rows[0];
    log(`  Total listings: ${stats.total_listings}`, 'cyan');
    log(`  Migrated: ${stats.migrated_listings}`, 'green');
    log(`  Pending: ${stats.pending_listings}`, 'yellow');

    const platformStats = await client.query(`
      SELECT platform, status, COUNT(*) as count
      FROM listing_platform_status
      GROUP BY platform, status
      ORDER BY platform, status;
    `);

    log('\n  Platform Status Distribution:', 'cyan');
    for (const row of platformStats.rows) {
      log(`    ${row.platform.padEnd(10)} ${row.status.padEnd(10)} ${row.count}`, 'blue');
    }

    const tableCheck = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('listing_platform_status', 'platform_optimizations', 'clipboard_analytics', 'ebay_tokens')
      ORDER BY tablename;
    `);

    log('\n  New Tables Created:', 'cyan');
    for (const row of tableCheck.rows) {
      log(`    ✓ ${row.tablename}`, 'green');
    }

    // Success summary
    logSection('MIGRATION COMPLETE');
    log('✓ Database schema updated successfully', 'green');
    log('✓ All existing listings migrated', 'green');
    log('✓ Platform status tracking enabled', 'green');
    log('✓ Ready for platform-agnostic listing generation', 'green');

    log('\nNext steps:', 'cyan');
    log('  1. Restart your server to load the new API endpoints', 'blue');
    log(
      '  2. Test platform variation generation: GET /api/listings/:id/platform-variations',
      'blue'
    );
    log('  3. Test platform status tracking: POST /api/listings/:id/platform-status', 'blue');
    log('  4. Update frontend to use new mobile-first UI components', 'blue');
    log('\n');
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      log('✗ Transaction rolled back due to error', 'red');
    }

    log('\n✗ MIGRATION FAILED', 'red');
    log(`Error: ${error.message}`, 'red');

    if (error.stack) {
      log('\nStack trace:', 'yellow');
      console.error(error.stack);
    }

    process.exit(1);
  } finally {
    if (client) {
      client.release();
      log('\n✓ Database connection released', 'green');
    }

    await pool.end();
    log('✓ Database pool closed', 'green');
  }
}

// Show warning before running
function showWarning() {
  logSection('⚠ WARNING');
  log('This script will modify your database schema and migrate existing data.', 'yellow');
  log('Make sure you have a backup before proceeding.', 'yellow');
  log('\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const forceRun = args.includes('--force') || args.includes('-f');

if (!forceRun) {
  showWarning();
  log('To proceed with the migration, run:', 'cyan');
  log('  node scripts/migrate_platform_agnostic.js --force', 'cyan');
  log('\n');
  process.exit(0);
}

// Run migration
runMigration().catch((error) => {
  log('✗ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
