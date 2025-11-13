// Dedicated health check endpoint for Vercel
// This provides a lightweight health check without loading the full Express app

const { Pool } = require('pg');

module.exports = async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
            stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured'
        }
    };

    // Check database if DATABASE_URL is configured
    if (process.env.DATABASE_URL) {
        try {
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 2000
            });
            await pool.query('SELECT NOW()');
            await pool.end();
            health.services.database = 'ok';
        } catch (error) {
            health.services.database = 'error';
            health.status = 'degraded';
        }
    } else {
        health.services.database = 'not configured';
        health.status = 'degraded';
    }

    const allHealthy = Object.values(health.services).every(s => s === 'ok' || s === 'configured');
    res.status(allHealthy ? 200 : 503).json(health);
};

