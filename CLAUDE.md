# CLAUDE.md

> **Authentication note:** QuickList now uses Clerk exclusively. Any references to legacy JWT or Neon Auth flows in this guide are outdated and should not be reintroduced.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuickList AI is an AI-powered listing generator for online marketplaces (eBay, Vinted, Gumtree). Users upload product photos and the app generates complete listings using Google Gemini Vision API, with automated market research, pricing intelligence, and optional eBay integration.

**Key Architecture Decision**: Single-file frontend ([index.html](index.html) - ~5600 lines) with no build process. All HTML, CSS, and JavaScript are in one file for simplicity and zero build complexity.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Initialize database (one-time setup, or after schema changes)
# Start server first, then visit: http://localhost:4577/api/init-db
# In production: requires ALLOW_DB_INIT=true environment variable
```

**Port Configuration**: Default port is 3000, but check your `.env` or `.env.local` for `PORT` variable. The existing setup uses port 4577.

## Tech Stack

- **Frontend**: Vanilla JavaScript (no framework), single HTML file with embedded CSS and JS
- **Backend**: Express.js (~2800 lines in [server.js](server.js))
- **Database**: PostgreSQL (Neon - serverless/cloud-hosted recommended)
- **Authentication**:
  - Primary: Clerk (recommended, configured via CLERK_SECRET_KEY)
  - Fallback: JWT tokens with bcryptjs (legacy)
  - OAuth: Google OAuth 2.0 (optional)
- **AI**: Google Gemini Vision API (`gemini-2.0-flash-exp` model)
- **Payments**: Stripe (optional, for subscription tiers)
- **Marketplace Integration**: eBay API (optional)

## Architecture

### Frontend Structure ([index.html](index.html))

The entire frontend is in one file:

- **Lines ~1-10**: HTML structure and meta tags
- **Lines ~10-880**: Embedded CSS (dark mode with indigo accents)
- **Lines ~880-1480**: Marketing pages HTML
- **Lines ~1480-end**: JavaScript application logic in global `app` object

**State Management**: Centralized in `app.state` object:

```javascript
app.state = {
  isAuthenticated: false,
  user: null,
  token: null,
  currentView: 'home', // Marketing page navigation
  currentAppView: 'newItem', // App navigation
  uploadedImages: [],
  currentListing: null,
  savedListings: [],
  settings: { autoDownloadZip: false },
};
```

### Backend Structure ([server.js](server.js))

**Main Components**:

1. **Authentication Routes** (~lines 200-400)
   - `/api/auth/signup`, `/api/auth/signin`, `/api/auth/verify`
   - `/api/auth/google/url`, `/api/auth/google/callback` (OAuth)
   - Clerk integration for modern auth

2. **Listing CRUD** (~lines 400-800)
   - `/api/listings` (GET/POST), `/api/listings/:id` (GET/PUT/DELETE)
   - Includes image handling with base64 storage

3. **AI Generation** (~lines 800-1200)
   - `/api/generate` - Core AI listing generation
   - Sends images to Gemini Vision with platform-specific prompts
   - Returns title, brand, category, description, pricing, keywords, sources

4. **Subscription/Usage** (~lines 1200-1500)
   - `/api/subscription/status`, `/api/usage`
   - Stripe integration for paid plans

5. **eBay Integration** (~lines 1500-2000)
   - `/api/listings/:id/post-to-ebay`
   - OAuth authentication flow
   - Pricing intelligence from eBay market data

6. **Utilities**
   - `/api/health` - Health check with service status
   - `/api/init-db` - Database initialization

**Middleware Stack**:

- Helmet.js for security headers
- CORS with whitelist
- Rate limiting (auth: 5/15min, generate: 10/min)
- Compression
- JWT/Clerk authentication
- Request ID tracking

### Database Schema ([schema.sql](schema.sql))

**Three main tables**:

1. **users**
   - `id`, `email`, `password_hash` (nullable for OAuth)
   - `google_id`, `auth_provider` ('email' or 'google')
   - `ebay_auth_token` (per-user eBay OAuth token)
   - Timestamps

2. **listings**
   - `user_id` (FK to users)
   - `title`, `brand`, `category`, `description`, `condition`
   - `rrp`, `price` (stored as strings with currency)
   - `keywords` (TEXT[] - PostgreSQL array)
   - `sources` (JSONB - research source URLs)
   - `platform` (ebay/vinted/gumtree)
   - `ebay_item_id`, `pricing_data` (JSONB), `posted_to_ebay`
   - Timestamps with auto-update trigger

3. **images**
   - `listing_id` (FK to listings)
   - `image_data` (TEXT - base64 encoded)
   - `image_order`, `is_blurry`
   - Timestamp

**Important Schema Notes**:

- Cascade deletes: user → listings → images
- Keywords use PostgreSQL array type (`TEXT[]`)
- Sources and pricing_data use JSONB for flexible structure
- Images stored as base64 strings (no filesystem/blob storage)

## Key Workflows

### AI Generation Flow

1. User uploads images → base64 encoded → stored in `app.state.uploadedImages[]`
2. User selects platform (eBay/Vinted/Gumtree) and adds optional hint
3. Frontend calls `app.generateListing()` → POST `/api/generate`
4. Backend constructs Gemini prompt with:
   - Platform-specific requirements (eBay needs category ID, pricing data)
   - Image data (up to 10 images)
   - User hint
   - Instructions to research online and provide sources
5. Gemini analyzes images and returns structured JSON:
   ```json
   {
     "title": "...",
     "brand": "...",
     "category": "...",
     "description": "...",
     "condition": "...",
     "rrp": "£120",
     "price": "£80",
     "keywords": ["..."],
     "sources": [{ "url": "...", "title": "..." }]
   }
   ```
6. Frontend displays in editable form fields
7. User can edit, save to DB, or download as ZIP

### eBay Integration Flow

1. User requests to post listing to eBay
2. If no `ebay_auth_token`: redirect to eBay OAuth flow
3. Backend calls eBay Finding API for pricing intelligence
4. Backend constructs eBay listing XML
5. Posts via eBay Trading API
6. Stores `ebay_item_id` and marks `posted_to_ebay = true`

### Subscription/Usage Tracking

- Free tier: 5 AI generations/month
- Paid tiers: 50, 200, or 1000/month
- Usage tracked in database, enforced in `/api/generate`
- Stripe webhooks update subscription status

## Environment Variables

**Required**:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_secure_random_secret  # 32+ chars in production
PORT=3000  # or 4577
NODE_ENV=development  # or production
FRONTEND_URL=http://localhost:4577  # or production URL
```

**Optional (Authentication)**:

```env
# Clerk (recommended)
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# Google OAuth (legacy)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4577/auth/google/callback
```

**Optional (Payments)**:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
```

**Optional (eBay)**:

```env
EBAY_APP_ID=...
EBAY_DEV_ID=...
EBAY_CERT_ID=...
EBAY_SITE_ID=3  # UK
EBAY_SANDBOX=false  # true for testing
```

**Optional (Other)**:

```env
IMGUR_CLIENT_ID=...  # For image hosting
LOG_LEVEL=info  # debug, info, warn, error
ALLOW_DB_INIT=true  # Allow /api/init-db in production (dangerous)
```

## File Editing Guidelines

### Editing [index.html](index.html)

**CSS Section**:

- CSS custom properties defined in `:root` selector
- Dark mode: `--bg-primary: #0f0f23`, `--indigo-500: #6366f1`
- Responsive breakpoints: `@media (max-width: 768px)`

**JavaScript Section**:

- All code in global `app` object to avoid namespace pollution
- Async/await used throughout
- Key methods:
  - `init()`: Initialize on DOMContentLoaded
  - `generateListing()`: Main AI generation
  - `saveListing()`, `loadListing()`, `deleteListing()`: CRUD
  - `updateUI()`: Toggle marketing/app views based on auth
  - `displayListing()`: Populate form from listing data
  - `downloadZip()`: Generate ZIP with JSZip library

**Adding Features**:

- Add CSS in `<style>` block (keep dark mode theme)
- Add HTML in appropriate section (marketing vs app)
- Add JS methods to `app` object
- Follow patterns: async/await, centralized state

### Editing [server.js](server.js)

**Database Queries**:

- Always use parameterized queries: `$1, $2, ...`
- For arrays: `$1::text[]` for keyword arrays
- For JSONB: `$1::jsonb` for sources/pricing_data

**Protected Routes**:

- Add `authenticateToken` or `requireAuth` (Clerk) middleware
- Check user ownership: `listing.user_id === req.user.id`

**Error Handling**:

- Return appropriate HTTP codes (400, 401, 404, 500)
- Use `logger.error()` for server logs
- Include `X-Request-ID` header for tracking

**Rate Limiting**:

- Auth endpoints: `authLimiter` (5 req/15min)
- Generate endpoint: `generateLimiter` (10 req/min)

### Editing [schema.sql](schema.sql)

**Making Changes**:

1. Edit [schema.sql](schema.sql)
2. For development: visit `/api/init-db` to drop and recreate tables
3. For production: write migration SQL in separate file
4. Remember to update indexes for new columns

**Important**: `/api/init-db` drops all tables and data. Use only in development or with `ALLOW_DB_INIT=true` in production (dangerous).

## Deployment (Vercel)

The app is configured for Vercel serverless deployment via [vercel.json](vercel.json):

1. Static frontend served from root
2. API routes handled by serverless functions:
   - `/api/health` → [api/health.js](api/health.js)
   - `/api/*` → [api/server.js](api/server.js) (wrapper around [server.js](server.js))

**Deployment Steps**:

```bash
# Via CLI
vercel

# Via GitHub
# Push to main branch, Vercel auto-deploys
```

**Environment Variables**: Set in Vercel dashboard (see "Environment Variables" section above)

**Database**: Use Neon PostgreSQL or any PostgreSQL with SSL

See [DEPLOYMENT.md](DEPLOYMENT.md) and [README_PRODUCTION.md](README_PRODUCTION.md) for full deployment guide.

## Testing

**No automated test suite** - manual testing only.

**Manual Test Flow**:

1. Start server: `npm run dev`
2. Test auth: sign up → verify token stored in localStorage
3. Test generation: upload image → select platform → generate → verify all fields populated
4. Test save: save listing → check DB → reload from saved items
5. Test ZIP download: download → verify files included
6. Test eBay: authorize → post listing → verify item ID returned

**E2E Test Script**: [e2e_test.sh](e2e_test.sh) - Bash script for API endpoint testing

## Common Issues and Solutions

### Port Mismatch

**Problem**: Frontend can't reach backend
**Solution**: Ensure `app.apiUrl` in [index.html](index.html) matches `PORT` in `.env`. Currently hardcoded to `http://localhost:3000` but should match actual port (e.g., 4577).

### Database Connection

**Problem**: "Database connection error"
**Solution**:

- Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/db?sslmode=require`
- Verify Neon database is accessible
- Check SSL configuration (`ssl: { rejectUnauthorized: false }`)

### JWT Issues

**Problem**: "Invalid token" or "Token expired"
**Solution**:

- Clear localStorage: `localStorage.removeItem('quicklist-token')`
- Verify `JWT_SECRET` is set and matches
- JWT expires after 7 days - users must re-login

### Image Size Limits

**Problem**: "Request entity too large"
**Solution**: Images stored as base64, which inflates size by ~33%. Server has 50MB JSON body limit. Compress images before upload or implement server-side compression.

### PostgreSQL Arrays

**Problem**: Error inserting keywords
**Solution**: Use `ARRAY['keyword1', 'keyword2']` in SQL or parameterized `$1::text[]` with array parameter.

### eBay Authorization

**Problem**: eBay posting fails
**Solution**:

- Check `EBAY_APP_ID`, `EBAY_DEV_ID`, `EBAY_CERT_ID` are set
- Verify eBay app is approved for production (not sandbox)
- Check `ebay_auth_token` is stored for user

## Architecture Decisions and Rationale

### Single-File Frontend

**Why**: Simplicity, zero build complexity, instant changes on refresh. Suitable for prototype/MVP.
**Trade-off**: Large file size, harder to maintain as complexity grows.
**Future**: Consider splitting into separate HTML/CSS/JS files with bundler.

### Base64 Image Storage

**Why**: Simple, no filesystem/blob storage needed, works with any database.
**Trade-off**: Large database size, 33% overhead, slower queries.
**Future**: Migrate to S3/Cloudinary with URL references.

### JWT + Clerk Hybrid Auth

**Why**: Clerk provides modern auth (OAuth, MFA, user management) with easy migration from JWT.
**Trade-off**: Dual auth code paths during migration.
**Future**: Fully migrate to Clerk, remove JWT code.

### Google Gemini Vision

**Why**: Strong image recognition, free tier, JSON output mode.
**Trade-off**: Vendor lock-in, rate limits.
**Alternative**: OpenAI GPT-4 Vision, Anthropic Claude Vision.

## Security Notes

**Implemented**:

- Password hashing with bcryptjs (10 rounds)
- JWT with 7-day expiration
- Parameterized SQL queries (SQL injection protection)
- Helmet.js security headers
- CORS whitelist
- Rate limiting on auth and generation endpoints
- Input sanitization with sanitize-html

**Before Production**:

- [ ] Generate new `JWT_SECRET` (32+ chars): `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Restrict `/api/init-db` endpoint (remove or require admin auth)
- [ ] Review CORS origins (currently allows multiple)
- [ ] Enable Vercel DDoS protection
- [ ] Set up monitoring/alerting (Sentry, UptimeRobot)
- [ ] Implement CSRF protection for state-changing operations
- [ ] Add 2FA for admin accounts

**Past Security Incidents**: See [SECURITY_INCIDENT.md](SECURITY_INCIDENT.md) - API keys were committed to git in the past. All secrets are now in `.env` (gitignored).

## Related Documentation

- [README.md](README.md) - Project overview and installation
- [README_PRODUCTION.md](README_PRODUCTION.md) - Quick production deployment guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed Vercel deployment
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Complete API reference
- [QUICK_START.md](QUICK_START.md) - Getting started guide
- [E2E_TEST_REPORT.md](E2E_TEST_REPORT.md) - Manual testing results
- Analysis docs: Various audit and planning documents for feature development
