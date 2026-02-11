/**
 * Stripe routes
 *
 * All Stripe-related endpoints: webhooks, checkout, portal, publishable key
 *
 * Usage in server.js:
 *   const stripeRoutes = require('./routes/stripe');
 *   app.use(stripeRoutes({ stripe, pool, logger, authenticateToken, stripeHandlers }));
 */

const express = require('express');

function createStripeRoutes({ stripe, pool, logger, authenticateToken, stripeHandlers }) {
  const router = express.Router();
  const {
    handleCheckoutCompleted,
    handleSubscriptionUpdate,
    handleSubscriptionDeleted,
    handlePaymentSucceeded,
    handlePaymentFailed,
  } = stripeHandlers;

  /**
   * POST /api/stripe/webhook
   * Stripe webhook endpoint - must use raw body parser
   */
  router.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed:', {
        error: err.message,
        signature: sig ? sig.substring(0, 20) + '...' : 'missing',
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Idempotency check
      if (pool) {
        const existingEvent = await pool
          .query('SELECT id FROM webhook_events WHERE event_id = $1', [event.id])
          .catch(() => ({ rows: [] }));

        if (existingEvent.rows.length > 0) {
          logger.info('Webhook event already processed', { eventId: event.id });
          return res.json({ received: true, duplicate: true });
        }
      }

      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        default:
          logger.info('Unhandled webhook event type:', { eventType: event.type });
      }

      // Record processed event
      if (pool) {
        await pool
          .query(
            'INSERT INTO webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING',
            [event.id, event.type]
          )
          .catch((err) => logger.warn('Failed to record webhook event:', { error: err.message }));
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook handler error:', { error: error.message, eventType: event.type });
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  });

  /**
   * POST /api/stripe/create-checkout-session
   * Create a Stripe checkout session for subscription
   */
  router.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
      }

      const { priceId, planType } = req.body;

      // Validate required fields
      if (!priceId || !planType) {
        return res.status(400).json({ error: 'Price ID and plan type required' });
      }

      if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
        return res.status(400).json({ error: 'Invalid price ID format' });
      }

      const validPlanTypes = ['casual', 'pro', 'max'];
      if (!validPlanTypes.includes(planType)) {
        return res
          .status(400)
          .json({ error: 'Invalid plan type. Must be one of: casual, pro, max' });
      }

      const userId = req.user.id;

      // Get or create Stripe customer
      let customerId;
      const existingSubscription = await pool.query(
        'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      if (existingSubscription.rows.length > 0 && existingSubscription.rows[0].stripe_customer_id) {
        customerId = existingSubscription.rows[0].stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: req.user.email,
          metadata: { user_id: String(userId) },
        });
        customerId = customer.id;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://quicklist.it.com';

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${frontendUrl}/?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/?subscription=canceled`,
        metadata: {
          user_id: String(userId),
          plan_type: planType,
        },
        allow_promotion_codes: true,
      });

      logger.info('Checkout session created', { userId, planType, sessionId: session.id });
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      logger.error('Create checkout session error:', { error: error.message });
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * POST /api/stripe/create-portal-session
   * Create a Stripe billing portal session
   */
  router.post('/api/stripe/create-portal-session', authenticateToken, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
      }

      const userId = req.user.id;

      const subscription = await pool.query(
        'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      if (subscription.rows.length === 0 || !subscription.rows[0].stripe_customer_id) {
        return res.status(400).json({ error: 'No subscription found' });
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://quicklist.it.com';

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.rows[0].stripe_customer_id,
        return_url: frontendUrl,
      });

      logger.info('Portal session created', { userId });
      res.json({ url: session.url });
    } catch (error) {
      logger.error('Create portal session error:', { error: error.message });
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  /**
   * GET /api/stripe/publishable-key
   * Return Stripe publishable key for frontend
   */
  router.get('/api/stripe/publishable-key', (_req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    res.json({ publishableKey });
  });

  return router;
}

module.exports = createStripeRoutes;
