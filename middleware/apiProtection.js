// API Cost Protection Middleware for Gemini API
const logger = require('../logger');

/**
 * FAILSAFE API Protection - NOT strict rate limiting
 *
 * Purpose: Prevent runaway costs from bugs, loops, or abuse
 * Philosophy: High limits that allow legitimate heavy usage
 *
 * These limits should NEVER be hit by normal customers, even power users
 * They only catch anomalies like:
 * - Infinite loops in code
 * - Accidental repeated clicks
 * - Malicious automated abuse
 *
 * Limits are intentionally generous - legitimate customers always work
 */

const TIER_LIMITS = {
  free: {
    hourly: 50,        // Catches infinite loops (50 requests in 1 hour = 1 every 72 seconds)
    daily: 100,        // Very generous - allows heavy legitimate usage
    monthly: 2000,     // ~66/day average
    maxImagesPerRequest: 50  // Photo dump can handle large batches
  },
  starter: {
    hourly: 200,       // ~1 every 18 seconds before blocking
    daily: 500,        // Allows all-day usage
    monthly: 10000,    // ~333/day average
    maxImagesPerRequest: 50
  },
  pro: {
    hourly: 500,       // Very high - catches only obvious issues
    daily: 2000,       // Professional usage
    monthly: 50000,    // ~1666/day average
    maxImagesPerRequest: 100
  },
  business: {
    hourly: 1000,      // Even business gets hourly failsafe
    daily: Infinity,
    monthly: Infinity,
    maxImagesPerRequest: 100
  }
};

// Emergency kill switch - set via environment variable
const EMERGENCY_SHUTDOWN = process.env.GEMINI_EMERGENCY_SHUTDOWN === 'true';

// Global monthly cost tracking (FAILSAFE ONLY - high limit)
let monthlySpend = 0;
const MONTHLY_BUDGET = parseFloat(process.env.GEMINI_MONTHLY_BUDGET) || 5000; // $5000 default failsafe
// Note: This is NOT a business budget - it's an emergency brake
// Set lower if needed, but keep high enough for legitimate growth

/**
 * Estimate token cost for Gemini API call
 * @param {number} imageCount - Number of images
 * @param {string} model - Model name
 * @returns {object} Cost estimation
 */
function estimateTokenCost(imageCount, model = 'gemini-2.5-flash') {
  // Gemini pricing (approximate):
  // gemini-2.5-flash: $0.075 per 1M input tokens, $0.30 per 1M output tokens
  // Each image ~258 tokens at 1024x1024
  // Text prompt ~500 tokens
  // Expected output ~1000 tokens

  const IMAGE_TOKENS = 258;
  const PROMPT_TOKENS = 500;
  const OUTPUT_TOKENS = 1000;

  const inputTokens = (imageCount * IMAGE_TOKENS) + PROMPT_TOKENS;
  const outputTokens = OUTPUT_TOKENS;

  // Flash model pricing
  const inputCostPer1M = model.includes('flash') ? 0.075 : 7.50; // Flash vs Pro
  const outputCostPer1M = model.includes('flash') ? 0.30 : 30.00;

  const inputCost = (inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * outputCostPer1M;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost: totalCost,
    currency: 'USD'
  };
}

/**
 * Get user's usage stats from database
 * @param {object} pool - Database pool
 * @param {number} userId - User ID
 * @returns {object} Usage stats
 */
async function getUserUsage(pool, userId) {
  const now = new Date();
  const hourStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const result = await pool.query(
      `SELECT
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as hourly_count,
        COUNT(CASE WHEN created_at >= $2 THEN 1 END) as daily_count,
        COUNT(CASE WHEN created_at >= $3 THEN 1 END) as monthly_count
      FROM listings
      WHERE user_id = $4`,
      [hourStart, todayStart, monthStart, userId]
    );

    return {
      hourlyCount: parseInt(result.rows[0]?.hourly_count || 0),
      dailyCount: parseInt(result.rows[0]?.daily_count || 0),
      monthlyCount: parseInt(result.rows[0]?.monthly_count || 0)
    };
  } catch (error) {
    logger.error('Error fetching user usage:', error);
    // Fail open - allow request but log error
    return { hourlyCount: 0, dailyCount: 0, monthlyCount: 0 };
  }
}

/**
 * Get user's subscription tier
 * @param {object} user - User object from req.user
 * @returns {string} Tier name
 */
function getUserTier(user) {
  // Check if user has active subscription
  if (user.subscription_tier) {
    return user.subscription_tier.toLowerCase();
  }

  // Default to free tier
  return 'free';
}

/**
 * Check if user has exceeded their limits
 * @param {object} usage - User usage stats
 * @param {string} tier - User tier
 * @param {number} imageCount - Number of images in current request
 * @returns {object} { allowed: boolean, reason: string }
 */
function checkLimits(usage, tier, imageCount) {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  // MOST IMPORTANT: Hourly limit catches runaway loops/bugs
  // This should almost NEVER trigger for legitimate users
  if (limits.hourly !== Infinity && usage.hourlyCount >= limits.hourly) {
    return {
      allowed: false,
      reason: `Unusual activity detected: ${usage.hourlyCount} requests in 1 hour. This suggests a potential issue. Please wait a moment and try again.`,
      code: 'ANOMALY_DETECTED'
    };
  }

  // Daily limit - Very high, only blocks extreme usage
  if (limits.daily !== Infinity && usage.dailyCount >= limits.daily) {
    return {
      allowed: false,
      reason: `Daily safety limit reached (${limits.daily} generations). This is unusually high. If you need more, please contact support.`,
      code: 'DAILY_FAILSAFE'
    };
  }

  // Monthly limit - Catches sustained excessive usage
  if (limits.monthly !== Infinity && usage.monthlyCount >= limits.monthly) {
    return {
      allowed: false,
      reason: `Monthly safety limit reached (${limits.monthly} generations). Please contact support to discuss your usage needs.`,
      code: 'MONTHLY_FAILSAFE'
    };
  }

  // Images per request - Reasonable limit
  if (imageCount > limits.maxImagesPerRequest) {
    return {
      allowed: false,
      reason: `Too many images in one request (max ${limits.maxImagesPerRequest}). Try splitting into smaller batches.`,
      code: 'TOO_MANY_IMAGES'
    };
  }

  return { allowed: true };
}

/**
 * Log API usage for monitoring
 * @param {object} data - Usage data to log
 */
async function logApiUsage(pool, data) {
  try {
    await pool.query(
      `INSERT INTO api_usage_logs
       (user_id, endpoint, image_count, estimated_cost, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        data.userId,
        data.endpoint,
        data.imageCount,
        data.estimatedCost,
        data.tokensUsed
      ]
    );
  } catch (error) {
    logger.error('Error logging API usage:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * Middleware to protect Gemini API endpoints
 */
async function protectGeminiAPI(req, res, next) {
  // Emergency kill switch
  if (EMERGENCY_SHUTDOWN) {
    logger.error('EMERGENCY SHUTDOWN: Gemini API disabled');
    return res.status(503).json({
      error: 'Service temporarily unavailable. Please try again later.',
      code: 'EMERGENCY_SHUTDOWN'
    });
  }

  // Check global monthly budget
  if (monthlySpend >= MONTHLY_BUDGET) {
    logger.error(`Monthly budget exceeded: $${monthlySpend.toFixed(2)} / $${MONTHLY_BUDGET}`);
    return res.status(429).json({
      error: 'Monthly API budget exceeded. Service will resume next month.',
      code: 'BUDGET_EXCEEDED'
    });
  }

  // Get user info
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Get image count from request
  const imageCount = req.body.images?.length || 0;
  if (imageCount === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  // Get user tier and usage
  const tier = getUserTier(user);
  const pool = req.app.get('pool'); // Database pool from app
  const usage = await getUserUsage(pool, user.id);

  // Check limits
  const limitCheck = checkLimits(usage, tier, imageCount);
  if (!limitCheck.allowed) {
    logger.warn(`FAILSAFE TRIGGERED - User ${user.id} (${tier}):`, {
      reason: limitCheck.reason,
      code: limitCheck.code,
      usage: usage,
      imageCount
    });
    return res.status(429).json({
      error: limitCheck.reason,
      code: limitCheck.code || 'RATE_LIMIT_EXCEEDED',
      currentUsage: usage,
      limits: TIER_LIMITS[tier]
    });
  }

  // Estimate cost
  const model = process.env.GEMINI_LISTING_MODEL || 'gemini-2.5-flash';
  const costEstimate = estimateTokenCost(imageCount, model);

  // Warn if cost is high
  if (costEstimate.estimatedCost > 0.10) {
    logger.warn(`High cost API call: $${costEstimate.estimatedCost.toFixed(4)} for ${imageCount} images`);
  }

  // Attach data to request for later logging
  req.geminiUsage = {
    tier,
    usage,
    costEstimate,
    imageCount
  };

  // Log before making API call
  await logApiUsage(pool, {
    userId: user.id,
    endpoint: req.path,
    imageCount,
    estimatedCost: costEstimate.estimatedCost,
    tokensUsed: costEstimate.totalTokens
  });

  // Update monthly spend tracker
  monthlySpend += costEstimate.estimatedCost;

  logger.info(`API call approved: User ${user.id} (${tier}), ${imageCount} images, est. $${costEstimate.estimatedCost.toFixed(4)}, monthly spend: $${monthlySpend.toFixed(2)}`);

  next();
}

/**
 * Get current API usage stats (admin endpoint)
 */
async function getUsageStats(pool) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total_calls,
        SUM(image_count) as total_images,
        SUM(estimated_cost) as total_cost,
        SUM(tokens_used) as total_tokens,
        COUNT(DISTINCT user_id) as unique_users
      FROM api_usage_logs
      WHERE created_at >= $1`,
      [monthStart]
    );

    return {
      monthlyStats: result.rows[0],
      monthlySpend,
      monthlyBudget: MONTHLY_BUDGET,
      budgetRemaining: MONTHLY_BUDGET - monthlySpend,
      emergencyShutdown: EMERGENCY_SHUTDOWN
    };
  } catch (error) {
    logger.error('Error fetching usage stats:', error);
    throw error;
  }
}

module.exports = {
  protectGeminiAPI,
  estimateTokenCost,
  getUserUsage,
  getUsageStats,
  TIER_LIMITS
};
