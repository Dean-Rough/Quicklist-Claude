-- Migration: Referral programme and credit wallet
-- Run after schema.sql and schema_clerk_migration.sql
-- Applied: March 2026

-- 1. Add referral columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE,
  ADD COLUMN IF NOT EXISTS milestone_reward_issued BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 2. Referrals table — tracks each successful referral relationship
CREATE TABLE IF NOT EXISTS referrals (
  id               SERIAL PRIMARY KEY,
  referrer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_used        VARCHAR(12) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'complete',
  rewarded_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT referrals_referred_unique UNIQUE (referred_id),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- 3. Credit wallet — append-only ledger
CREATE TABLE IF NOT EXISTS user_credits (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  reason      VARCHAR(100) NOT NULL,
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '12 months'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- 4. Helper view: current balance per user (non-expired credits only)
CREATE OR REPLACE VIEW user_credit_balance AS
  SELECT
    user_id,
    COALESCE(SUM(amount), 0) AS balance
  FROM user_credits
  WHERE expires_at > NOW()
  GROUP BY user_id;
