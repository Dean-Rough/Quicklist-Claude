# Sentry Error Tracking Setup Guide

This guide explains how to set up Sentry error tracking for the Quicklist-Claude project.

## Overview

Sentry provides real-time error tracking and monitoring for both the backend (Node.js/Express) and frontend (browser JavaScript). This helps you:

- Track and debug production errors
- Monitor application performance
- Get alerts when errors occur
- Replay user sessions when errors happen
- Understand error trends and impact

## What Was Installed

The following Sentry packages have been installed:

- `@sentry/node` (v8.44.0) - Backend error tracking
- `@sentry/browser` (v8.44.0) - Frontend error tracking (loaded via CDN)

## Files Modified

### 1. `/Users/deannewton/Projects/QLC/Quicklist-Claude/.env.example`

Added Sentry environment variable documentation:

```env
# ========================================
# OPTIONAL: Error Tracking (Sentry)
# ========================================
# Get from: https://sentry.io
# 1. Sign up for free at https://sentry.io
# 2. Create a new project and select "Node.js" for backend
# 3. Create another project and select "JavaScript" for frontend
# 4. Copy the DSN from each project's settings
# Format: https://public_key@o123456.ingest.sentry.io/project_id
# SENTRY_DSN=https://your_sentry_dsn_here
# SENTRY_ENVIRONMENT=production
```

### 2. `/Users/deannewton/Projects/QLC/Quicklist-Claude/server.js`

Added Sentry initialization and error handling:

**Location: Lines 22-44** - Sentry initialization

- Loads after environment variables
- Only initializes if `SENTRY_DSN` is configured
- Sets environment (production/development)
- Configures 10% trace sampling in production, 100% in development
- Auto-discovers performance monitoring integrations
- Prevents sending errors in development (unless `SENTRY_FORCE_SEND=true`)

**Location: Lines 3771-3813** - Error handling middleware

- Request handler for capturing request context
- Tracing handler for performance monitoring
- Error handler middleware
- Global error handler for unhandled route errors
- Unhandled promise rejection handler
- Uncaught exception handler

### 3. `/Users/deannewton/Projects/QLC/Quicklist-Claude/index.html`

Added Sentry browser SDK:

**Location: Lines 98-131** - Sentry browser initialization

- Loads Sentry SDK from CDN with integrity check
- Only initializes if `SENTRY_DSN_FRONTEND` is set
- Detects production vs development based on hostname
- Configures session replay for debugging
- Prevents sending errors from localhost (unless `SENTRY_FORCE_SEND=true`)

## Setup Instructions

### Step 1: Create a Free Sentry Account

1. Go to https://sentry.io
2. Click "Get Started" or "Sign Up"
3. Create an account (free tier includes 5,000 errors/month)

### Step 2: Create Backend Project (Node.js)

1. After signing in, click "Create Project"
2. Select platform: **Node.js**
3. Set Alert frequency: Choose your preference
4. Name your project: `quicklist-backend` (or similar)
5. Click "Create Project"
6. You'll see a DSN that looks like:
   ```
   https://abc123def456@o123456.ingest.sentry.io/7890123
   ```
7. Copy this DSN - you'll need it for the backend

### Step 3: Create Frontend Project (JavaScript)

1. Click "Projects" in the left sidebar
2. Click "Create Project" again
3. Select platform: **Browser JavaScript**
4. Name your project: `quicklist-frontend` (or similar)
5. Click "Create Project"
6. Copy the DSN - you'll need it for the frontend

### Step 4: Configure Local Development

Create or update your `.env` file:

```bash
# Copy .env.example if you don't have a .env file
cp .env.example .env
```

Edit `.env` and add:

```env
# Backend Sentry DSN (from Step 2)
SENTRY_DSN=https://your_backend_dsn@o123456.ingest.sentry.io/7890123

# Environment (development or production)
SENTRY_ENVIRONMENT=development

# Optional: Force sending errors in development
# SENTRY_FORCE_SEND=true
```

### Step 5: Configure Frontend DSN

Edit `/Users/deannewton/Projects/QLC/Quicklist-Claude/index.html` around line 106:

```javascript
// Replace this line:
const SENTRY_DSN_FRONTEND = '';

// With your frontend DSN:
const SENTRY_DSN_FRONTEND = 'https://your_frontend_dsn@o123456.ingest.sentry.io/7890124';
```

Alternatively, you can set this dynamically from environment variables during build time if you implement a build process.

### Step 6: Configure Production (Vercel)

1. Go to your Vercel dashboard: https://vercel.com
2. Select your project
3. Go to Settings > Environment Variables
4. Add the following variables:

| Name                 | Value                          | Environments        |
| -------------------- | ------------------------------ | ------------------- |
| `SENTRY_DSN`         | `https://your_backend_dsn@...` | Production, Preview |
| `SENTRY_ENVIRONMENT` | `production`                   | Production          |
| `SENTRY_ENVIRONMENT` | `preview`                      | Preview             |

5. For the frontend DSN, you have two options:

   **Option A: Inline in HTML (simpler)**
   - Edit index.html line 106 to include your frontend DSN
   - Commit and deploy

   **Option B: Build-time replacement (more secure)**
   - Add a build script that replaces the DSN from environment variables
   - Add `SENTRY_DSN_FRONTEND` to Vercel environment variables
   - Use a tool like `envsubst` or custom Node script in your build process

### Step 7: Test Error Tracking

**Backend Test:**

1. Start your server: `npm run dev`
2. You should see in logs:
   ```
   Sentry error tracking initialized
   ```
3. Test by adding a route that throws an error:
   ```javascript
   app.get('/api/test-error', (req, res) => {
     throw new Error('Test error for Sentry');
   });
   ```
4. Visit: `http://localhost:4577/api/test-error`
5. Check Sentry dashboard - error should appear

**Frontend Test:**

1. Open browser console
2. You should see:
   ```
   Sentry frontend error tracking initialized
   ```
   (or "Sentry DSN not configured" if not set)
3. Test by throwing an error in console:
   ```javascript
   throw new Error('Test frontend error');
   ```
4. Check Sentry dashboard - error should appear

## How Errors Are Tracked

### Backend Error Tracking

1. **Automatic Capture:**
   - All unhandled route errors
   - Unhandled promise rejections
   - Uncaught exceptions
   - Express middleware errors

2. **Manual Capture:**

   ```javascript
   try {
     // Your code
   } catch (error) {
     Sentry.captureException(error);
     // Handle error
   }
   ```

3. **Context Added:**
   - Request ID (X-Request-ID header)
   - HTTP method and path
   - User information (if authenticated)
   - Server environment
   - Stack traces

### Frontend Error Tracking

1. **Automatic Capture:**
   - Unhandled JavaScript errors
   - Promise rejections
   - Network errors (optional)

2. **Manual Capture:**

   ```javascript
   try {
     // Your code
   } catch (error) {
     Sentry.captureException(error);
   }
   ```

3. **Session Replay:**
   - Records 10% of sessions automatically
   - Records 100% of sessions with errors
   - Helps understand what users did before error occurred

### Performance Monitoring

**Backend:**

- Tracks HTTP request duration
- Database query performance
- External API calls
- Samples 10% of transactions in production

**Frontend:**

- Page load times
- API call performance
- User interactions
- Samples 10% of transactions in production

## Sentry Dashboard Features

Once set up, you can:

1. **View Errors:**
   - See all errors in real-time
   - Group similar errors together
   - See frequency and user impact

2. **Debug Issues:**
   - View full stack traces
   - See request context
   - Replay user sessions (frontend)
   - See breadcrumb trail leading to error

3. **Set Alerts:**
   - Email notifications
   - Slack integration
   - PagerDuty integration
   - Custom alert rules

4. **Release Tracking:**
   - Track errors by release version
   - See if new deploys introduce errors
   - Monitor error trends over time

## Cost and Limits

**Free Tier:**

- 5,000 errors per month
- 10,000 performance transactions per month
- 50 replay sessions per month
- 1 project
- 1 team member

**Paid Tiers:**
Start at $26/month for:

- 50,000 errors per month
- 100,000 transactions per month
- Unlimited replays
- Multiple projects
- More team members

Most small to medium projects will be fine on the free tier.

## Security Notes

1. **DSN is Public:**
   - The DSN can be public (it's in frontend code)
   - It only allows sending errors TO Sentry
   - Cannot be used to read data FROM Sentry

2. **Sensitive Data:**
   - Sentry automatically scrubs common PII (passwords, credit cards)
   - Configure additional scrubbing in Sentry dashboard
   - Use `beforeSend` hook to filter sensitive data

3. **Environment Separation:**
   - Use different Sentry projects for dev/staging/production
   - Set appropriate environment labels
   - Filter development errors to avoid noise

## Troubleshooting

**Errors not appearing in Sentry:**

1. Check DSN is configured correctly
2. Check `SENTRY_DSN` environment variable is set
3. Look for "Sentry error tracking initialized" in logs
4. In development, set `SENTRY_FORCE_SEND=true` to bypass local filtering
5. Check Sentry dashboard project settings

**Too many errors:**

1. Set up error filtering rules in Sentry dashboard
2. Adjust `beforeSend` hook to filter unwanted errors
3. Use `ignoreErrors` config option
4. Increase rate limiting

**Performance overhead:**

1. Reduce `tracesSampleRate` (currently 10% in production)
2. Reduce `replaysSessionSampleRate` (currently 10%)
3. Disable session replay in production if not needed

## Additional Resources

- Sentry Documentation: https://docs.sentry.io
- Node.js Guide: https://docs.sentry.io/platforms/node/
- Browser Guide: https://docs.sentry.io/platforms/javascript/
- Express Integration: https://docs.sentry.io/platforms/javascript/guides/express/
- Best Practices: https://docs.sentry.io/product/best-practices/

## Next Steps

After setting up Sentry:

1. Configure release tracking (tag deployments with version numbers)
2. Set up Slack or email alerts for critical errors
3. Create custom dashboards for your team
4. Configure source maps for better stack traces (if using build tools)
5. Set up performance budgets and alerts
6. Integrate with your CI/CD pipeline

---

For questions or issues with this setup, refer to the Sentry documentation or contact the development team.
