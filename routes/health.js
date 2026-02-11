/**
 * Health check routes
 *
 * Extracted from server.js as an example of route modularization.
 * To use: require and mount in server.js
 *
 * Example:
 *   const healthRoutes = require('./routes/health');
 *   app.use(healthRoutes);
 */

const express = require('express');
const router = express.Router();

// Import dependencies that would be passed from server.js
// In a full refactor, these would come from a shared config/db module
let pool = null;
let logger = console;

/**
 * Initialize the route with required dependencies
 * @param {object} deps - { pool, logger }
 */
function init(deps) {
  pool = deps.pool;
  logger = deps.logger || console;
  return router;
}

/**
 * GET /api/ping
 * Simple health ping
 */
router.get('/api/ping', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health
 * Comprehensive health check
 */
router.get('/api/health', async (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      gemini: 'configured',
      stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
      cloudinary: process.env.CLOUDINARY_API_KEY ? 'configured' : 'not_configured',
      clerk: process.env.CLERK_SECRET_KEY ? 'configured' : 'not_configured',
    },
    version: require('../package.json').version || '1.0.0',
  };

  // Database check
  try {
    if (pool) {
      const result = await pool.query('SELECT NOW()');
      health.checks.database = result.rows[0] ? 'connected' : 'error';
    } else {
      health.checks.database = 'not_configured';
    }
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
    logger.error('Health check - database error:', error.message);
  }

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = init;
module.exports.router = router;
