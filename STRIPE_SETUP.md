# Stripe Integration Setup Guide

## Overview

QuickList uses Stripe for subscription payments. This guide will help you set up Stripe with sandbox (test) keys for development.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Stripe Dashboard access

## Step 1: Get Your API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add them to your `.env` file:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

## Step 2: Create Subscription Products

### Casual Plan (£4.99/month)

1. Go to https://dashboard.stripe.com/test/products
2. Click **+ Add product**
3. Fill in:
   - **Name:** Casual Plan
   - **Description:** 50 listings per month with advanced AI descriptions
   - **Pricing model:** Standard pricing
   - **Price:** £4.99
   - **Billing period:** Monthly
   - **Recurring:** Yes
4. Click **Save product**
5. Copy the **Price ID** (starts with `price_`) and add to `.env`:
   ```
   STRIPE_PRICE_CASUAL=price_xxxxx
   ```

### Pro Plan (£9.99/month)

1. Create another product with:
   - **Name:** Pro Plan
   - **Description:** 200 listings per month with premium features
   - **Price:** £9.99
   - **Billing period:** Monthly
2. Copy the **Price ID** and add to `.env`:
   ```
   STRIPE_PRICE_PRO=price_xxxxx
   ```

### Max Plan (£19.99/month)

1. Create another product with:
   - **Name:** Max Plan
   - **Description:** Unlimited listings with all features
   - **Price:** £19.99
   - **Billing period:** Monthly
2. Copy the **Price ID** and add to `.env`:
   ```
   STRIPE_PRICE_MAX=price_xxxxx
   ```

## Step 3: Set Up Webhooks (Optional for now)

Webhooks allow Stripe to notify your app about subscription events (payments, cancellations, etc.).

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **+ Add endpoint**
3. Enter your endpoint URL:
   - Local: `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
   - Production: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`) and add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Step 4: Update Price IDs in Code

The frontend needs to know the price IDs. They're already configured in `index.html`:

- Line 2920: Casual plan button uses `price_casual`
- Line 2934: Pro plan button uses `price_pro`
- Line 2948: Max plan button uses `price_max`

These match the placeholder values. When you create products in Stripe, the actual price IDs will be passed to the backend, which reads them from environment variables.

## Step 5: Test the Integration

1. Restart your server (if running)
2. Navigate to the pricing page
3. Click on a plan (e.g., "Choose Pro")
4. If not signed in, you'll be prompted to sign in
5. After sign in, you'll be redirected to Stripe Checkout
6. Use a test card:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date
   - **CVC:** Any 3 digits
   - **ZIP:** Any 5 digits
7. Complete checkout
8. You'll be redirected back to your app

## Step 6: Verify Subscription

1. Go to Settings/Dashboard in your app
2. You should see:
   - Current Plan: Pro (or whichever you chose)
   - Status: Active
   - Renewal date
3. Check Stripe Dashboard:
   - Go to https://dashboard.stripe.com/test/subscriptions
   - You should see the new subscription

## Testing Payment Scenarios

Stripe provides test cards for different scenarios:

| Card Number         | Scenario                |
| ------------------- | ----------------------- |
| 4242 4242 4242 4242 | Success                 |
| 4000 0000 0000 0002 | Card declined           |
| 4000 0025 0000 3155 | Requires authentication |

## Managing Subscriptions

Users can manage their subscriptions through the Stripe Customer Portal:

1. Go to Settings in your app
2. Click **Manage Billing**
3. They'll be redirected to Stripe's portal where they can:
   - Update payment method
   - Cancel subscription
   - View invoices

## Production Checklist

Before going live:

- [ ] Replace test keys with live keys (remove `_test_` from keys)
- [ ] Create products in **live mode** (not test mode)
- [ ] Update webhook endpoint to production URL
- [ ] Test with real card (small amount)
- [ ] Set up proper error monitoring
- [ ] Configure email notifications in Stripe Dashboard

## Troubleshooting

### "Stripe not configured" error

- Check that `STRIPE_SECRET_KEY` is set in `.env`
- Restart your server after adding environment variables

### Checkout session fails to create

- Verify price IDs match those in Stripe Dashboard
- Check server logs for detailed error messages
- Ensure user is authenticated

### Webhook events not received

- Use `ngrok` or similar to expose localhost to internet
- Verify webhook secret matches Stripe Dashboard
- Check Stripe Dashboard > Webhooks > Endpoint details for delivery attempts

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Test Mode: https://stripe.com/docs/testing
- API Reference: https://stripe.com/docs/api
