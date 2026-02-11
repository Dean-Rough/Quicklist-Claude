-- Migration: Add listing status and sales tracking columns
-- Run this to add missing columns to the listings table
-- Applied: 2025-11-12

-- Add status column for tracking listing state (draft, active, sold)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Add sold_price column for tracking actual sale price
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_price VARCHAR(50);

-- Add sold_at timestamp for tracking when items were sold
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;

-- Add location column for item location information
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Add eBay integration columns
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_item_id VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pricing_data JSONB;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS posted_to_ebay BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_posted_at TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_sold_at ON listings(sold_at);
CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);

-- Verification queries:
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'listings';
-- SELECT * FROM listings LIMIT 1;
