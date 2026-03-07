# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Authentication note:** QuickList uses Clerk exclusively. JWT/bcrypt and Google OAuth legacy flows have been removed. Do not reintroduce them.

## Project Overview

QuickList AI is an AI-powered listing generator for online marketplaces (eBay, Vinted, Gumtree). Users upload product photos and the app generates complete listings using Google Gemini Vision API, with automated market research, pricing intelligence, and optional eBay integration.

**Key Architecture Decision**: Single-file frontend ([index.html](index.html) - ~2850 lines) with no build process. All HTML, CSS, and JavaScript are in one file for simplicity and zero build complexity.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server with auto-reload (copies assets to public/ first)
npm run dev

# Start production server
npm start

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Generate a Clerk test token (for API testing)
npm run clerk:token

# Initialize database (development only)
# Start server first, then visit: http://localhost:4577/api/init-db
# In production: requires ALLOW_DB_INIT=true environment variable
```

**Port**: Default is 3000, but the project convention uses 4577. Check `.env` for `PORT`.

**Dev script behavior**: `npm run dev` runs `scripts/dev.sh`, which copies `index.html`, PWA assets, and static directories into `public/` before starting nodemon. This ensures local dev matches the Vercel static-file serving layout.

**Test auth bypass**: Set `ALLOW_TEST_AUTH=1` (non-production only) to skip Clerk verification and use a hardcoded test user.

## Tech Stack

- **Frontend**: Vanilla JavaScript (no framework), single HTML file with embedded CSS and JS. Clerk JS SDK loaded from CDN at runtime.
- **Backend**: Express.js (~5650 lines in [server.js](server.js))
- **Database**: PostgreSQL via [db.js](db.js) (connection pool module). Neon serverless recommended.
- **Authentication**: Clerk only (`@clerk/express`). Supports cookie-based sessions and Bearer token header.
- **AI**: Google Gemini Vision API. Default model: `gemini-2.5-flash` (configurable via `GEMINI_LISTING_MODEL` / `GEMINI_VISION_MODEL` env vars).
- **Image Storage**: Cloudinary (primary) with base64 fallback in DB schema.
- **Payments**: Stripe (optional, for subscription tiers)
- **Marketplace Integration**: eBay API (optional)
- **Error Tracking**: Sentry (optional, enabled when `SENTRY_DSN` is set)
- **PWA**: `manifest.json`, `service-worker.js`, `offline.html`, `pwa-features.js`

## Architecture

### Backend Structure

Server code is split between [server.js](server.js) (monolith, ~5650 lines) and extracted modules being progressively refactored out:

- **[db.js](db.js)** — PostgreSQL connection pool (shared module)
- **[middleware/auth.js](middleware/auth.js)** — Clerk authentication middleware (`createAuthMiddleware`)
- **[routes/](routes/)** — Extracted route handlers: `health.js`, `listings.js`, `stripe.js`, `subscription.js`, `config.js`
- **[services/stripe.js](services/stripe.js)** — Stripe business logic
- **[utils/](utils/)** — `gemini.js`, `ebayAuth.js`, `ebayInventory.js`, `platformOptimizers.js`, `validation.js`, `clipboard.js`
- **[components/](components/)** — Frontend JS components: `BottomNav.js`, `ListingCard.js`, `PlatformSelector.js`

**Note**: Much of the logic still lives in [server.js](server.js). New code should prefer the modular structure.

### Authentication Flow (Clerk)

1. Frontend loads Clerk JS SDK from CDN dynamically (see `loadClerkScript` in index.html)
2. On login, frontend obtains a Clerk session token and sends it as `Authorization: Bearer <token>`
3. `authenticateToken` middleware in [middleware/auth.js](middleware/auth.js) verifies via `clerkClient.verifyToken()` or cookie session
4. Middleware looks up/creates the user in the `users` table (keyed on `clerk_id`)
5. `req.user` is set with `{ id, clerkId, email, name }` for downstream handlers

### Database Schema ([schema.sql](schema.sql))

**Three main tables**:

1. **users** — `id`, `email`, `clerk_id`, `auth_provider` ('clerk'), `name`, `ebay_auth_token`, timestamps
2. **listings** — `user_id` (FK), `title`, `brand`, `category`, `description`, `condition`, `rrp`, `price`, `keywords` (TEXT[]), `sources` (JSONB), `platform`, `ebay_item_id`, `pricing_data` (JSONB), `posted_to_ebay`, timestamps
3. **images** — `listing_id` (FK), `image_data` (TEXT base64), `image_order`, `is_blurry`, timestamp

Cascade deletes: user → listings → images. Keywords use PostgreSQL `TEXT[]`. Sources/pricing_data use JSONB.

**Migration files**: `schema_clerk_migration.sql`, `schema_cloudinary_migration.sql`, `schema_listing_updates.sql`, etc. — apply these incrementally rather than using `/api/init-db` which drops all tables.

### Key API Routes

- `GET /api/config/cloudinary` — Returns Cloudinary config for frontend uploads
- `POST /api/generate` — AI listing generation (rate limited: 10/min)
- `GET/POST /api/listings` — Listing CRUD
- `GET/PUT/DELETE /api/listings/:id` — Individual listing operations
- `POST /api/upload-image` — Cloudinary image upload
- `GET /api/subscription/status`, `GET /api/usage` — Subscription/usage info
- `POST /api/listings/:id/post-to-ebay` — eBay posting
- `GET /api/health` — Health check with service status
- `GET /api/init-db` — Drop/recreate DB (dev only; requires `ALLOW_DB_INIT=true` in prod)

### Frontend Structure ([index.html](index.html))

- **Lines ~1-870**: `<head>`, CSS custom properties, dark cream theme
- **Lines ~870-1480**: Marketing pages HTML
- **Lines ~1480-end**: JavaScript — Clerk SDK loader, `app` object with all logic

**State**: Centralized in `app.state`. Key methods: `init()`, `generateListing()`, `saveListing()`, `loadListing()`, `deleteListing()`, `updateUI()`, `displayListing()`, `downloadZip()`.

## Environment Variables

**Required**:
```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
GEMINI_API_KEY=your_gemini_api_key
PORT=4577
NODE_ENV=development
FRONTEND_URL=http://localhost:4577
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Image uploads (Cloudinary)**:
```env
CLOUDINARY_CLOUD_NAME=quicklist
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_UPLOAD_PRESET=quicklist_unsigned
CLOUDINARY_ENHANCED_UPLOAD_PRESET=upload-optimise
```

**Optional**:
```env
GEMINI_LISTING_MODEL=gemini-2.5-flash  # Override AI model
GEMINI_VISION_MODEL=gemini-2.5-flash
SENTRY_DSN=...                         # Error tracking
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
EBAY_APP_ID=...
EBAY_DEV_ID=...
EBAY_CERT_ID=...
EBAY_SITE_ID=3                         # UK
EBAY_SANDBOX=false
ALLOW_DB_INIT=true                     # Dangerous in production
ALLOW_TEST_AUTH=1                      # Dev-only auth bypass
LOG_LEVEL=info                         # debug, info, warn, error
```

## Working Style

**Quality over speed.** Take the time to do things properly — read the full context before making changes, understand the existing patterns, and produce polished output. Do not rush to ship something half-finished. A slower, more considered approach is always preferred over a fast but sloppy one.

## File Editing Guidelines

### server.js

- Use parameterized queries: `$1, $2, ...`; `$1::text[]` for keyword arrays; `$1::jsonb` for JSONB columns
- Protected routes use `authenticateToken` from [middleware/auth.js](middleware/auth.js)
- Always check ownership: `listing.user_id === req.user.id`
- Rate limiters: `authLimiter` (5 req/15min), `generateLimiter` (10 req/min)
- Use `logger.error()` for server logs; include `X-Request-ID` header for tracking

### index.html

- CSS custom properties in `:root` — dark cream palette
- All JS in global `app` object to avoid namespace pollution
- Async/await throughout; add new methods to `app` object following existing patterns

## Deployment (Vercel)

Static assets served from `public/` (populated by dev script / `vercel-build.sh`). API routes handled by [api/server.js](api/server.js) (thin wrapper around server.js).

```bash
vercel  # or push to main for auto-deploy
```

Set all environment variables in the Vercel dashboard. Use Neon PostgreSQL with SSL.

## Related Documentation

- [README.md](README.md) — Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) — Detailed Vercel deployment
- [env.example](env.example) — All environment variables with descriptions
- [e2e_test.sh](e2e_test.sh) — Bash script for API endpoint testing
