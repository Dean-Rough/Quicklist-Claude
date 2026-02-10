/**
 * Configuration routes
 *
 * Public configuration endpoints that don't require authentication.
 * Extracted from server.js lines 390-470.
 */

const express = require('express');
const router = express.Router();

// Configuration values (from environment)
const CLOUDINARY_CLOUD_NAME = 'quicklist';

/**
 * GET /api/config/auth
 * Returns auth configuration for the frontend
 */
router.get('/api/config/auth', (_req, res) => {
  res.json({
    provider: 'clerk',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  });
});

/**
 * GET /api/config/pricing
 * Returns pricing tiers and Stripe price IDs
 */
router.get('/api/config/pricing', (_req, res) => {
  res.json({
    tiers: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        listings: 5,
        features: ['5 listings/month', 'Basic AI generation', 'Standard support'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 4.99,
        listings: 50,
        priceId: process.env.STRIPE_PRO_PRICE_ID,
        features: [
          '50 listings/month',
          'Advanced AI generation',
          'Image enhancement',
          'Priority support',
          'All personality styles',
        ],
      },
      {
        id: 'max',
        name: 'Max',
        price: 9.99,
        listings: -1, // Unlimited
        priceId: process.env.STRIPE_MAX_PRICE_ID,
        features: [
          'Unlimited listings',
          'Premium AI generation',
          'Image enhancement',
          'eBay integration',
          'Priority support',
          'All personality styles',
          'Bulk operations',
        ],
      },
    ],
    currency: 'gbp',
  });
});

/**
 * GET /api/config/cloudinary
 * Returns Cloudinary configuration for frontend uploads
 */
router.get('/api/config/cloudinary', (_req, res) => {
  if (!process.env.CLOUDINARY_API_KEY) {
    return res.status(503).json({ error: 'Cloudinary not configured' });
  }

  res.json({
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'quicklist_unsigned',
  });
});

module.exports = router;
