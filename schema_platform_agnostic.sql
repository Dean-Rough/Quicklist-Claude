-- ============================================================================
-- QuickList AI - Platform Agnostic Schema Migration
-- ============================================================================
-- Purpose: Transform listings from single-platform to multi-platform support
-- Date: 2025-01-13
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE NEW TABLES
-- ============================================================================

-- Table: listing_platform_status
-- Purpose: Track posting status for each listing across multiple platforms
-- Each listing can have multiple rows (one per platform)
CREATE TABLE IF NOT EXISTS listing_platform_status (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'ebay', 'vinted', 'depop', 'facebook'
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'posted', 'sold', 'delisted'

  -- Platform-specific identifiers
  platform_listing_id VARCHAR(255), -- External ID from platform (e.g., eBay item ID)
  platform_url TEXT, -- Direct link to listing on platform

  -- Analytics
  view_count INTEGER DEFAULT 0,
  watcher_count INTEGER DEFAULT 0, -- eBay watchers or equivalent

  -- Timestamps
  posted_at TIMESTAMP, -- When listing went live on platform
  sold_at TIMESTAMP, -- When item sold on this platform
  sale_price DECIMAL(10,2), -- Final sale price (may differ from listing price)

  -- Platform-specific metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}', -- Store platform-specific data

  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(listing_id, platform), -- One status per platform per listing
  CHECK (status IN ('draft', 'posted', 'sold', 'delisted')),
  CHECK (platform IN ('ebay', 'vinted', 'depop', 'facebook'))
);

-- Indexes for performance
CREATE INDEX idx_listing_platform_listing_id ON listing_platform_status(listing_id);
CREATE INDEX idx_listing_platform_status ON listing_platform_status(status);
CREATE INDEX idx_listing_platform_name ON listing_platform_status(platform);
CREATE INDEX idx_listing_platform_posted_at ON listing_platform_status(posted_at);
CREATE INDEX idx_listing_platform_sold_at ON listing_platform_status(sold_at);

-- Table: platform_optimizations
-- Purpose: Store platform-specific variations of listings (cached)
CREATE TABLE IF NOT EXISTS platform_optimizations (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,

  -- Optimized content
  optimized_title TEXT NOT NULL,
  optimized_description TEXT NOT NULL,
  clipboard_text TEXT, -- Pre-formatted clipboard text for Smart Clipboard

  -- Platform-specific fields
  item_specifics JSONB DEFAULT '{}', -- eBay item specifics, Vinted size conversions, etc.
  keywords TEXT[], -- Platform-optimized keywords
  hashtags TEXT[], -- For Depop, Facebook

  -- Metadata
  optimization_version VARCHAR(20) DEFAULT '1.0', -- Track algorithm version
  needs_regeneration BOOLEAN DEFAULT false, -- Flag for stale optimizations

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(listing_id, platform),
  CHECK (platform IN ('ebay', 'vinted', 'depop', 'facebook'))
);

CREATE INDEX idx_platform_opt_listing_id ON platform_optimizations(listing_id);
CREATE INDEX idx_platform_opt_platform ON platform_optimizations(platform);
CREATE INDEX idx_platform_opt_needs_regen ON platform_optimizations(needs_regeneration);

-- Table: clipboard_analytics
-- Purpose: Track Smart Clipboard usage and success rates
CREATE TABLE IF NOT EXISTS clipboard_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,

  -- Action tracking
  action VARCHAR(50) NOT NULL, -- 'copy', 'open_platform', 'paste_detected', 'post_confirmed'
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Context
  user_agent TEXT, -- Browser/device info
  session_id VARCHAR(100), -- Group actions in same session

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),

  CHECK (platform IN ('ebay', 'vinted', 'depop', 'facebook')),
  CHECK (action IN ('copy', 'open_platform', 'paste_detected', 'post_confirmed', 'error'))
);

CREATE INDEX idx_clipboard_analytics_user ON clipboard_analytics(user_id);
CREATE INDEX idx_clipboard_analytics_listing ON clipboard_analytics(listing_id);
CREATE INDEX idx_clipboard_analytics_platform ON clipboard_analytics(platform);
CREATE INDEX idx_clipboard_analytics_action ON clipboard_analytics(action);
CREATE INDEX idx_clipboard_analytics_session ON clipboard_analytics(session_id);

-- Table: ebay_tokens
-- Purpose: Store eBay OAuth tokens per user
CREATE TABLE IF NOT EXISTS ebay_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(20) DEFAULT 'Bearer',

  -- Token expiry
  expires_at TIMESTAMP NOT NULL,

  -- Metadata
  ebay_user_id VARCHAR(255), -- eBay's user identifier
  scope TEXT, -- OAuth scopes granted

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,

  -- Constraints
  UNIQUE(user_id)
);

CREATE INDEX idx_ebay_tokens_user_id ON ebay_tokens(user_id);
CREATE INDEX idx_ebay_tokens_expires_at ON ebay_tokens(expires_at);

-- ============================================================================
-- PHASE 2: MODIFY EXISTING TABLES
-- ============================================================================

-- Add platform-agnostic flags to listings table
DO $$
BEGIN
  -- Check if column exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'is_platform_agnostic'
  ) THEN
    ALTER TABLE listings ADD COLUMN is_platform_agnostic BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'target_platforms'
  ) THEN
    ALTER TABLE listings ADD COLUMN target_platforms TEXT[] DEFAULT ARRAY['ebay', 'vinted', 'depop', 'facebook'];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'clipboard_optimized'
  ) THEN
    ALTER TABLE listings ADD COLUMN clipboard_optimized BOOLEAN DEFAULT false;
  END IF;

  -- Add RRP (Recommended Retail Price) for savings calculations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'rrp'
  ) THEN
    ALTER TABLE listings ADD COLUMN rrp DECIMAL(10,2);
  END IF;

  -- Add size information for platform-specific conversions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'size'
  ) THEN
    ALTER TABLE listings ADD COLUMN size VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'color'
  ) THEN
    ALTER TABLE listings ADD COLUMN color VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'material'
  ) THEN
    ALTER TABLE listings ADD COLUMN material VARCHAR(100);
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: MIGRATE EXISTING DATA
-- ============================================================================

-- Create migration function
CREATE OR REPLACE FUNCTION migrate_existing_listings_to_platform_agnostic()
RETURNS void AS $$
DECLARE
  listing_record RECORD;
  platform_value VARCHAR(50);
BEGIN
  -- Loop through all existing listings that haven't been migrated
  FOR listing_record IN
    SELECT id, platform
    FROM listings
    WHERE is_platform_agnostic = false
  LOOP
    -- Determine platform (default to 'ebay' if null)
    platform_value := COALESCE(LOWER(listing_record.platform), 'ebay');

    -- Ensure platform is valid
    IF platform_value NOT IN ('ebay', 'vinted', 'depop', 'facebook') THEN
      platform_value := 'ebay';
    END IF;

    -- Create platform status entry for existing platform
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

    -- Log progress every 100 records
    IF listing_record.id % 100 = 0 THEN
      RAISE NOTICE 'Migrated % listings', listing_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete!';
END;
$$ LANGUAGE plpgsql;

-- Run migration (commented out - run manually after review)
-- SELECT migrate_existing_listings_to_platform_agnostic();

-- ============================================================================
-- PHASE 4: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function: Get listing platform statuses
CREATE OR REPLACE FUNCTION get_listing_platform_statuses(p_listing_id INTEGER)
RETURNS TABLE(
  platform VARCHAR(50),
  status VARCHAR(20),
  platform_url TEXT,
  view_count INTEGER,
  watcher_count INTEGER,
  posted_at TIMESTAMP,
  sold_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lps.platform,
    lps.status,
    lps.platform_url,
    lps.view_count,
    lps.watcher_count,
    lps.posted_at,
    lps.sold_at
  FROM listing_platform_status lps
  WHERE lps.listing_id = p_listing_id
  ORDER BY lps.platform;
END;
$$ LANGUAGE plpgsql;

-- Function: Update platform status
CREATE OR REPLACE FUNCTION update_platform_status(
  p_listing_id INTEGER,
  p_platform VARCHAR(50),
  p_status VARCHAR(20),
  p_platform_listing_id VARCHAR(255) DEFAULT NULL,
  p_platform_url TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO listing_platform_status (
    listing_id,
    platform,
    status,
    platform_listing_id,
    platform_url,
    posted_at,
    updated_at
  )
  VALUES (
    p_listing_id,
    p_platform,
    p_status,
    p_platform_listing_id,
    p_platform_url,
    CASE WHEN p_status = 'posted' THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (listing_id, platform)
  DO UPDATE SET
    status = EXCLUDED.status,
    platform_listing_id = COALESCE(EXCLUDED.platform_listing_id, listing_platform_status.platform_listing_id),
    platform_url = COALESCE(EXCLUDED.platform_url, listing_platform_status.platform_url),
    posted_at = CASE
      WHEN EXCLUDED.status = 'posted' AND listing_platform_status.posted_at IS NULL
      THEN NOW()
      ELSE listing_platform_status.posted_at
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get platform optimization (cached)
CREATE OR REPLACE FUNCTION get_platform_optimization(
  p_listing_id INTEGER,
  p_platform VARCHAR(50)
)
RETURNS TABLE(
  optimized_title TEXT,
  optimized_description TEXT,
  clipboard_text TEXT,
  item_specifics JSONB,
  keywords TEXT[],
  hashtags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.optimized_title,
    po.optimized_description,
    po.clipboard_text,
    po.item_specifics,
    po.keywords,
    po.hashtags
  FROM platform_optimizations po
  WHERE po.listing_id = p_listing_id
    AND po.platform = p_platform
    AND po.needs_regeneration = false;
END;
$$ LANGUAGE plpgsql;

-- Function: Track clipboard action
CREATE OR REPLACE FUNCTION track_clipboard_action(
  p_user_id INTEGER,
  p_listing_id INTEGER,
  p_platform VARCHAR(50),
  p_action VARCHAR(50),
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_session_id VARCHAR(100) DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO clipboard_analytics (
    user_id,
    listing_id,
    platform,
    action,
    success,
    error_message,
    session_id,
    created_at
  )
  VALUES (
    p_user_id,
    p_listing_id,
    p_platform,
    p_action,
    p_success,
    p_error_message,
    p_session_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 5: CREATE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Listing overview with platform statuses
CREATE OR REPLACE VIEW v_listings_with_platforms AS
SELECT
  l.id,
  l.user_id,
  l.title,
  l.price,
  l.rrp,
  l.brand,
  l.category,
  l.condition,
  l.size,
  l.color,
  l.material,
  l.is_platform_agnostic,
  l.target_platforms,
  l.created_at,
  l.updated_at,
  -- Aggregate platform statuses
  COALESCE(
    json_agg(
      json_build_object(
        'platform', lps.platform,
        'status', lps.status,
        'url', lps.platform_url,
        'views', lps.view_count,
        'watchers', lps.watcher_count,
        'posted_at', lps.posted_at
      )
    ) FILTER (WHERE lps.id IS NOT NULL),
    '[]'::json
  ) AS platform_statuses
FROM listings l
LEFT JOIN listing_platform_status lps ON l.id = lps.listing_id
GROUP BY l.id;

-- View: Platform performance metrics
CREATE OR REPLACE VIEW v_platform_performance AS
SELECT
  platform,
  COUNT(*) AS total_listings,
  COUNT(*) FILTER (WHERE status = 'posted') AS posted_count,
  COUNT(*) FILTER (WHERE status = 'sold') AS sold_count,
  AVG(view_count) AS avg_views,
  AVG(watcher_count) AS avg_watchers,
  AVG(EXTRACT(EPOCH FROM (sold_at - posted_at)) / 86400) AS avg_days_to_sell
FROM listing_platform_status
GROUP BY platform;

-- View: Clipboard success rates
CREATE OR REPLACE VIEW v_clipboard_success_rates AS
SELECT
  platform,
  action,
  COUNT(*) AS total_actions,
  COUNT(*) FILTER (WHERE success = true) AS successful_actions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0),
    2
  ) AS success_rate_percent
FROM clipboard_analytics
GROUP BY platform, action;

-- ============================================================================
-- PHASE 6: CREATE TRIGGERS
-- ============================================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_listing_platform_status_updated_at ON listing_platform_status;
CREATE TRIGGER update_listing_platform_status_updated_at
  BEFORE UPDATE ON listing_platform_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_optimizations_updated_at ON platform_optimizations;
CREATE TRIGGER update_platform_optimizations_updated_at
  BEFORE UPDATE ON platform_optimizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ebay_tokens_updated_at ON ebay_tokens;
CREATE TRIGGER update_ebay_tokens_updated_at
  BEFORE UPDATE ON ebay_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-set sold_at timestamp when status changes to 'sold'
CREATE OR REPLACE FUNCTION set_sold_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    NEW.sold_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_set_sold_at ON listing_platform_status;
CREATE TRIGGER auto_set_sold_at
  BEFORE UPDATE ON listing_platform_status
  FOR EACH ROW
  EXECUTE FUNCTION set_sold_at_timestamp();

-- ============================================================================
-- PHASE 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to application user (adjust username as needed)
-- GRANT ALL ON listing_platform_status TO quicklist_app_user;
-- GRANT ALL ON platform_optimizations TO quicklist_app_user;
-- GRANT ALL ON clipboard_analytics TO quicklist_app_user;
-- GRANT ALL ON ebay_tokens TO quicklist_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quicklist_app_user;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration status
-- SELECT
--   COUNT(*) AS total_listings,
--   COUNT(*) FILTER (WHERE is_platform_agnostic = true) AS migrated_listings,
--   COUNT(*) FILTER (WHERE is_platform_agnostic = false) AS pending_listings
-- FROM listings;

-- Check platform status distribution
-- SELECT platform, status, COUNT(*)
-- FROM listing_platform_status
-- GROUP BY platform, status
-- ORDER BY platform, status;

-- Check if indexes were created
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('listing_platform_status', 'platform_optimizations', 'clipboard_analytics', 'ebay_tokens')
-- ORDER BY tablename, indexname;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration (use with caution!):
-- DROP VIEW IF EXISTS v_listings_with_platforms CASCADE;
-- DROP VIEW IF EXISTS v_platform_performance CASCADE;
-- DROP VIEW IF EXISTS v_clipboard_success_rates CASCADE;
-- DROP TABLE IF EXISTS clipboard_analytics CASCADE;
-- DROP TABLE IF EXISTS platform_optimizations CASCADE;
-- DROP TABLE IF EXISTS listing_platform_status CASCADE;
-- DROP TABLE IF EXISTS ebay_tokens CASCADE;
-- DROP FUNCTION IF EXISTS migrate_existing_listings_to_platform_agnostic() CASCADE;
-- DROP FUNCTION IF EXISTS get_listing_platform_statuses(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS update_platform_status(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_platform_optimization(INTEGER, VARCHAR) CASCADE;
-- DROP FUNCTION IF EXISTS track_clipboard_action(INTEGER, INTEGER, VARCHAR, VARCHAR, BOOLEAN, TEXT, VARCHAR) CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- DROP FUNCTION IF EXISTS set_sold_at_timestamp() CASCADE;
-- ALTER TABLE listings DROP COLUMN IF EXISTS is_platform_agnostic;
-- ALTER TABLE listings DROP COLUMN IF EXISTS target_platforms;
-- ALTER TABLE listings DROP COLUMN IF EXISTS clipboard_optimized;
-- ALTER TABLE listings DROP COLUMN IF EXISTS rrp;
-- ALTER TABLE listings DROP COLUMN IF EXISTS size;
-- ALTER TABLE listings DROP COLUMN IF EXISTS color;
-- ALTER TABLE listings DROP COLUMN IF EXISTS material;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Review this schema carefully
-- 2. Test on development database first
-- 3. Run: psql -d your_database -f schema_platform_agnostic.sql
-- 4. Run migration function: SELECT migrate_existing_listings_to_platform_agnostic();
-- 5. Verify with verification queries above
-- 6. Update backend API to use new schema
-- ============================================================================
