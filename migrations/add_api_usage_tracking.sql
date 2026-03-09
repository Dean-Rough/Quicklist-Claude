-- API Usage Tracking and Cost Protection
-- Run this migration to add API usage logging

-- Create API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  image_count INT NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at DESC);

-- Add subscription tier to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'subscription_tier') THEN
    ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
  END IF;
END $$;

-- Add subscription fields if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
    ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'inactive';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'subscription_end_date') THEN
    ALTER TABLE users ADD COLUMN subscription_end_date TIMESTAMP;
  END IF;
END $$;

-- Create admin usage summary view
CREATE OR REPLACE VIEW api_usage_summary AS
SELECT
  DATE(created_at) as usage_date,
  COUNT(*) as total_calls,
  SUM(image_count) as total_images,
  SUM(estimated_cost) as total_cost,
  SUM(tokens_used) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(estimated_cost) as avg_cost_per_call,
  MAX(estimated_cost) as max_cost_per_call
FROM api_usage_logs
GROUP BY DATE(created_at)
ORDER BY usage_date DESC;

-- Create user usage summary view
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(l.id) as total_generations,
  SUM(l.image_count) as total_images,
  SUM(l.estimated_cost) as total_cost,
  MAX(l.created_at) as last_generation,
  COUNT(CASE WHEN l.created_at >= CURRENT_DATE THEN 1 END) as today_count,
  COUNT(CASE WHEN l.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as month_count
FROM users u
LEFT JOIN api_usage_logs l ON u.id = l.user_id
GROUP BY u.id, u.email, u.subscription_tier
ORDER BY total_cost DESC;

COMMENT ON TABLE api_usage_logs IS 'Tracks all Gemini API calls for cost monitoring and rate limiting';
COMMENT ON VIEW api_usage_summary IS 'Daily summary of API usage and costs';
COMMENT ON VIEW user_usage_summary IS 'Per-user API usage statistics';
