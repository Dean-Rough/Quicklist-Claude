-- QuickList AI Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    google_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50) DEFAULT 'email', -- 'email' or 'google'
    name VARCHAR(255),
    avatar_url TEXT,
    ebay_auth_token TEXT, -- Per-user eBay authentication token
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(255),
    description TEXT,
    condition VARCHAR(100),
    rrp VARCHAR(50),
    price VARCHAR(50),
    keywords TEXT[], -- Array of keywords
    sources JSONB, -- JSON array of source objects
    platform VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft', -- Listing status: draft, active, sold
    sold_price VARCHAR(50), -- Actual sale price
    sold_at TIMESTAMP, -- When the item was sold
    location VARCHAR(255), -- Item location
    ebay_item_id VARCHAR(50), -- eBay listing ID after posting
    pricing_data JSONB, -- Pricing intelligence data from eBay
    posted_to_ebay BOOLEAN DEFAULT false,
    ebay_posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL, -- Base64 encoded image
    image_order INTEGER DEFAULT 0,
    is_blurry BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_sold_at ON listings(sold_at);
CREATE INDEX IF NOT EXISTS idx_images_listing_id ON images(listing_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    plan_type VARCHAR(50) DEFAULT 'free',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    listings_created INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- Create indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period_start ON usage_tracking(period_start);

-- Create trigger for subscriptions updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for usage_tracking updated_at
DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
