-- Migration: Add Clerk support to users table
-- Run this if you're adding Clerk authentication to an existing database
-- Applied: 2025-11-12

-- Add clerk_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;

-- Add auth_provider column (supports 'email', 'google', 'clerk')
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'clerk';

-- Add name column (for Clerk user display name)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add avatar_url column (for Clerk user profile picture)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make password_hash nullable (Clerk users don't have passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create index for clerk_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

