/**
 * Stripe webhook handlers
 *
 * Extracted from server.js - handles Stripe webhook events
 */

/**
 * Create Stripe handlers with dependencies
 * @param {object} deps - { stripe, pool, logger, safeQuery }
 */
function createStripeHandlers({ stripe, pool, logger, safeQuery }) {
  /**
   * Map Stripe price ID to plan type
   */
  function mapPriceIdToPlanType(priceId) {
    const priceMap = {
      [process.env.STRIPE_PRICE_CASUAL]: 'casual',
      [process.env.STRIPE_PRICE_STARTER]: 'starter',
      [process.env.STRIPE_PRICE_PRO]: 'pro',
      [process.env.STRIPE_PRICE_BUSINESS]: 'business',
      [process.env.STRIPE_PRICE_MAX]: 'max',
    };
    return priceMap[priceId] || 'free';
  }

  /**
   * Handle checkout.session.completed webhook
   */
  async function handleCheckoutCompleted(session) {
    try {
      if (!session.metadata || !session.metadata.user_id) {
        logger.error('Missing user_id in checkout session metadata');
        return;
      }

      const userId = parseInt(session.metadata.user_id);
      const planType = session.metadata.plan_type || 'free';
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (!subscriptionId) {
        logger.error('No subscription ID in checkout session');
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (!subscription.items?.data?.length) {
        logger.error('No subscription items found');
        return;
      }

      const priceId = subscription.items.data[0].price.id;

      await pool.query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, plan_type, current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), to_timestamp($8))
         ON CONFLICT (stripe_subscription_id) 
         DO UPDATE SET 
             status = $5,
             plan_type = $6,
             current_period_start = to_timestamp($7),
             current_period_end = to_timestamp($8),
             updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          customerId,
          subscriptionId,
          priceId,
          subscription.status,
          planType,
          subscription.current_period_start,
          subscription.current_period_end,
        ]
      );

      logger.info('Checkout completed', { userId, subscriptionId, planType });
    } catch (error) {
      logger.error('Error in handleCheckoutCompleted:', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle subscription created/updated webhooks
   */
  async function handleSubscriptionUpdate(subscription) {
    try {
      if (!subscription.customer || !subscription.id) {
        logger.error('Missing customer or subscription ID');
        return;
      }

      const customerId = subscription.customer;
      const subscriptionId = subscription.id;

      if (!subscription.items?.data?.length) {
        logger.error('No subscription items found in update');
        return;
      }

      const priceId = subscription.items.data[0].price.id;

      const result = await pool.query(
        'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
        [customerId]
      );

      if (result.rows.length > 0) {
        const planType = mapPriceIdToPlanType(priceId);

        await pool.query(
          `UPDATE subscriptions 
           SET status = $1, 
               plan_type = $2,
               current_period_start = to_timestamp($3),
               current_period_end = to_timestamp($4),
               cancel_at_period_end = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE stripe_subscription_id = $6`,
          [
            subscription.status,
            planType,
            subscription.current_period_start,
            subscription.current_period_end,
            subscription.cancel_at_period_end || false,
            subscriptionId,
          ]
        );

        logger.info('Subscription updated', { subscriptionId, planType });
      } else {
        logger.warn('No subscription found for customer:', { customerId });
      }
    } catch (error) {
      logger.error('Error in handleSubscriptionUpdate:', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle subscription deleted webhook
   */
  async function handleSubscriptionDeleted(subscription) {
    try {
      if (!subscription?.id) {
        logger.error('Missing subscription ID in deletion handler');
        return;
      }

      await safeQuery(
        `UPDATE subscriptions 
         SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );

      logger.info('Subscription deleted', { subscriptionId: subscription.id });
    } catch (error) {
      logger.error('Error in handleSubscriptionDeleted:', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle invoice.payment_succeeded webhook
   */
  async function handlePaymentSucceeded(invoice) {
    try {
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await safeQuery(
          `UPDATE subscriptions SET status = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );
        logger.info('Payment succeeded', { subscriptionId });
      }
    } catch (error) {
      logger.error('Error in handlePaymentSucceeded:', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle invoice.payment_failed webhook
   */
  async function handlePaymentFailed(invoice) {
    try {
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await safeQuery(
          `UPDATE subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );
        logger.info('Payment failed', { subscriptionId });
      }
    } catch (error) {
      logger.error('Error in handlePaymentFailed:', { error: error.message });
      throw error;
    }
  }

  return {
    mapPriceIdToPlanType,
    handleCheckoutCompleted,
    handleSubscriptionUpdate,
    handleSubscriptionDeleted,
    handlePaymentSucceeded,
    handlePaymentFailed,
  };
}

module.exports = { createStripeHandlers };
