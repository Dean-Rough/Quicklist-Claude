-- Webhook Events table for idempotent processing
-- Prevents duplicate webhook processing on retries

CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payload JSONB -- Optional: store event payload for debugging
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- Auto-cleanup old events (keep 30 days)
-- Can be run via cron: DELETE FROM webhook_events WHERE processed_at < NOW() - INTERVAL '30 days';
