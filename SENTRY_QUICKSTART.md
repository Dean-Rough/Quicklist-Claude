# Sentry Quick Start - TL;DR

Quick reference for setting up Sentry error tracking on Quicklist-Claude.

## Installation Status

- **@sentry/node**: v10.25.0 (installed)
- **@sentry/browser**: v10.25.0 (loaded via CDN in index.html)

## 5-Minute Setup

### 1. Get Your Sentry DSNs

```bash
# Visit: https://sentry.io
# Sign up (free)
# Create 2 projects:
#   - "quicklist-backend" (Node.js platform)
#   - "quicklist-frontend" (Browser JavaScript platform)
# Copy both DSNs
```

### 2. Local Development

Add to your `.env` file:

```env
SENTRY_DSN=https://your_backend_dsn@o123456.ingest.sentry.io/7890123
SENTRY_ENVIRONMENT=development
```

Edit `index.html` line 106:

```javascript
const SENTRY_DSN_FRONTEND = 'https://your_frontend_dsn@o123456.ingest.sentry.io/7890124';
```

### 3. Production (Vercel)

Add environment variables in Vercel dashboard:

- `SENTRY_DSN` = your backend DSN
- `SENTRY_ENVIRONMENT` = production

Update `index.html` line 106 with your frontend DSN and commit.

### 4. Test It

**Backend:**

```bash
npm run dev
# Should see: "Sentry error tracking initialized"
```

**Frontend:**

```javascript
// In browser console:
throw new Error('Test error');
// Check Sentry dashboard
```

## What's Tracked

### Backend (Automatic)

- Unhandled errors in routes
- Promise rejections
- Uncaught exceptions
- Request context (method, path, user)

### Frontend (Automatic)

- JavaScript errors
- Promise rejections
- Session replays on errors (10% random, 100% with errors)

## Files Modified

1. `.env.example` - Added Sentry config docs
2. `server.js` - Added initialization (lines 22-44) and error handlers (lines 3771-3813)
3. `index.html` - Added browser SDK (lines 98-131)
4. `package.json` - Added Sentry dependencies

## Configuration

**Current settings:**

Backend:

- 10% trace sampling in production
- 100% trace sampling in development
- No errors sent from development (unless `SENTRY_FORCE_SEND=true`)

Frontend:

- 10% session replay sampling
- 100% replay on errors
- No errors sent from localhost (unless `window.SENTRY_FORCE_SEND=true`)

## Manual Error Capture

**Backend:**

```javascript
const Sentry = require('@sentry/node');
try {
  // risky code
} catch (error) {
  Sentry.captureException(error);
}
```

**Frontend:**

```javascript
try {
  // risky code
} catch (error) {
  Sentry.captureException(error);
}
```

## Free Tier Limits

- 5,000 errors/month
- 10,000 performance transactions/month
- 50 replay sessions/month

Should be plenty for development and small to medium production use.

## More Details

See `SENTRY_SETUP.md` for comprehensive documentation.

## Support

- Docs: https://docs.sentry.io
- Node.js: https://docs.sentry.io/platforms/node/
- Browser: https://docs.sentry.io/platforms/javascript/
