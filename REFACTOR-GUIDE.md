# Server.js Refactoring Guide

## Created Modules

### Utils (shared helpers)

```
utils/
├── gemini.js      # Gemini JSON parsing, repair, extraction (9 functions)
└── validation.js  # Input validation, sanitization (7 functions)
```

### Middleware

```
middleware/
└── auth.js        # Clerk authentication middleware
```

### Services (business logic)

```
services/
└── stripe.js      # Stripe webhook handlers (6 functions)
```

### Routes

```
routes/
├── health.js       # /api/ping, /api/health
├── config.js       # /api/config/auth, /api/config/pricing, /api/config/cloudinary
├── stripe.js       # /api/stripe/* (webhooks, checkout, portal)
├── listings.js     # /api/listings/* (CRUD - 7 endpoints)
└── subscription.js # /api/subscription/status, /api/usage, /api/dashboard/metrics
```

## Integration Instructions

### Step 1: Add imports at top of server.js

```javascript
// Utils
const geminiUtils = require('./utils/gemini');
const { sanitizeInput, validateEmail, priceStringToNumber } = require('./utils/validation');

// Middleware
const { createAuthMiddleware } = require('./middleware/auth');

// Services
const { createStripeHandlers } = require('./services/stripe');

// Routes
const healthRoutes = require('./routes/health');
const configRoutes = require('./routes/config');
const createStripeRoutes = require('./routes/stripe');
const createListingsRoutes = require('./routes/listings');
const createSubscriptionRoutes = require('./routes/subscription');
```

### Step 2: Create dependencies after pool/logger setup

```javascript
// Create auth middleware
const authenticateToken = createAuthMiddleware({
  pool,
  logger,
  ensureSchemaReady,
});

// Create Stripe handlers
const stripeHandlers = createStripeHandlers({
  stripe,
  pool,
  logger,
  safeQuery,
});
```

### Step 3: Mount routes (AFTER middleware setup, BEFORE error handlers)

```javascript
// Health & Config (no auth required)
app.use(healthRoutes({ pool, logger }));
app.use(configRoutes);

// Stripe routes (webhook needs raw body - mount BEFORE express.json())
// Note: Stripe webhook route should be mounted before body parsers
const stripeRouter = createStripeRoutes({
  stripe,
  pool,
  logger,
  authenticateToken,
  stripeHandlers,
});
app.use(stripeRouter);

// Listings (auth required)
const listingsRouter = createListingsRoutes({
  pool,
  logger,
  authenticateToken,
  safeQuery,
  sanitizeInput: require('./utils/validation').sanitizeInput,
  ensureSchemaReady,
});
app.use(listingsRouter);

// Subscription (auth required)
const subscriptionRouter = createSubscriptionRoutes({
  pool,
  logger,
  authenticateToken,
  safeQuery,
});
app.use(subscriptionRouter);
```

### Step 4: Remove extracted code from server.js

After mounting routes, remove these line ranges from server.js:

| Lines     | What to Remove                                             |
| --------- | ---------------------------------------------------------- |
| 524-530   | validateEmail, sanitizeInput                               |
| 535-545   | priceStringToNumber                                        |
| 546-726   | All JSON repair functions                                  |
| 728-824   | extractGeminiText, extractJsonFromGeminiText, tryParseJson |
| 916-1076  | authenticateToken function                                 |
| 1228-1402 | All Stripe webhook handlers                                |
| 296-367   | Stripe webhook endpoint                                    |
| 1085-1402 | Stripe checkout/portal endpoints                           |
| 1735-2152 | Listings CRUD endpoints                                    |
| 1416-1652 | Subscription/usage endpoints                               |

### Step 5: Update gemini calls

Replace direct function calls with util imports:

```javascript
// Before
const result = extractGeminiText(response.candidates[0]);

// After
const { extractGeminiText } = require('./utils/gemini');
const result = extractGeminiText(response.candidates[0], logger);
```

## Remaining Routes to Extract

These are still in server.js and should be extracted next:

| File                  | Endpoints                                                                   | Priority |
| --------------------- | --------------------------------------------------------------------------- | -------- |
| `routes/images.js`    | /api/images/upload, /api/images/:publicId, /api/analyze-image-quality       | High     |
| `routes/ai.js`        | /api/generate, /api/lookup-barcode, /api/analyze-damage, /api/analyze-label | High     |
| `routes/messages.js`  | /api/messages, /api/messages/:id/read, /api/messages/:id/reply              | Medium   |
| `routes/platforms.js` | /api/listings/:id/platform-_, /api/analytics/_                              | Medium   |
| `routes/ebay.js`      | /auth/ebay/_, /api/ebay/_                                                   | Low      |

## Testing After Refactor

```bash
# Health check
curl http://localhost:3000/api/ping

# Config
curl http://localhost:3000/api/config/pricing

# Auth (needs Clerk token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/auth/verify

# Listings
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/listings
```

## Notes

- All route modules use dependency injection for testability
- Auth middleware is created once and passed to all auth-required routes
- Stripe webhook route MUST be before express.json() middleware (needs raw body)
- Logger is passed to all modules for consistent logging
