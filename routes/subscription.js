/**
 * Subscription routes
 *
 * User subscription status and usage tracking
 *
 * Usage in server.js:
 *   const subscriptionRoutes = require('./routes/subscription');
 *   app.use(subscriptionRoutes({ pool, logger, authenticateToken, safeQuery }));
 */

const express = require('express');

function createSubscriptionRoutes({ pool, logger, authenticateToken, safeQuery }) {
  const router = express.Router();

  /**
   * GET /api/subscription/status
   * Get user's subscription status with usage info
   */
  router.get('/api/subscription/status', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user info
      const userResult = await pool.query(
        'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get subscription
      const subResult = await pool.query(
        `SELECT plan_type, status, current_period_end, cancel_at_period_end
         FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      // Get usage
      const usageResult = await pool.query(
        `SELECT listings_created, ai_generations, period_start, period_end
         FROM usage_tracking 
         WHERE user_id = $1 AND period_start <= CURRENT_DATE AND period_end > CURRENT_DATE`,
        [userId]
      );

      // Plan limits
      const planLimits = {
        free: { listings: 5, aiGenerations: 10 },
        casual: { listings: 50, aiGenerations: 100 },
        pro: { listings: 200, aiGenerations: 500 },
        max: { listings: -1, aiGenerations: -1 }, // unlimited
      };

      const subscription = subResult.rows[0] || { plan_type: 'free', status: 'active' };
      const usage = usageResult.rows[0] || { listings_created: 0, ai_generations: 0 };
      const limits = planLimits[subscription.plan_type] || planLimits.free;

      res.json({
        user: userResult.rows[0],
        subscription: {
          planType: subscription.plan_type || 'free',
          status: subscription.status || 'active',
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        },
        usage: {
          listingsCreated: usage.listings_created || 0,
          aiGenerations: usage.ai_generations || 0,
          periodStart: usage.period_start,
          periodEnd: usage.period_end,
        },
        limits: {
          listings: limits.listings,
          aiGenerations: limits.aiGenerations,
        },
        canCreateListing: limits.listings === -1 || (usage.listings_created || 0) < limits.listings,
        canGenerate:
          limits.aiGenerations === -1 || (usage.ai_generations || 0) < limits.aiGenerations,
      });
    } catch (error) {
      logger.error('Get subscription status error:', { error: error.message });
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  });

  /**
   * GET /api/usage
   * Get usage metrics for current billing period
   */
  router.get('/api/usage', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await safeQuery(
        `SELECT listings_created, ai_generations, period_start, period_end
         FROM usage_tracking 
         WHERE user_id = $1 AND period_start <= CURRENT_DATE AND period_end > CURRENT_DATE`,
        [userId]
      );

      const usage = result.rows[0] || {
        listings_created: 0,
        ai_generations: 0,
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
      };

      res.json({ usage });
    } catch (error) {
      logger.error('Get usage error:', { error: error.message });
      res.status(500).json({ error: 'Failed to get usage' });
    }
  });

  /**
   * GET /api/dashboard/metrics
   * Get dashboard metrics for user
   */
  router.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;

      // Get listing stats
      const listingsResult = await safeQuery(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'active') as active,
           COUNT(*) FILTER (WHERE status = 'sold') as sold,
           COUNT(*) FILTER (WHERE status = 'draft') as draft
         FROM listings WHERE user_id = $1`,
        [userId]
      );

      // Get recent activity
      const activityResult = await safeQuery(
        `SELECT id, title, status, created_at, updated_at
         FROM listings WHERE user_id = $1
         ORDER BY updated_at DESC LIMIT 5`,
        [userId]
      );

      // Get usage
      const usageResult = await safeQuery(
        `SELECT listings_created, ai_generations
         FROM usage_tracking 
         WHERE user_id = $1 AND period_start <= CURRENT_DATE AND period_end > CURRENT_DATE`,
        [userId]
      );

      const stats = listingsResult.rows[0];
      const usage = usageResult.rows[0] || { listings_created: 0, ai_generations: 0 };

      res.json({
        listings: {
          total: parseInt(stats.total) || 0,
          active: parseInt(stats.active) || 0,
          sold: parseInt(stats.sold) || 0,
          draft: parseInt(stats.draft) || 0,
        },
        usage: {
          listingsCreated: usage.listings_created || 0,
          aiGenerations: usage.ai_generations || 0,
        },
        recentActivity: activityResult.rows,
      });
    } catch (error) {
      logger.error('Get dashboard metrics error:', { error: error.message });
      res.status(500).json({ error: 'Failed to get dashboard metrics' });
    }
  });

  return router;
}

module.exports = createSubscriptionRoutes;
