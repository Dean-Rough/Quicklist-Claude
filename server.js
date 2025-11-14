const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const xml2js = require('xml2js');
const rateLimit = require('express-rate-limit');
const logger = require('console-log-level')({ level: process.env.LOG_LEVEL || 'info' });
const { clerkClient, clerkMiddleware, getAuth, requireAuth } = require('@clerk/express');
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');
const packageJson = require('./package.json');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cloudinary = require('cloudinary').v2;

// Only load .env in non-production environments (Vercel provides env vars directly)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  require('dotenv').config();
}

// Initialize Sentry error tracking (optional - only if DSN is configured)
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% sampling in prod, 100% in dev
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
    beforeSend(event, hint) {
      // Don't send errors in development unless explicitly configured
      if (process.env.NODE_ENV !== 'production' && !process.env.SENTRY_FORCE_SEND) {
        return null;
      }
      return event;
    },
  });
  logger.info('Sentry error tracking initialized');
} else {
  logger.info('Sentry DSN not configured - error tracking disabled');
}

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  logger.error('Missing required environment variables:', missing.join(', '));
  logger.error('Required: DATABASE_URL, GEMINI_API_KEY, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY');
  // Don't exit in serverless - log error and continue
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

logger.info('Clerk authentication enabled');

// Conditional Stripe initialization
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (process.env.CLOUDINARY_CLOUD_NAME) {
  logger.info('Cloudinary configured successfully');
} else {
  logger.warn('Cloudinary not configured - image upload will not work');
}

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl =
  process.env.FRONTEND_URL || (isProduction ? 'https://quicklist.it.com' : 'http://localhost:4577');

// Database connection with proper configuration
let pool;
let schemaEnsurePromise = null;
if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !==
    'postgresql://placeholder:placeholder@placeholder.neon.tech/quicklist?sslmode=require'
) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test database connection (only in non-serverless environments)
  if (!process.env.VERCEL) {
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        logger.error('Database connection error:', err);
        process.exit(1);
      } else {
        logger.info('Database connected successfully');
      }
    });
  }

  ensureSchemaReady().catch((error) => {
    logger.error('Initial schema ensure failed:', { error: error.message });
  });
} else {
  logger.error('No valid DATABASE_URL found. Database connection required.');
  // Don't exit in serverless - let requests fail gracefully
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// Clerk is now the only authentication method
// No JWT validation needed

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many generation requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: [
          "'self'",
          frontendUrl,
          'http://localhost:3000',
          'http://localhost:4577',
          'https://api.clerk.com',
          'https://clerk.com',
          'https://clerk.accounts.dev',
          'https://*.clerk.accounts.dev',
          'https://img.clerk.com',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        // Allow Clerk to create Web Workers for authentication
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Compression middleware
app.use(compression());

// Cookie parser
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      frontendUrl,
      'http://localhost:4577',
      'http://localhost:3000',
      'https://quicklist.it.com',
      'https://quicklist.ai',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};
app.use(cors(corsOptions));

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Stripe webhook must be registered before JSON body parsing to preserve the raw payload
const stripeWebhookMiddleware = express.raw({ type: 'application/json' });
app.post('/api/stripe/webhook', stripeWebhookMiddleware, async (req, res) => {
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
      bodyLength: req.body.length,
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
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

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error:', { error: error.message, eventType: event.type });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error('JSON Parse Error:', {
      message: err.message,
      url: req.url,
      method: req.method,
      contentType: req.get('content-type'),
      bodyPreview: req.body ? JSON.stringify(req.body).substring(0, 200) : 'No body',
    });
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      details: err.message,
    });
  }
  next(err);
});

// Test endpoint before Clerk middleware
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Clerk middleware - must be before routes that need auth
// Only use Clerk middleware if properly configured
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  try {
    app.use(clerkMiddleware());
    logger.info('Clerk middleware initialized');
  } catch (error) {
    logger.error('Failed to initialize Clerk middleware:', error);
  }
} else {
  logger.warn('Clerk not configured - skipping middleware');
}

// Auth config endpoint (for frontend)
app.get('/api/config/auth', (req, res) => {
  res.json({
    clerk: {
      enabled: true,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    },
    authProvider: 'clerk',
  });
});

// Serve static files from ./public only
app.use(
  '/.well-known',
  express.static(path.join(__dirname, '.well-known'), {
    maxAge: isProduction ? '1y' : '0',
    etag: true,
    lastModified: true,
  })
);

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1y' : '0',
    etag: true,
    lastModified: true,
  })
);

// Serve JavaScript files from components/ and utils/ with correct MIME type
app.use(
  '/components',
  express.static(path.join(__dirname, 'components'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      }
    },
  })
);

app.use(
  '/utils',
  express.static(path.join(__dirname, 'utils'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      }
    },
  })
);

// Serve SPA entry point
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Input validation helpers
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

function priceStringToNumber(value) {
  if (!value || typeof value !== 'string') return 0;
  const numeric = parseFloat(value.replace(/[^0-9.]/g, ''));
  return isNaN(numeric) ? 0 : numeric;
}

/**
 * Gemini sometimes emits single backslashes (e.g. "Home \ Men") inside strings,
 * which breaks JSON.parse. Escape only the unsupported sequences so valid escapes
 * like \n, \t, or \u1234 continue to work as intended.
 */
function repairGeminiJsonString(jsonString) {
  if (typeof jsonString !== 'string') {
    return jsonString;
  }

  return jsonString.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

function sliceBalancedJson(text, startIndex) {
  if (!text || startIndex < 0 || startIndex >= text.length) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }

      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

function extractListingFromGeminiText(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  const quickParse = tryParseJson(text.trim());
  if (quickParse) {
    return quickParse;
  }

  const tryParse = (candidate) => tryParseJson(candidate?.trim());

  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let blockMatch;
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const parsed = tryParse(blockMatch[1]);
    if (parsed) {
      return parsed;
    }
  }

  let searchIndex = text.indexOf('{');
  while (searchIndex !== -1) {
    const candidate = sliceBalancedJson(text, searchIndex);
    if (candidate) {
      const parsed = tryParse(candidate);
      if (parsed) {
        return parsed;
      }
    }
    searchIndex = text.indexOf('{', searchIndex + 1);
  }

  return null;
}

function tryParseJson(payload) {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(repairGeminiJsonString(payload));
  } catch (error) {
    return null;
  }
}

async function ensureCoreSchema() {
  const schemaFiles = [
    'schema.sql',
    'schema_updates.sql',
    'schema_listing_updates.sql',
    'schema_clerk_migration.sql',
    'schema_cloudinary_migration.sql',
  ];

  for (const fileName of schemaFiles) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    if (!sql || sql.trim().length === 0) {
      continue;
    }

    await pool.query(sql);
  }

  logger.info('Core database schema ensured');
}

function ensureSchemaReady() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  if (!schemaEnsurePromise) {
    schemaEnsurePromise = ensureCoreSchema().catch((error) => {
      logger.error('Schema ensure failed:', { error: error.message });
      throw error;
    });
  }

  return schemaEnsurePromise;
}

// Safe database query wrapper
async function safeQuery(query, params) {
  try {
    await ensureSchemaReady();
    return await pool.query(query, params);
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      code: error.code,
      query: query.substring(0, 100),
    });
    throw error;
  }
}

const MOBILE_TIPS = [
  'Batch similar items to speed through photo capture',
  'Use the voice button to dictate condition notes hands-free',
  'Mark sold items as soon as they go to keep marketplaces in sync',
];

// Get plan limits helper
async function getPlanLimit(userId) {
  try {
    const result = await pool.query(
      `SELECT plan_type FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const planType = result.rows[0]?.plan_type || 'free';
    const planLimits = {
      free: 5,
      starter: 50,
      pro: 200,
      business: 1000,
    };
    return planLimits[planType] || 5;
  } catch (error) {
    logger.error('Error getting plan limit:', error);
    return 5; // Default to free tier limit
  }
}

// Auth middleware - Enhanced Clerk middleware that adds user info to req.user
const authenticateToken = async (req, res, next) => {
  try {
    await ensureSchemaReady();
    // Try to get auth from Clerk middleware first (cookie-based)
    let { userId } = getAuth(req);

    // If no userId from cookie, try to verify token from Authorization header
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
          // Verify the token with Clerk
          const verifiedToken = await clerkClient.verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
          });
          userId = verifiedToken.sub; // 'sub' contains the user ID
        } catch (tokenError) {
          logger.warn('Token verification failed:', {
            error: tokenError.message,
            requestId: req.id,
          });
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Get full user details from Clerk
    logger.info('Fetching user details from Clerk', { userId, requestId: req.id });
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.username;
    logger.info('Got user from Clerk', { userId, email, requestId: req.id });

    // Look up or create database user record
    let dbUser;
    try {
      dbUser = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [userId]);
      logger.info('Database user lookup result', {
        userId,
        found: dbUser.rows.length > 0,
        requestId: req.id,
      });
    } catch (dbError) {
      logger.error('Database user lookup failed', {
        error: dbError.message,
        userId,
        requestId: req.id,
      });
      throw dbError;
    }

    // If user doesn't exist in database, create them
    if (dbUser.rows.length === 0) {
      logger.info('Creating new user in database', { clerkId: userId, email });
      try {
        const newUser = await pool.query(
          `INSERT INTO users (email, clerk_id, auth_provider, name)
                   VALUES ($1, $2, 'clerk', $3)
                   ON CONFLICT (email) DO UPDATE SET clerk_id = $2
                   RETURNING id`,
          [email, userId, name]
        );
        dbUser = newUser;
        logger.info('User created successfully', {
          dbUserId: dbUser.rows[0].id,
          email,
          requestId: req.id,
        });
      } catch (createError) {
        logger.error('Failed to create user in database', {
          error: createError.message,
          email,
          userId,
          requestId: req.id,
        });
        throw createError;
      }
    }

    // Attach user info to request with DATABASE user ID
    req.user = {
      id: dbUser.rows[0].id, // Database ID (integer) for queries
      clerkId: userId, // Clerk ID for reference
      email: email,
      name: name,
    };

    // Log auth event
    logger.info('User authenticated', {
      dbUserId: req.user.id,
      clerkId: userId,
      email,
      requestId: req.id,
    });

    return next();
  } catch (error) {
    logger.error('Clerk authentication error:', {
      error: error.message,
      stack: error.stack,
      requestId: req.id,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderPrefix: req.headers.authorization?.substring(0, 20),
    });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Initialize database schema
app.get('/api/init-db', async (req, res) => {
  try {
    if (process.env.ALLOW_DB_INIT !== 'true') {
      return res.status(403).json({ error: 'Database initialization is disabled' });
    }

    const fs = require('fs');
    const schemaFiles = ['schema.sql', 'schema_updates.sql', 'schema_clerk_migration.sql']
      .map((file) => path.join(__dirname, file))
      .filter(fs.existsSync);

    for (const filePath of schemaFiles) {
      const sql = fs.readFileSync(filePath, 'utf8');
      await safeQuery(sql);
    }

    logger.info('Database initialized successfully');
    res.json({
      message: 'Database initialized successfully',
      files: schemaFiles.map((f) => path.basename(f)),
    });
  } catch (error) {
    logger.error('Database initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize database' });
  }
});

// Auth endpoints - Clerk handles signup/signin via their SDK
// Legacy JWT endpoints removed - use Clerk OAuth or email/password via Clerk UI

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  // authenticateToken middleware already handles user lookup/creation
  // Just return the user info
  res.json({ user: req.user });
});

// Stripe: Create checkout session
app.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    const { priceId, planType } = req.body; // e.g., 'price_xxx', 'pro'

    if (!priceId || !planType) {
      return res.status(400).json({ error: 'Price ID and plan type required' });
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
      // Get user email
      const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = userResult.rows[0];

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          quicklist_user_id: userId.toString(),
        },
      });
      customerId = customer.id;

      // Store customer ID - create subscription if it doesn't exist, otherwise update
      const subCheck = await pool.query('SELECT id FROM subscriptions WHERE user_id = $1', [
        userId,
      ]);

      if (subCheck.rows.length > 0) {
        // Update existing subscription
        await pool.query('UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2', [
          customerId,
          userId,
        ]);
      } else {
        // Create new subscription record
        await pool.query(
          `INSERT INTO subscriptions (user_id, stripe_customer_id, status, plan_type, current_period_start, current_period_end)
                     VALUES ($1, $2, 'active', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month')`,
          [userId, customerId]
        );
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:4577'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:4577'}/payment/cancel`,
      metadata: {
        user_id: userId.toString(),
        plan_type: planType,
      },
    });

    logger.info('Stripe checkout session created:', { userId: req.user.id, sessionId: session.id });
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    logger.error('Stripe checkout error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe: Create portal session (manage subscription)
app.post('/api/stripe/create-portal-session', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    const userId = req.user.id;

    // Get Stripe customer ID
    const result = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!result.rows.length || !result.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const customerId = result.rows[0].stripe_customer_id;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:4577'}/settings`,
    });

    logger.info('Stripe portal session created:', { userId });
    res.json({ url: session.url });
  } catch (error) {
    logger.error('Stripe portal error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook handlers
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

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      logger.error('No subscription items found');
      return;
    }

    const priceId = subscription.items.data[0].price.id;

    // Update or create subscription in database
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
  } catch (error) {
    logger.error('Error in handleCheckoutCompleted:', { error: error.message });
    throw error; // Re-throw to be caught by webhook handler
  }
}

async function handleSubscriptionUpdate(subscription) {
  try {
    if (!subscription.customer || !subscription.id) {
      logger.error('Missing customer or subscription ID');
      return;
    }

    const customerId = subscription.customer;
    const subscriptionId = subscription.id;

    if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      logger.error('No subscription items found in update');
      return;
    }

    const priceId = subscription.items.data[0].price.id;

    // Find user by customer ID
    const result = await pool.query(
      'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;

      // Determine plan type from price ID
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
    } else {
      logger.warn('No subscription found for customer:', { customerId });
    }
  } catch (error) {
    logger.error('Error in handleSubscriptionUpdate:', { error: error.message });
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    if (!subscription || !subscription.id) {
      logger.error('Missing subscription ID in deletion handler');
      return;
    }

    await safeQuery(
      `UPDATE subscriptions 
             SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
             WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  } catch (error) {
    logger.error('Error in handleSubscriptionDeleted:', { error: error.message });
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    if (subscriptionId) {
      await safeQuery(
        `UPDATE subscriptions SET status = 'active', updated_at = CURRENT_TIMESTAMP
                 WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      );
    }
  } catch (error) {
    logger.error('Error in handlePaymentSucceeded:', { error: error.message });
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    if (subscriptionId) {
      await safeQuery(
        `UPDATE subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
                 WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      );
    }
  } catch (error) {
    logger.error('Error in handlePaymentFailed:', { error: error.message });
    throw error;
  }
}

function mapPriceIdToPlanType(priceId) {
  // Map your Stripe price IDs to plan types
  // Update these with your actual Stripe price IDs
  const priceMap = {
    [process.env.STRIPE_PRICE_STARTER]: 'starter',
    [process.env.STRIPE_PRICE_PRO]: 'pro',
    [process.env.STRIPE_PRICE_BUSINESS]: 'business',
  };
  return priceMap[priceId] || 'free';
}

// Stripe: Get publishable key (for frontend)
app.get('/api/stripe/publishable-key', (req, res) => {
  try {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    res.json({ publishableKey });
  } catch (error) {
    logger.error('Error getting Stripe publishable key:', { error: error.message });
    res.status(500).json({ error: 'Failed to get Stripe publishable key' });
  }
});

// Get user subscription status with usage
app.get('/api/subscription/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get subscription
    const result = await pool.query(
      `SELECT s.*, u.email, u.name 
             FROM subscriptions s
             JOIN users u ON s.user_id = u.id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC
             LIMIT 1`,
      [userId]
    );

    let subscription;
    if (result.rows.length === 0) {
      // Create free tier subscription
      const newSub = await pool.query(
        `INSERT INTO subscriptions (user_id, status, plan_type, current_period_start, current_period_end)
                 VALUES ($1, 'active', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month')
                 RETURNING *`,
        [userId]
      );
      subscription = newSub.rows[0];
    } else {
      subscription = result.rows[0];
    }

    // Get usage for current period
    const periodStart = subscription.current_period_start || new Date();
    const periodEnd =
      subscription.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const usageResult = await pool.query(
      `SELECT listings_created 
             FROM usage_tracking 
             WHERE user_id = $1 
             AND period_start >= $2 
             AND period_start < $3
             ORDER BY period_start DESC
             LIMIT 1`,
      [userId, periodStart, periodEnd]
    );

    const listingsCreated = usageResult.rows.length > 0 ? usageResult.rows[0].listings_created : 0;

    // Get plan limits
    const planLimits = {
      free: 5,
      starter: 50,
      pro: 200,
      business: 1000,
    };

    const planType = subscription.plan_type || 'free';
    const limit = planLimits[planType] || 5;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        avatarUrl: user.avatar_url,
      },
      subscription: {
        planType: planType,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        stripeCustomerId: subscription.stripe_customer_id,
      },
      usage: {
        listingsCreated: listingsCreated,
        limit: limit,
        percentage: Math.min((listingsCreated / limit) * 100, 100),
      },
    });
  } catch (error) {
    logger.error('Subscription status error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Get usage tracking
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await pool.query(
      `SELECT listings_created, ai_generations, background_removals
             FROM usage_tracking 
             WHERE user_id = $1 
             AND period_start >= $2 
             AND period_start < $3
             ORDER BY period_start DESC
             LIMIT 1`,
      [userId, periodStart, periodEnd]
    );

    if (result.rows.length === 0) {
      return res.json({
        listingsCreated: 0,
        aiGenerations: 0,
        backgroundRemovals: 0,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Usage tracking error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// Dashboard metrics for mobile view
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      revenueResult,
      prevRevenueResult,
      activeResult,
      listingsTodayResult,
      draftsResult,
      soldWeekResult,
      photoQueueResult,
    ] = await Promise.all([
      safeQuery(
        `SELECT sold_price, price FROM listings
                 WHERE user_id = $1 AND status = 'sold' AND sold_at >= NOW() - INTERVAL '7 days'`,
        [userId]
      ),
      safeQuery(
        `SELECT sold_price, price FROM listings
                 WHERE user_id = $1 AND status = 'sold'
                 AND sold_at >= NOW() - INTERVAL '14 days'
                 AND sold_at < NOW() - INTERVAL '7 days'`,
        [userId]
      ),
      safeQuery(
        `SELECT COUNT(*) FROM listings
                 WHERE user_id = $1 AND (status IS NULL OR status IN ('draft', 'active'))`,
        [userId]
      ),
      safeQuery(
        `SELECT COUNT(*) FROM listings
                 WHERE user_id = $1 AND created_at >= DATE_TRUNC('day', NOW())`,
        [userId]
      ),
      safeQuery(
        `SELECT COUNT(*) FROM listings
                 WHERE user_id = $1 AND status = 'draft'`,
        [userId]
      ),
      safeQuery(
        `SELECT COUNT(*) FROM listings
                 WHERE user_id = $1 AND status = 'sold'
                 AND sold_at >= NOW() - INTERVAL '7 days'`,
        [userId]
      ),
      safeQuery(
        `SELECT COUNT(*) FROM images i
                 INNER JOIN listings l ON l.id = i.listing_id
                 WHERE l.user_id = $1 AND (l.status IS NULL OR l.status <> 'sold')`,
        [userId]
      ),
    ]);

    const revenue = revenueResult.rows.reduce(
      (sum, row) => sum + priceStringToNumber(row.sold_price || row.price),
      0
    );
    const prevRevenue = prevRevenueResult.rows.reduce(
      (sum, row) => sum + priceStringToNumber(row.sold_price || row.price),
      0
    );
    const revenueTrend =
      prevRevenue === 0
        ? revenue > 0
          ? 100
          : 0
        : Math.round(((revenue - prevRevenue) / prevRevenue) * 100);

    res.json({
      revenueLast7Days: revenue,
      revenueTrend,
      activeListings: parseInt(activeResult.rows[0].count, 10),
      listingsAddedToday: parseInt(listingsTodayResult.rows[0].count, 10),
      unreadMessages: 0, // Messages feature removed
      activity: [
        {
          id: 'photosQueued',
          label: 'Queued photos',
          icon: '📷',
          detail: `${parseInt(photoQueueResult.rows[0].count, 10)} images ready`,
        },
        {
          id: 'draftListings',
          label: 'Draft listings',
          icon: '📝',
          detail: `${parseInt(draftsResult.rows[0].count, 10)} drafts waiting`,
        },
        {
          id: 'soldWeek',
          label: 'Sold this week',
          icon: '✅',
          detail: `${parseInt(soldWeekResult.rows[0].count, 10)} items`,
        },
      ],
      tips: MOBILE_TIPS,
    });
  } catch (error) {
    logger.error('Dashboard metrics error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});

// Messages API
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await safeQuery(
      `SELECT id, buyer_name, platform, snippet, body, unread, last_reply_text, last_reply_at, created_at
             FROM messages
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
      [userId]
    );
    res.json({ messages: result.rows });
  } catch (error) {
    logger.error('Messages fetch error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const result = await safeQuery(
      `UPDATE messages
             SET unread = false
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: result.rows[0] });
  } catch (error) {
    logger.error('Message read error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to update message' });
  }
});

app.post('/api/messages/:id/reply', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id, 10);
    const { reply } = req.body || {};

    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    if (!reply || typeof reply !== 'string') {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const cleanReply = sanitizeInput(reply);

    const result = await safeQuery(
      `UPDATE messages
             SET last_reply_text = $1,
                 last_reply_at = NOW(),
                 snippet = $1,
                 unread = false
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
      [cleanReply, messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: result.rows[0] });
  } catch (error) {
    logger.error('Message reply error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Listing endpoints
app.post('/api/listings', authenticateToken, async (req, res) => {
  await ensureSchemaReady();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      title,
      brand,
      category,
      description,
      condition,
      rrp,
      price,
      keywords,
      sources,
      platform,
      images,
      status,
      location,
    } = req.body;
    const userId = req.user.id;

    const cleanStatus = sanitizeInput(status) || 'draft';
    const cleanLocation = sanitizeInput(location);

    // Insert listing
    const listingResult = await client.query(
      `INSERT INTO listings (user_id, title, brand, category, description, condition, rrp, price, keywords, sources, platform, status, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        userId,
        sanitizeInput(title),
        sanitizeInput(brand),
        sanitizeInput(category),
        sanitizeInput(description),
        sanitizeInput(condition),
        sanitizeInput(rrp),
        sanitizeInput(price),
        keywords || [],
        JSON.stringify(sources || []),
        sanitizeInput(platform),
        cleanStatus,
        cleanLocation,
      ]
    );

    const listing = listingResult.rows[0];

    // Insert images in batch if provided
    if (images && images.length > 0) {
      const preparedImages = images
        .map((img, idx) => {
          const dataSources = [
            typeof img.data === 'string' ? img.data.trim() : '',
            typeof img.url === 'string' ? img.url.trim() : '',
            typeof img.image_url === 'string' ? img.image_url.trim() : '',
            typeof img.thumbnail_url === 'string' ? img.thumbnail_url.trim() : '',
          ].filter(Boolean);

          const imageData = dataSources[0];

          if (!imageData) {
            logger.warn('Skipping image with no data or URL when saving listing', {
              listingId: listing.id,
              imageIndex: idx,
            });
            return null;
          }

          return {
            listingId: listing.id,
            imageData,
            order: idx,
            isBlurry: !!img.isBlurry,
          };
        })
        .filter(Boolean);

      if (preparedImages.length > 0) {
        const imageValues = preparedImages
          .map((_, idx) => {
            const baseIndex = idx * 4;
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
          })
          .join(', ');

        const imageParams = preparedImages.flatMap((img) => [
          img.listingId,
          img.imageData,
          img.order,
          img.isBlurry,
        ]);

        await client.query(
          `INSERT INTO images (listing_id, image_data, image_order, is_blurry) VALUES ${imageValues}`,
          imageParams
        );
      } else {
        logger.warn('All images skipped due to missing data when saving listing', {
          listingId: listing.id,
        });
      }
    }

    await client.query('COMMIT');

    // Track usage
    try {
      await safeQuery(
        `INSERT INTO usage_tracking (user_id, period_start, period_end, listings_created, ai_generations)
                 VALUES ($1, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', 1, 0)
                 ON CONFLICT (user_id, period_start) 
                 DO UPDATE SET listings_created = usage_tracking.listings_created + 1`,
        [userId]
      );
    } catch (usageError) {
      logger.warn('Usage tracking failed:', { error: usageError.message, userId });
    }

    logger.info('Listing created:', { listingId: listing.id, userId });
    res.json({ listing });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create listing error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to create listing' });
  } finally {
    client.release();
  }
});

app.get('/api/listings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get listings with pagination (without full image data for performance)
    const result = await safeQuery(
      `SELECT l.*,
                    (SELECT json_agg(json_build_object('id', i.id, 'image_url', i.image_data, 'thumbnail_url', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                     FROM images i WHERE i.listing_id = l.id) as images
             FROM listings l
             WHERE l.user_id = $1
             ORDER BY l.created_at DESC
             LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count for pagination
    const countResult = await safeQuery(
      'SELECT COUNT(*) as total FROM listings WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      listings: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get listings error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

app.get('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = req.params.id;

    // Get listing with images
    const result = await pool.query(
      `SELECT l.*,
                    (SELECT json_agg(json_build_object('id', i.id, 'data', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                     FROM images i WHERE i.listing_id = l.id) as images
             FROM listings l
             WHERE l.id = $1 AND l.user_id = $2`,
      [listingId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ listing: result.rows[0] });
  } catch (error) {
    logger.error('Get listing error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

app.get('/api/listings/:id/images', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = req.params.id;

    // First verify the listing belongs to the user
    const listingCheck = await safeQuery('SELECT id FROM listings WHERE id = $1 AND user_id = $2', [
      listingId,
      userId,
    ]);

    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get full image data for the listing
    const result = await safeQuery(
      `SELECT id, image_data as data, is_blurry as "isBlurry", image_order as "order"
       FROM images
       WHERE listing_id = $1
       ORDER BY image_order`,
      [listingId]
    );

    res.json({ images: result.rows });
  } catch (error) {
    logger.error('Get listing images error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch listing images' });
  }
});

app.put('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = req.params.id;
    const {
      title,
      brand,
      category,
      description,
      condition,
      rrp,
      price,
      keywords,
      sources,
      platform,
      status,
      soldPrice,
      soldAt,
      location,
    } = req.body;

    const cleanTitle = sanitizeInput(title);
    const cleanBrand = sanitizeInput(brand);
    const cleanCategory = sanitizeInput(category);
    const cleanDescription = sanitizeInput(description);
    const cleanCondition = sanitizeInput(condition);
    const cleanRrp = sanitizeInput(rrp);
    const cleanPrice = sanitizeInput(price);
    const cleanPlatform = sanitizeInput(platform);
    const serializedSources = JSON.stringify(sources || []);
    const cleanStatus = status ? sanitizeInput(status) : null;
    const cleanSoldPrice = soldPrice ? sanitizeInput(soldPrice) : null;
    const soldAtDate = soldAt ? new Date(soldAt) : null;
    const cleanLocation = typeof location !== 'undefined' ? sanitizeInput(location) : null;

    const result = await pool.query(
      `UPDATE listings
             SET title = $1, brand = $2, category = $3, description = $4, condition = $5,
                 rrp = $6, price = $7, keywords = $8, sources = $9, platform = $10,
                 status = COALESCE($11, status),
                 sold_price = COALESCE($12, sold_price),
                 sold_at = COALESCE($13, sold_at),
                 location = COALESCE($14, location)
             WHERE id = $15 AND user_id = $16
             RETURNING *`,
      [
        cleanTitle,
        cleanBrand,
        cleanCategory,
        cleanDescription,
        cleanCondition,
        cleanRrp,
        cleanPrice,
        keywords || [],
        serializedSources,
        cleanPlatform,
        cleanStatus,
        cleanSoldPrice,
        soldAtDate,
        cleanLocation,
        listingId,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    logger.info('Listing updated:', { listingId: listingId, userId });
    res.json({ listing: result.rows[0] });
  } catch (error) {
    logger.error('Update listing error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.id, 10);

    if (isNaN(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    logger.info('Deleting listing:', { listingId, userId });

    const result = await safeQuery(
      'DELETE FROM listings WHERE id = $1 AND user_id = $2 RETURNING id',
      [listingId, userId]
    );

    if (result.rows.length === 0) {
      logger.warn('Listing not found for deletion:', { listingId, userId });
      return res
        .status(404)
        .json({ error: 'Listing not found or you do not have permission to delete it' });
    }

    logger.info('Successfully deleted listing:', { listingId });
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    logger.error('Delete listing error:', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Failed to delete listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

app.post('/api/listings/:id/mark-sold', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.id, 10);
    if (isNaN(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const soldPrice = req.body?.soldPrice ? sanitizeInput(req.body.soldPrice) : null;
    const soldAt = req.body?.soldAt ? new Date(req.body.soldAt) : new Date();

    const result = await safeQuery(
      `UPDATE listings
             SET status = 'sold',
                 sold_at = $1,
                 sold_price = COALESCE($2, price)
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
      [soldAt, soldPrice, listingId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    logger.info('Listing marked as sold', { listingId, userId });
    res.json({ listing: result.rows[0] });
  } catch (error) {
    logger.error('Mark sold error:', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to mark listing as sold' });
  }
});

// eBay Pricing Intelligence Service
async function getEbayPricingIntelligence(brand, title, category) {
  try {
    const appId = process.env.EBAY_APP_ID;
    const siteId = process.env.EBAY_SITE_ID || '3'; // UK

    if (!appId) {
      logger.warn('eBay App ID not configured, skipping pricing intelligence');
      return null;
    }

    // Build search query
    const searchQuery = `${brand} ${title}`.trim();

    // eBay Finding API endpoint
    const findingApiUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';

    // Search completed listings (sold items)
    const completedParams = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: searchQuery,
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'itemFilter(1).name': 'ListingType',
      'itemFilter(1).value': 'FixedPrice',
      sortOrder: 'EndTimeSoonest',
      'paginationInput.entriesPerPage': '50',
    });

    const completedResponse = await axios.get(`${findingApiUrl}?${completedParams}`);
    const completedData = completedResponse.data;

    // Search active listings (competitors)
    const activeParams = new URLSearchParams({
      'OPERATION-NAME': 'findItemsAdvanced',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: searchQuery,
      'itemFilter(0).name': 'ListingType',
      'itemFilter(0).value': 'FixedPrice',
      sortOrder: 'PricePlusShippingLowest',
      'paginationInput.entriesPerPage': '20',
    });

    const activeResponse = await axios.get(`${findingApiUrl}?${activeParams}`);
    const activeData = activeResponse.data;

    // Process sold listings
    const soldItems = completedData.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const soldPrices = soldItems
      .map((item) => {
        const price =
          item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] ||
          item.sellingStatus?.[0]?.currentPrice?.[0] ||
          0;
        return parseFloat(price);
      })
      .filter((price) => price > 0);

    // Process active listings
    const activeItems = activeData.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
    const activePrices = activeItems
      .map((item) => {
        const price =
          item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] ||
          item.sellingStatus?.[0]?.currentPrice?.[0] ||
          0;
        return parseFloat(price);
      })
      .filter((price) => price > 0);

    if (soldPrices.length === 0) {
      return {
        avgSoldPrice: null,
        priceRange: null,
        soldCount: 0,
        competitorCount: activePrices.length,
        recommendations: ['No sold listings found. Use AI-generated price.'],
      };
    }

    // Calculate statistics
    const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
    const minSoldPrice = Math.min(...soldPrices);
    const maxSoldPrice = Math.max(...soldPrices);
    const sortedPrices = soldPrices.sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const top25Price = sortedPrices[Math.floor(sortedPrices.length * 0.75)];

    // Generate recommendations
    const recommendations = [];
    recommendations.push(`Price at £${Math.round(medianPrice)} for quick sale (median sold price)`);
    if (top25Price > medianPrice) {
      recommendations.push(`List at £${Math.round(top25Price)} for max profit (top 25% of sales)`);
    }
    if (activePrices.length > 0) {
      const avgActivePrice = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;
      if (avgActivePrice > avgSoldPrice) {
        recommendations.push(
          `Competitors average £${Math.round(avgActivePrice)} - consider pricing competitively`
        );
      }
    }

    return {
      avgSoldPrice: `£${Math.round(avgSoldPrice)}`,
      priceRange: {
        min: `£${Math.round(minSoldPrice)}`,
        max: `£${Math.round(maxSoldPrice)}`,
      },
      soldCount: soldPrices.length,
      competitorCount: activePrices.length,
      recentSales: soldPrices.slice(0, 10).map((p) => `£${Math.round(p)}`),
      recommendations,
    };
  } catch (error) {
    logger.error('eBay pricing intelligence error:', { error: error.message });
    return null;
  }
}

// Image hosting service (using Imgur API or self-hosted)
async function uploadImageToHosting(imageBase64) {
  try {
    // Option 1: Use Imgur API (free tier available)
    const imgurClientId = process.env.IMGUR_CLIENT_ID;
    if (imgurClientId) {
      const response = await axios.post(
        'https://api.imgur.com/3/image',
        {
          image: imageBase64.split(',')[1],
          type: 'base64',
        },
        {
          headers: {
            Authorization: `Client-ID ${imgurClientId}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.data.link;
      }
    }

    // Option 2: For now, return data URL (eBay may accept base64, but typically needs hosted URL)
    // In production, implement proper image hosting
    logger.warn('Imgur not configured, using base64 fallback');
    return imageBase64; // Fallback - eBay may not accept this
  } catch (error) {
    logger.error('Image upload error:', { error: error.message });
    // Fallback to base64
    return imageBase64;
  }
}

// eBay Posting Service
async function postToEbay(listingData, images, userToken, ebayCategoryId = null) {
  try {
    const appId = process.env.EBAY_APP_ID;
    const devId = process.env.EBAY_DEV_ID;
    const certId = process.env.EBAY_CERT_ID;
    const siteId = process.env.EBAY_SITE_ID || '3';
    const sandbox = process.env.EBAY_SANDBOX === 'true';

    if (!appId || !userToken) {
      throw new Error('eBay API credentials not configured');
    }

    // Upload images to hosting
    const imageUrls = [];
    for (const image of images) {
      const url = await uploadImageToHosting(image);
      imageUrls.push(url);
    }

    // Map condition to eBay condition ID
    const conditionMap = {
      'New with Tags': '1000',
      'Like New': '2750',
      Excellent: '3000',
      'Very Good': '4000',
      Good: '5000',
      Fair: '6000',
      Poor: '7000',
    };

    const conditionId = conditionMap[listingData.condition] || '5000';

    // Map category to eBay category ID
    // Note: This is a simplified mapping. For production, implement full eBay category API lookup
    const categoryMap = {
      Clothing: '11450',
      Shoes: '11450',
      Electronics: '58058',
      Books: '267',
      'Home & Garden': '11700',
      'Toys & Games': '220',
      Sports: '888',
      Collectibles: '1',
    };

    // Try to map category, fallback to provided categoryId or require user selection
    const categoryId = categoryMap[listingData.category] || ebayCategoryId;
    if (!categoryId) {
      throw new Error(
        'eBay category required. Please select a category or provide ebayCategoryId.'
      );
    }

    // Extract price (remove £ symbol)
    const price = listingData.price.replace(/[£,]/g, '').trim();

    // Build eBay XML request
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
        <eBayAuthToken>${userToken}</eBayAuthToken>
    </RequesterCredentials>
    <ErrorLanguage>en_US</ErrorLanguage>
    <WarningLevel>High</WarningLevel>
    <Item>
        <Title>${listingData.title.substring(0, 80)}</Title>
        <Description><![CDATA[${listingData.description}]]></Description>
        <PrimaryCategory>
            <CategoryID>${categoryId}</CategoryID>
        </PrimaryCategory>
        <StartPrice>${price}</StartPrice>
        <ConditionID>${conditionId}</ConditionID>
        <ListingType>FixedPriceItem</ListingType>
        <ListingDuration>GTC</ListingDuration>
        <Quantity>1</Quantity>
        <Country>GB</Country>
        <Currency>GBP</Currency>
        <PictureDetails>
            ${imageUrls.map((url) => `<PictureURL>${url}</PictureURL>`).join('\n            ')}
        </PictureDetails>
        <ReturnPolicy>
            <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
            <RefundOption>MoneyBack</RefundOption>
            <ReturnsWithinOption>Days_30</ReturnsWithinOption>
            <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
        </ReturnPolicy>
        <ShippingDetails>
            <ShippingType>Flat</ShippingType>
            <ShippingServiceOptions>
                <ShippingServicePriority>1</ShippingServicePriority>
                <ShippingService>UK_RoyalMailStandard</ShippingService>
                <ShippingServiceCost>3.50</ShippingServiceCost>
                <ShippingServiceAdditionalCost>0</ShippingServiceAdditionalCost>
            </ShippingServiceOptions>
        </ShippingDetails>
        <DispatchTimeMax>3</DispatchTimeMax>
    </Item>
</AddItemRequest>`;

    // eBay Trading API endpoint
    const endpoint = sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

    const response = await axios.post(endpoint, xml, {
      headers: {
        'X-EBAY-API-CALL-NAME': 'AddItem',
        'X-EBAY-API-APP-NAME': appId,
        'X-EBAY-API-DEV-NAME': devId,
        'X-EBAY-API-CERT-NAME': certId,
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'Content-Type': 'text/xml',
      },
    });

    const responseText = response.data;

    // Parse XML response
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(responseText);

    const itemId = result.AddItemResponse?.[0]?.ItemID?.[0];
    const errors = result.AddItemResponse?.[0]?.Errors;

    if (itemId) {
      return {
        success: true,
        itemId: itemId,
        url: `https://www.ebay.co.uk/itm/${itemId}`,
      };
    } else if (errors && errors.length > 0) {
      const errorMsg =
        errors[0].LongMessage?.[0] || errors[0].ShortMessage?.[0] || 'eBay posting failed';
      throw new Error(errorMsg);
    } else {
      throw new Error('eBay posting failed - no item ID returned');
    }
  } catch (error) {
    logger.error('eBay posting error:', { error: error.message });
    throw error;
  }
}

// Phase 4: Stock Image Finder - Find official manufacturer product images
async function findStockImage(listing, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Build search query from identified product
    const searchQuery = `${listing.brand} ${listing.title}`.trim();

    const stockImagePrompt = `Using Google Search, find a direct URL to an official manufacturer stock product image.

**Search Query:**
Product: '${listing.title}'
Brand: '${listing.brand}'
${listing.modelCodes && listing.modelCodes.length > 0 ? `Model Code: ${listing.modelCodes[0]}` : ''}

**Requirements:**

1. **Source authenticity:**
   - Official brand website (${listing.brand}.com, etc.)
   - Authorized retailer (JD Sports, Footasylum, etc.)
   - Manufacturer product database
   - Verified e-commerce platforms (Amazon, official brand stores)

2. **Image quality:**
   - High resolution (minimum 1000px width)
   - Clean background (white, light grey, or neutral)
   - Professional product photography
   - Clear, sharp, well-lit

3. **Product match:**
   - EXACT model match (not similar/close)
   - Correct color/variant if specified
   - Same edition/year if applicable

4. **URL format:**
   - Direct image link ending in: .jpg, .jpeg, .png, .webp
   - Not a webpage URL
   - Accessible without authentication
   - CDN URLs are acceptable (e.g., cdn.example.com/images/...)

**Search Strategy:**
1. Search: "${searchQuery} official product image"
2. Search: "${listing.brand} ${listing.title} stock photo"
3. Search: "${listing.brand} ${listing.title} product image site:${listing.brand.toLowerCase()}.com"
4. Look for official brand websites first
5. Check major UK retailers (JD Sports, Footasylum, etc.)

**Output Format - Return ONLY valid JSON:**
{
  "stockImageUrl": "direct image URL or null",
  "source": "where the image was found (e.g., 'Nike.com', 'JD Sports')",
  "confidence": "HIGH/MEDIUM/LOW",
  "alternatives": ["alternative URL 1", "alternative URL 2"]
}

**CRITICAL RULES:**
- Return ONLY the JSON object, no markdown, no explanation
- If found: Return direct image URL
- If not found: Return null for stockImageUrl
- Include up to 2 alternative URLs if primary not found
- Confidence HIGH if from official brand site, MEDIUM if from retailer, LOW if from third party`;

    logger.info('Phase 4: Finding stock image:', { searchQuery });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: stockImagePrompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for precise URL extraction
          topP: 0.8,
          topK: 20,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Stock image API request failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Extract URLs from Google Search grounding if available
      const groundingMetadata = data.candidates[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        const imageUrls = [];
        groundingMetadata.groundingChunks.forEach((chunk) => {
          if (chunk.web?.uri) {
            // Check if URL is a direct image link
            const url = chunk.web.uri;
            if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
              imageUrls.push(url);
            } else if (url.includes('image') || url.includes('product')) {
              // Could be a product page - note it but don't use directly
              if (!result.stockImageUrl && imageUrls.length === 0) {
                result.pageUrl = url; // Store page URL as fallback
              }
            }
          }
        });

        // Use first image URL from grounding if we found one
        if (imageUrls.length > 0 && !result.stockImageUrl) {
          result.stockImageUrl = imageUrls[0];
          result.source = 'Google Search';
          result.confidence = 'MEDIUM';
        }
      }

      logger.info('Stock image found:', {
        found: !!result.stockImageUrl,
        confidence: result.confidence,
      });
      return result;
    } else {
      logger.warn('No JSON found in stock image response');
      return {
        stockImageUrl: null,
        source: null,
        confidence: 'LOW',
        alternatives: [],
      };
    }
  } catch (error) {
    logger.error('Stock image search error:', { error: error.message });
    return {
      stockImageUrl: null,
      source: null,
      confidence: 'LOW',
      alternatives: [],
    };
  }
}

// Phase 3: Google Cloud Vision API - Visual product recognition
async function recognizeProductWithVision(images, apiKey) {
  try {
    // Use Google Cloud Vision API for product recognition
    // Note: This requires GOOGLE_VISION_API_KEY in .env (different from Gemini API key)
    const visionApiKey = process.env.GOOGLE_VISION_API_KEY || apiKey; // Fallback to Gemini key if Vision key not set

    // For now, we'll use Gemini Vision with a specialized recognition prompt
    // In production, you'd use actual Google Cloud Vision API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const visionPrompt = `You are a specialized product recognition system using Google Vision capabilities. Analyze the product images to identify the exact product model, product line, and visual features.

**CRITICAL INSTRUCTIONS:**
1. Identify the product from VISUAL features (design, logos, patterns, materials, construction)
2. Recognize brand logos and wordmarks visible on the product
3. Identify product line characteristics (e.g., Tech Fleece fabric texture, Air Jordan silhouette, etc.)
4. Note distinctive design elements that identify the specific model
5. Compare visual features to known product lines

**Output Format - Return ONLY valid JSON:**
{
  "visualBrand": "brand identified from logos/visual features",
  "productLine": "specific product line identified (e.g., Tech Fleece, Air Jordan 1 Mid, Air Max 90)",
  "modelName": "specific model name if identifiable",
  "visualFeatures": ["list of distinctive visual features"],
  "logoMatches": ["brands/logos visible on the product"],
  "designElements": ["distinctive design patterns, materials, construction details"],
  "confidence": "HIGH/MEDIUM/LOW based on visual clarity",
  "productMatch": "best match product name if identifiable"
}

**CRITICAL RULES:**
- Focus on VISUAL identification - logos, design patterns, materials
- Identify product lines from distinctive visual features (Tech Fleece texture, Air Jordan silhouette, etc.)
- Be specific: "Tech Fleece Jacket" not just "Jacket"
- If you see Nike Tech Fleece fabric characteristics, identify it as Tech Fleece
- Match visual features to known product lines

Return ONLY the JSON object. No markdown, no explanation, no other text.`;

    // Use the first image for visual recognition (or combine multiple)
    const parts = [{ text: visionPrompt }, ...images.slice(0, 2).map(prepareImageForGemini)];

    logger.info('Phase 3: Google Vision product recognition:', {
      imageCount: Math.min(images.length, 2),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for accurate recognition
          topP: 0.85,
          topK: 30,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API request failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const recognized = JSON.parse(jsonMatch[0]);
      logger.info('Vision recognition complete:', {
        visualBrand: recognized.visualBrand,
        productLine: recognized.productLine,
        confidence: recognized.confidence,
      });
      return recognized;
    } else {
      logger.warn('No JSON found in vision response, falling back to empty structure');
      return {
        visualBrand: null,
        productLine: null,
        modelName: null,
        visualFeatures: [],
        logoMatches: [],
        designElements: [],
        confidence: 'LOW',
        productMatch: null,
      };
    }
  } catch (error) {
    logger.error('Vision recognition error:', { error: error.message });
    // Return empty structure on error
    return {
      visualBrand: null,
      productLine: null,
      modelName: null,
      visualFeatures: [],
      logoMatches: [],
      designElements: [],
      confidence: 'LOW',
      productMatch: null,
    };
  }
}

// Intensive parsing engine - Extract ALL codes and text from images FIRST
async function parseProductCodes(images, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const parsingPrompt = `You are a specialized OCR and code extraction system. Your ONLY job is to extract ALL visible text, codes, and identifiers from product tags and labels.

**CRITICAL INSTRUCTIONS:**
1. Read EVERY line of text on EVERY tag/label in ALL images
2. Extract ALL codes you see - don't stop at the first one
3. Categorize codes by type:
   - MODEL CODES: Format like CK0697-010, DM0029-100, AJ1234 (usually shorter, alphanumeric with dashes)
   - STYLE CODES: Format like SP200710EAG, longer alphanumeric strings
   - SKU NUMBERS: Long numeric strings like 19315498680
   - SIZE MARKINGS: UK 10, M, L, 32W 32L, 50ml, 100ml, etc.
   - BRAND NAMES: Exact brand as it appears
   - OTHER TEXT: Any other text on tags

4. **READ EVERY LINE**: Tags often have multiple codes on different lines - extract them ALL
5. **BE SYSTEMATIC**: Go through each image, each tag, each line methodically

**Output Format - Return ONLY valid JSON:**
{
  "brand": "exact brand name from labels",
  "modelCodes": ["CK0697-010", "any other model codes"],
  "styleCodes": ["SP200710EAG", "any other style codes"],
  "skuNumbers": ["19315498680", "any other SKUs"],
  "size": "size if visible (e.g., L, UK 10, 50ml)",
  "allText": ["every line of text you can read from tags"],
  "tagLocations": ["description of where each tag was found"]
}

**CRITICAL RULES:**
- If you see "SP200710EAG" AND "CK0697-010" on the same tag, include BOTH
- If you see multiple codes, list them ALL in the appropriate arrays
- Extract text line by line - don't skip any lines
- Be precise - copy codes exactly as they appear
- If a code is partially visible, note it but don't guess missing characters

Return ONLY the JSON object. No markdown, no explanation, no other text.`;

    const parts = [{ text: parsingPrompt }, ...images.map(prepareImageForGemini)];

    logger.info('Phase 1: Intensive code parsing:', { imageCount: images.length });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for precise extraction
          topP: 0.8,
          topK: 20,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Parsing API request failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      logger.info('Parsed codes:', {
        brand: parsed.brand,
        modelCodes: parsed.modelCodes?.length || 0,
        styleCodes: parsed.styleCodes?.length || 0,
        skuNumbers: parsed.skuNumbers?.length || 0,
        size: parsed.size,
      });
      return parsed;
    } else {
      logger.warn('No JSON found in parsing response, falling back to empty structure');
      return {
        brand: null,
        modelCodes: [],
        styleCodes: [],
        skuNumbers: [],
        size: null,
        allText: [],
        tagLocations: [],
      };
    }
  } catch (error) {
    logger.error('Code parsing error:', { error: error.message });
    // Return empty structure on error - main AI will still work
    return {
      brand: null,
      modelCodes: [],
      styleCodes: [],
      skuNumbers: [],
      size: null,
      allText: [],
      tagLocations: [],
    };
  }
}

// Helper: Prepare image for Gemini API (handles both base64 and URLs)
function prepareImageForGemini(image) {
  // Validate input
  if (!image || typeof image !== 'string') {
    throw new Error('Invalid image: must be a non-empty string');
  }

  // Validate base64 format (we only accept base64 now, not URLs)
  if (!image.startsWith('data:image')) {
    throw new Error(
      `Invalid image format: expected base64 data URI, got: ${image.substring(0, 50)}...`
    );
  }

  // Safely extract base64 data
  const parts = image.split(',');
  if (parts.length !== 2) {
    throw new Error(`Invalid base64 format: missing comma separator in data URI`);
  }

  const base64Data = parts[1];
  if (!base64Data || base64Data.trim().length === 0) {
    throw new Error(`Invalid base64 format: empty data after comma`);
  }

  return {
    inline_data: {
      mime_type: 'image/jpeg',
      data: base64Data,
    },
  };
}

// Feature 3: Image Quality Scoring - Analyze image quality for marketplace listings
async function analyzeImageQuality(imageBase64, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const qualityPrompt = `Analyze this product image for marketplace listing quality AND condition/damage.

**PART 1: IMAGE QUALITY**
Evaluate on these criteria (score 0-10 for each):

1. SHARPNESS/FOCUS
   - Is the product clearly in focus?
   - Any motion blur or camera shake?
   - Score 0-10: ____

2. LIGHTING
   - Is the product well-lit?
   - Any harsh shadows or overexposure?
   - Score 0-10: ____

3. BACKGROUND
   - Is background clean/uncluttered?
   - Any distracting elements?
   - Score 0-10: ____

4. COMPOSITION
   - Is product centered and properly framed?
   - Is entire product visible?
   - Score 0-10: ____

5. ANGLE/VIEW
   - Does this angle show product well?
   - What views are missing?
   - Score 0-10: ____

CRITICAL PHOTO DEFECTS (Yes/No):
- Motion blur:
- Extreme darkness:
- Product cut off:
- Watermark present:
- Text overlay:

**PART 2: PRODUCT CONDITION & DAMAGE**
Carefully inspect the product for any visible damage, wear, or imperfections:

CONDITION ASSESSMENT:
- Overall condition: (New/Like New/Excellent/Good/Fair/Poor)
- Visible damage present: (Yes/No)
- Wear level: (None/Minimal/Moderate/Heavy)

SPECIFIC DAMAGE/DEFECTS FOUND:
List ALL visible issues such as:
- Scratches, scuffs, or marks
- Stains, discoloration, or fading
- Tears, holes, or fraying
- Dents, chips, or cracks
- Missing parts or accessories
- Worn soles, heels, or treads (for shoes)
- Pilling, loose threads (for clothing)
- Any other imperfections

Return JSON:
{
  "overallScore": 0-100,
  "sharpness": 0-10,
  "lighting": 0-10,
  "background": 0-10,
  "composition": 0-10,
  "angle": 0-10,
  "criticalIssues": ["issue1", "issue2"],
  "recommendations": [
    "Specific actionable suggestion",
    "Another improvement"
  ],
  "passesMinimumQuality": true/false,
  "condition": {
    "overall": "New|Like New|Excellent|Good|Fair|Poor",
    "hasDamage": true/false,
    "wearLevel": "None|Minimal|Moderate|Heavy",
    "defects": [
      "Specific defect description",
      "Another defect"
    ],
    "conditionSummary": "Brief 1-2 sentence summary of condition suitable for listing"
  }
}

Return ONLY the JSON object. No markdown, no explanation, no other text.`;

    const parts = [{ text: qualityPrompt }, prepareImageForGemini(imageBase64)];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for consistent scoring
          topP: 0.8,
          topK: 20,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Quality analysis API request failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const qualityData = JSON.parse(jsonMatch[0]);

      // Calculate overall score if not provided
      if (!qualityData.overallScore) {
        const scores = [
          qualityData.sharpness || 0,
          qualityData.lighting || 0,
          qualityData.background || 0,
          qualityData.composition || 0,
          qualityData.angle || 0,
        ];
        qualityData.overallScore = Math.round(
          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
        );
      }

      // Set minimum quality threshold
      qualityData.passesMinimumQuality = qualityData.overallScore >= 60;

      logger.info('Image quality analysis complete:', {
        overallScore: qualityData.overallScore,
        passesMinimumQuality: qualityData.passesMinimumQuality,
        criticalIssues: qualityData.criticalIssues?.length || 0,
      });

      return qualityData;
    } else {
      logger.warn('No JSON found in quality analysis response');
      return {
        overallScore: 70,
        sharpness: 7,
        lighting: 7,
        background: 7,
        composition: 7,
        angle: 7,
        criticalIssues: [],
        recommendations: [],
        passesMinimumQuality: true,
        condition: {
          overall: 'Good',
          hasDamage: false,
          wearLevel: 'Minimal',
          defects: [],
          conditionSummary: 'Unable to fully assess condition from this image.',
        },
      };
    }
  } catch (error) {
    logger.error('Image quality analysis error:', { error: error.message });
    // Return default passing score on error - don't block listing generation
    return {
      overallScore: 70,
      sharpness: 7,
      lighting: 7,
      background: 7,
      composition: 7,
      angle: 7,
      criticalIssues: [],
      recommendations: [],
      passesMinimumQuality: true,
      condition: {
        overall: 'Good',
        hasDamage: false,
        wearLevel: 'Minimal',
        defects: [],
        conditionSummary: 'Unable to fully assess condition from this image.',
      },
      error: error.message,
    };
  }
}

// ============================================================================
// CLOUDINARY IMAGE UPLOAD
// ============================================================================

/**
 * Helper function to upload images to Cloudinary
 * @param {string} base64Data - Base64 encoded image data (with data:image prefix)
 * @param {string} userId - User ID for organizing images in folders
 * @returns {Promise<Object>} Upload result with URLs
 */
async function uploadToCloudinary(base64Data, userId) {
  try {
    // Validate input
    if (!base64Data || typeof base64Data !== 'string') {
      throw new Error('Invalid image data');
    }

    if (!base64Data.startsWith('data:image')) {
      throw new Error('Image must be in base64 format with data:image prefix');
    }

    // Validate Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary is not configured');
    }

    logger.info('Starting Cloudinary upload:', {
      userId,
      imageSize: base64Data.length,
      imageType: base64Data.substring(0, 30),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });

    // Upload to Cloudinary with basic transformations (free tier compatible)
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder: `quicklist/${userId}`,
      transformation: [
        {
          width: 1200,
          crop: 'limit', // Don't upscale, only downscale if larger
          quality: 'auto',
          fetch_format: 'auto', // Automatically serve WebP if supported
        },
      ],
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    });

    // Generate thumbnail URL using Cloudinary transformations
    const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
      transformation: [
        {
          width: 300,
          height: 300,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    });

    logger.info('Image uploaded to Cloudinary', {
      userId,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    });

    return {
      success: true,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      thumbnailUrl,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', {
      error: error.message,
      errorName: error.name,
      errorStack: error.stack,
      errorCode: error.error?.code || error.http_code,
      errorDetails: error.error || {},
      userId,
      cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });
    throw error;
  }
}

/**
 * POST /api/images/upload
 * Upload an image to Cloudinary
 * Body: { image: "data:image/jpeg;base64,..." }
 * Returns: { publicId, url, thumbnailUrl, format, width, height, bytes }
 */
app.post('/api/images/upload', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    const userId = req.user.id;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image data required' });
    }

    if (!image.startsWith('data:image')) {
      return res.status(400).json({
        error: 'Invalid image format. Must be base64 encoded with data:image prefix',
      });
    }

    // Validate image size (max 10MB for base64)
    const maxImageSize = 10 * 1024 * 1024;
    const base64Size = (image.length * 3) / 4; // Approximate decoded size
    if (base64Size > maxImageSize) {
      return res.status(400).json({
        error: 'Image too large. Maximum size is 10MB',
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(image, userId);

    logger.info('Image upload successful', {
      userId,
      publicId: result.publicId,
      requestId: req.id,
    });

    res.json(result);
  } catch (error) {
    logger.error('Image upload endpoint error:', {
      error: error.message,
      userId: req.user.id,
      requestId: req.id,
    });

    if (error.message.includes('not configured')) {
      return res.status(503).json({
        error: 'Image upload service is not available',
      });
    }

    res.status(500).json({
      error: 'Failed to upload image',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/images/:publicId
 * Delete an image from Cloudinary
 * URL format: /api/images/quicklist%2F123%2Fabc123def456
 * (publicId should be URL-encoded, e.g., quicklist/123/abc123def456 -> quicklist%2F123%2Fabc123def456)
 * Returns: { success: true, message: "Image deleted successfully" }
 */
app.delete('/api/images/:publicId(*)', authenticateToken, async (req, res) => {
  try {
    const publicId = req.params.publicId;
    const userId = req.user.id;

    if (!publicId) {
      return res.status(400).json({ error: 'Public ID required' });
    }

    // Verify the image belongs to this user (check folder path)
    const expectedPrefix = `quicklist/${userId}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      return res.status(403).json({
        error: 'You do not have permission to delete this image',
      });
    }

    // Delete from Cloudinary
    const deleteResult = await cloudinary.uploader.destroy(publicId);

    if (deleteResult.result === 'ok') {
      logger.info('Image deleted from Cloudinary', {
        userId,
        publicId,
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } else if (deleteResult.result === 'not found') {
      return res.status(404).json({
        error: 'Image not found',
      });
    } else {
      throw new Error(`Unexpected delete result: ${deleteResult.result}`);
    }
  } catch (error) {
    logger.error('Image delete endpoint error:', {
      error: error.message,
      userId: req.user.id,
      publicId: req.params.publicId,
      requestId: req.id,
    });

    res.status(500).json({
      error: 'Failed to delete image',
      details: error.message,
    });
  }
});

// Feature 4: eBay Pricing Intelligence
// Note: The ebay-api package doesn't export a direct constructor
// We'll use axios directly for eBay API calls instead
const eBayConstants = require('ebay-api');

// eBay configuration object (no direct client initialization needed)
const ebayConfig = {
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  devId: process.env.EBAY_DEV_ID,
  authToken: process.env.EBAY_AUTH_TOKEN,
  sandbox: process.env.EBAY_SANDBOX === 'true',
  siteId: process.env.EBAY_SITE_ID || '3',
};

// Helper functions for pricing calculations
function calculateAverage(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function calculateMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculatePercentile(arr, percentile) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

function calculateDistribution(prices) {
  const buckets = [0, 10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000];
  const distribution = {};

  buckets.forEach((bucket, i) => {
    const next = buckets[i + 1] || Infinity;
    const count = prices.filter((p) => p >= bucket && p < next).length;
    distribution[`${bucket}-${next === Infinity ? '+' : next}`] = count;
  });

  return distribution;
}

// Note: The duplicate getEbayPricingIntelligence function has been removed
// The actual function is defined at line 1056

// Feature 5: Predictive Pricing Engine
function getConditionMultiplier(condition) {
  const multipliers = {
    New: 1.0,
    'Like New': 0.9,
    Excellent: 0.85,
    'Very Good': 0.75,
    Good: 0.65,
    Fair: 0.5,
    Poor: 0.35,
  };
  return multipliers[condition] || 0.7;
}

async function predictOptimalPrice(listing, ebayData, imageQuality = 70) {
  if (!ebayData || !ebayData.soldPrices) {
    return null;
  }

  // Features for prediction
  const features = {
    soldCount: ebayData.soldCount,
    unsoldCount: ebayData.unsoldCount,
    sellThroughRate: ebayData.sellThroughRate,
    medianSoldPrice: ebayData.soldPrices.median,
    avgSoldPrice: ebayData.soldPrices.average,
    priceSpread: ebayData.soldPrices.max - ebayData.soldPrices.min,

    // Listing quality factors
    imageQuality: imageQuality,
    descriptionLength: listing.description?.length || 0,
    keywordCount: listing.keywords?.length || 0,

    // Condition factor
    conditionMultiplier: getConditionMultiplier(listing.condition),
  };

  // Simple ML-based prediction (can be replaced with trained model later)
  let predictedPrice = features.medianSoldPrice;

  // Adjust based on condition
  predictedPrice *= features.conditionMultiplier;

  // Adjust based on listing quality (image quality affects price)
  const qualityFactor = 0.9 + (features.imageQuality / 100) * 0.2; // 90% to 110% based on quality
  predictedPrice *= qualityFactor;

  // Market demand adjustment
  if (features.sellThroughRate > 0.7) {
    predictedPrice *= 1.05; // High demand, can price higher
  } else if (features.sellThroughRate < 0.3) {
    predictedPrice *= 0.95; // Low demand, price competitively
  }

  // Calculate confidence based on data quality
  const confidence = Math.min(
    (features.soldCount / 20) * 100, // More sold items = more confidence
    100
  );

  return {
    recommendedPrice: Math.round(predictedPrice * 100) / 100,
    priceRange: {
      min: Math.round(predictedPrice * 0.85 * 100) / 100,
      max: Math.round(predictedPrice * 1.15 * 100) / 100,
    },
    confidence: Math.round(confidence),
    reasoning: [
      `Based on ${features.soldCount} sold listings`,
      `Median sold price: £${features.medianSoldPrice.toFixed(2)}`,
      `Sell-through rate: ${(features.sellThroughRate * 100).toFixed(0)}%`,
      features.sellThroughRate > 0.7
        ? 'High demand - premium pricing possible'
        : features.sellThroughRate < 0.3
          ? 'Low demand - competitive pricing recommended'
          : 'Moderate demand - balanced pricing recommended',
      `Adjusted for ${listing.condition} condition (${(features.conditionMultiplier * 100).toFixed(0)}% of new)`,
      `Image quality factor: ${((qualityFactor - 1) * 100).toFixed(0) >= 0 ? '+' : ''}${((qualityFactor - 1) * 100).toFixed(0)}%`,
    ],
    marketInsights: {
      demand:
        features.sellThroughRate > 0.7 ? 'HIGH' : features.sellThroughRate > 0.4 ? 'MEDIUM' : 'LOW',
      competition: features.unsoldCount > features.soldCount ? 'HIGH' : 'MODERATE',
      trend: 'STABLE', // Would require time-series data
      recommendedAction:
        features.sellThroughRate > 0.6
          ? 'List now - high demand'
          : 'Consider waiting or improving listing',
    },
  };
}

// Image quality analysis endpoint (for pre-upload feedback)
app.post('/api/analyze-image-quality', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // Validate image size (max 5MB)
    const maxImageSize = 5 * 1024 * 1024;
    const base64Size = (image.length * 3) / 4;
    if (base64Size > maxImageSize) {
      return res.status(400).json({ error: 'Image too large. Max 5MB per image' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Analyze image quality and damage/condition
    const qualityData = await analyzeImageQuality(image, apiKey);

    logger.info('Image quality analysis complete', {
      userId: req.user?.id,
      overallScore: qualityData.overallScore,
      passesMinimumQuality: qualityData.passesMinimumQuality,
    });

    res.json(qualityData);
  } catch (error) {
    logger.error('Image quality analysis error:', {
      userId: req.user?.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to analyze image quality',
      details: error.message,
    });
  }
});

// AI generation endpoint
app.post('/api/generate', generateLimiter, authenticateToken, async (req, res) => {
  const userId = req.user?.id; // Define at function scope for error logging
  try {
    // Log request body for debugging
    logger.info('Generate endpoint called:', {
      userId,
      hasImages: !!req.body?.images,
      imageCount: req.body?.images?.length,
      platform: req.body?.platform,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { images, platform, hint, itemModel, conditionInfo } = req.body;

    // Validate images
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image required' });
    }

    // Validate image count
    if (images.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 images allowed' });
    }

    // Validate image format - accept both base64 and Cloudinary URLs
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      // Type checks with specific error messages
      if (img === null) {
        return res.status(400).json({
          error: `Image ${i + 1} is null`,
          imageIndex: i,
        });
      }

      if (img === undefined) {
        return res.status(400).json({
          error: `Image ${i + 1} is undefined`,
          imageIndex: i,
        });
      }

      if (typeof img !== 'string') {
        return res.status(400).json({
          error: `Image ${i + 1} has invalid type: ${typeof img}. Expected string.`,
          imageIndex: i,
        });
      }

      // Empty string check
      if (img.trim().length === 0) {
        return res.status(400).json({
          error: `Image ${i + 1} is empty`,
          imageIndex: i,
        });
      }

      // Accept either base64 data URIs or Cloudinary URLs
      const isBase64 = img.startsWith('data:image');
      const isCloudinaryUrl =
        img.startsWith('https://res.cloudinary.com/') ||
        img.startsWith('http://res.cloudinary.com/');

      if (!isBase64 && !isCloudinaryUrl) {
        return res.status(400).json({
          error: `Image ${i + 1} has invalid format. Must be base64 data URI (starting with "data:image") or Cloudinary URL (starting with "https://res.cloudinary.com/")`,
          imageIndex: i,
          receivedPrefix: img.substring(0, 50),
          receivedLength: img.length,
        });
      }

      // Base64 validation
      if (isBase64) {
        // Check for comma separator
        if (!img.includes(',')) {
          return res.status(400).json({
            error: `Image ${i + 1} is malformed base64: missing comma separator`,
            imageIndex: i,
          });
        }

        const parts = img.split(',');
        if (parts.length !== 2 || !parts[1] || parts[1].trim().length === 0) {
          return res.status(400).json({
            error: `Image ${i + 1} is malformed base64: empty data after comma`,
            imageIndex: i,
          });
        }

        // Size check
        const base64Size = (img.length * 3) / 4;
        if (base64Size > maxImageSize) {
          return res.status(400).json({
            error: `Image ${i + 1} too large: ${Math.round(base64Size / 1024 / 1024)}MB. Max 5MB per image`,
            imageIndex: i,
          });
        }
      }
    }

    // Check usage limits before generation
    const limit = await getPlanLimit(userId);
    let currentUsage = 0;

    try {
      const periodStart = new Date();
      periodStart.setDate(1); // First day of month
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const usageResult = await pool.query(
        `SELECT ai_generations FROM usage_tracking
                 WHERE user_id = $1 AND period_start >= $2 AND period_start < $3
                 ORDER BY period_start DESC LIMIT 1`,
        [userId, periodStart, periodEnd]
      );
      currentUsage = usageResult.rows[0]?.ai_generations || 0;

      if (currentUsage >= limit) {
        return res.status(403).json({
          error: 'Plan limit exceeded',
          limit,
          currentUsage,
        });
      }
    } catch (error) {
      // If usage_tracking table doesn't exist or column is missing, allow generation (treat as no usage)
      if (error.code !== '42P01' && error.code !== '42703') {
        // 42P01 = relation does not exist, 42703 = column does not exist
        logger.error('Usage check error:', { error: error.message, code: error.code, userId });
        // Don't block generation on usage tracking errors
      } else {
        logger.warn('usage_tracking table or column not found, skipping usage check', {
          userId,
          errorCode: error.code,
        });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    // Using Gemini 2.0 Flash (stable) - Best for OCR/label reading as of Nov 2025
    // Research shows 2.0 Flash excels at text extraction from product labels
    // Gemini 2.5 models have worse OCR quality vs 2.0 Flash for straightforward text extraction
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // PHASE 1, 3 & Quality: Run code parsing, vision recognition, and quality analysis IN PARALLEL for speed
    logger.info('Starting parallel processing:', { userId, imageCount: images.length, platform });

    // Analyze quality of all images in parallel
    const qualityPromises = images.map((img) => analyzeImageQuality(img, apiKey));

    const [parsedCodes, visionRecognition, qualityAnalysis] = await Promise.all([
      parseProductCodes(images, apiKey),
      recognizeProductWithVision(images, apiKey),
      Promise.all(qualityPromises),
    ]);
    logger.info('Parallel processing complete');

    // Calculate overall quality score across all images
    const avgQualityScore =
      qualityAnalysis.reduce((sum, q) => sum + (q.overallScore || 0), 0) / qualityAnalysis.length;
    const criticalIssues = qualityAnalysis.flatMap((q) => q.criticalIssues || []);
    const allRecommendations = qualityAnalysis.flatMap((q) => q.recommendations || []);

    logger.info('Image quality summary:', {
      avgScore: avgQualityScore,
      criticalIssues: criticalIssues.length,
      recommendations: allRecommendations.length,
    });

    // Build structured code information for the main prompt
    const codeInfo = [];
    if (parsedCodes.modelCodes && parsedCodes.modelCodes.length > 0) {
      codeInfo.push(`MODEL CODES (PRIMARY): ${parsedCodes.modelCodes.join(', ')}`);
    }
    if (parsedCodes.styleCodes && parsedCodes.styleCodes.length > 0) {
      codeInfo.push(`STYLE CODES (SECONDARY): ${parsedCodes.styleCodes.join(', ')}`);
    }
    if (parsedCodes.skuNumbers && parsedCodes.skuNumbers.length > 0) {
      codeInfo.push(`SKU NUMBERS: ${parsedCodes.skuNumbers.join(', ')}`);
    }
    if (parsedCodes.size) {
      codeInfo.push(`SIZE: ${parsedCodes.size}`);
    }
    if (parsedCodes.allText && parsedCodes.allText.length > 0) {
      codeInfo.push(`ALL TEXT FROM TAGS: ${parsedCodes.allText.join(' | ')}`);
    }

    // Build vision recognition information
    const visionInfo = [];
    if (visionRecognition.visualBrand) {
      visionInfo.push(`VISUAL BRAND: ${visionRecognition.visualBrand}`);
    }
    if (visionRecognition.productLine) {
      visionInfo.push(`PRODUCT LINE (VISUAL): ${visionRecognition.productLine}`);
    }
    if (visionRecognition.modelName) {
      visionInfo.push(`MODEL NAME (VISUAL): ${visionRecognition.modelName}`);
    }
    if (visionRecognition.visualFeatures && visionRecognition.visualFeatures.length > 0) {
      visionInfo.push(`VISUAL FEATURES: ${visionRecognition.visualFeatures.join(', ')}`);
    }
    if (visionRecognition.logoMatches && visionRecognition.logoMatches.length > 0) {
      visionInfo.push(`LOGOS VISIBLE: ${visionRecognition.logoMatches.join(', ')}`);
    }
    if (visionRecognition.designElements && visionRecognition.designElements.length > 0) {
      visionInfo.push(`DESIGN ELEMENTS: ${visionRecognition.designElements.join(', ')}`);
    }
    if (visionRecognition.productMatch) {
      visionInfo.push(`VISUAL PRODUCT MATCH: ${visionRecognition.productMatch}`);
    }
    visionInfo.push(`CONFIDENCE: ${visionRecognition.confidence}`);

    const extractedCodesSection =
      codeInfo.length > 0
        ? `\n**EXTRACTED CODES AND TEXT (FROM PHASE 1 - INTENSIVE PARSING):**\n${codeInfo.join('\n')}\n\n**CRITICAL**: The above codes were extracted from the tags. You MUST use these codes to identify the exact product:\n- Use MODEL CODES (CK0697-010 format) as PRIMARY identifier in Google Search\n- Use STYLE CODES (SP200710EAG format) as SECONDARY if model code doesn't work\n- Verify ALL codes match the product you identify\n- If codes are provided, you MUST identify the specific product line (e.g., Tech Fleece, not just "Jacket")\n`
        : '\n**NOTE**: No codes were extracted in parsing phase. Read tags carefully and extract all codes yourself.\n';

    const visionSection =
      visionInfo.length > 0
        ? `\n**VISUAL PRODUCT RECOGNITION (FROM PHASE 3 - GOOGLE VISION):**\n${visionInfo.join('\n')}\n\n**CRITICAL**: The above visual recognition was performed by Google Vision API:\n- Use VISUAL BRAND and PRODUCT LINE to validate/cross-reference with codes from Phase 1\n- If vision identifies "Tech Fleece" and codes match, you have HIGH confidence\n- If vision and codes conflict, prioritize codes (tags are more reliable)\n- Use visual features to enhance product description\n- Visual recognition helps identify product lines when codes are unclear\n`
        : '\n**NOTE**: Visual recognition did not identify product clearly. Rely on code extraction.\n';

    // Build condition analysis section from quality analysis
    const aiConditionAnalysis = [];
    const conditionData = qualityAnalysis.filter((q) => q.condition).map((q) => q.condition);
    if (conditionData.length > 0) {
      // Find the most damaged/worst condition across all images
      const worstCondition = conditionData.reduce((worst, curr) => {
        const conditionRank = { New: 6, 'Like New': 5, Excellent: 4, Good: 3, Fair: 2, Poor: 1 };
        return (conditionRank[curr.overall] || 3) < (conditionRank[worst.overall] || 3)
          ? curr
          : worst;
      }, conditionData[0]);

      aiConditionAnalysis.push(`OVERALL CONDITION: ${worstCondition.overall}`);
      aiConditionAnalysis.push(`WEAR LEVEL: ${worstCondition.wearLevel}`);
      if (worstCondition.hasDamage && worstCondition.defects && worstCondition.defects.length > 0) {
        aiConditionAnalysis.push(
          `VISIBLE DEFECTS:\n${worstCondition.defects.map((d) => `  - ${d}`).join('\n')}`
        );
      }
      if (worstCondition.conditionSummary) {
        aiConditionAnalysis.push(`CONDITION SUMMARY: ${worstCondition.conditionSummary}`);
      }
    }

    const conditionSection =
      aiConditionAnalysis.length > 0
        ? `\n**PRODUCT CONDITION ANALYSIS (FROM AI INSPECTION):**\n${aiConditionAnalysis.join('\n')}\n\n**CRITICAL**: The above condition assessment was performed by AI analysis:\n- Use this information to accurately populate the "condition" field\n- Include all defects in the listing description\n- Be honest about condition - this builds buyer trust\n- If damage is present, describe it clearly and specifically\n`
        : '';

    // Improved system prompt v3.0 - See SYSTEM-PROMPTS.md for details
    const itemModelHint = itemModel
      ? `\n🔴 **CRITICAL: USER-PROVIDED ITEM NAME/MODEL** 🔴\nThe user has specified the item as: "${itemModel}"\n\n**MANDATORY**:\n- Use this as your PRIMARY guide for product identification\n- Search for this exact model/name to find specifications\n- Cross-reference with visible codes and labels to find the exact variant\n- Include this model/name prominently in the title and description\n\n`
      : '';

    const conditionHint = conditionInfo
      ? `\n🔴 **CRITICAL: USER-PROVIDED CONDITION INFO** 🔴\nThe user has specified: "${conditionInfo}"\n\n**MANDATORY**:\n- Include this information in the condition assessment\n- Detail this prominently in the Condition section\n- Be honest and specific about these condition details\n\n`
      : '';

    const userInfoHint = hint
      ? `\n🔴 **USER-PROVIDED ADDITIONAL INFO** 🔴\nAdditional user notes: "${hint}"\n\n**Include this information appropriately in your listing description**\n\n`
      : '';

    const prompt = `${itemModelHint}${conditionHint}${userInfoHint}${extractedCodesSection}${visionSection}${conditionSection}You are an expert e-commerce listing specialist for the UK resale market. Your PRIMARY goal is to accurately identify the item by reading ALL visible text and labels in ALL the images provided.

**THREE-PHASE IDENTIFICATION SYSTEM:**
- **Phase 1 (Code Parsing)**: Extracted codes from tags - USE THESE AS PRIMARY IDENTIFIERS
- **Phase 3 (Vision Recognition)**: Visual product identification - USE TO VALIDATE AND ENHANCE
- **Your Task**: Cross-reference codes with visual recognition to identify the EXACT product

**IMPORTANT: You will receive MULTIPLE images of the same item from different angles. Analyze ALL images to get the complete picture.**

**CRITICAL: TEXT AND LABEL READING PRIORITY**

Before making ANY assumptions about the item, you MUST:

1. **READ EVERY LABEL AND TAG FIRST** (This is your PRIMARY source of truth - check ALL images):
   - Brand logos and wordmarks on the item itself
   - Size tags (usually inside collar, waistband, or tongue)
   - Care labels (washing instructions often have brand name)
   - Product name tags or labels
   - **CRITICAL: Read ALL codes on tags - there may be multiple codes (style codes, model codes, SKU numbers)**
     * Example: A tag might show "SP200710EAG" AND "CK0697-010" - you MUST check BOTH
     * The model code (often shorter format like CK0697-010) is usually the PRIMARY identifier
     * Style codes (often longer like SP200710EAG) are secondary identifiers
     * SKU numbers (long numeric strings) are tertiary identifiers
     * **CHECK EVERY CODE - don't stop at the first one you see**
   - Material composition tags
   - Country of manufacture labels
   - Hang tags or original packaging text
   - Any printed or embroidered text on the item
   - **ESPECIALLY IMPORTANT: Size/Volume/Capacity markings**
     * Fragrance bottles: "50ml", "100ml", "1.7 FL OZ", "3.4 FL OZ"
     * Clothing: "UK 10", "M", "32W 32L", "EU 42"
     * Shoes: "UK 9", "US 10", "EU 44"
     * Electronics: "256GB", "128GB", storage capacity
     * Any other product-specific size indicators

   **ZOOM IN and READ CAREFULLY across ALL images** - Labels contain the exact product identity.
   **READ ALL CODES ON THE TAG - there may be multiple codes, and the model code (often format like CK0697-010, DM0029-100) is usually the most important for identification.**

2. **Extract ALL visible text from ALL images:**
   - Look at close-up shots of labels in different images
   - Check inside views (collars, waistbands, tongues, insoles)
   - Read any text on boxes, packaging, or tags
   - **CRITICAL: Extract ALL codes you see - don't just grab the first one**
     * Model codes (often format: CK0697-010, DM0029-100, AJ1234) - PRIMARY identifier
     * Style codes (often format: SP200710EAG, longer alphanumeric) - SECONDARY identifier
     * SKU numbers (long numeric: 19315498680) - TERTIARY identifier
     * **Read every line of text on tags - codes may be on different lines**
   - Identify size markings "UK 10", "M", "32W 32L", "50ml", "100ml"
   - Check front, back, side, and detail shots for text
   - **If you see multiple codes, list them ALL and use the model code (CK0697-010 format) as primary**

3. **Physical identification (SECONDARY to labels):**
   - Only use visual design if NO labels are visible
   - Note distinctive patterns, logos, or design elements
   - Identify materials by texture and appearance
   - Observe color combinations and styling

**Item Identification Process - EXACT IDENTIFICATION IS CRUCIAL:**

Step 1: List ALL text you can read from labels and tags - **READ EVERY LINE, EVERY CODE**
   - Extract ALL codes: model codes (CK0697-010), style codes (SP200710EAG), SKU numbers (19315498680)
   - Tags often have MULTIPLE codes - don't stop at the first one
   - Model codes (format like CK0697-010, DM0029-100) are usually the PRIMARY identifier
   - Style codes (format like SP200710EAG, longer alphanumeric) are SECONDARY identifiers
   - **If you see multiple codes, you MUST check ALL of them**

Step 2: **MANDATORY CODE LOOKUP - CHECK ALL CODES**: If you see ANY codes on a tag, you MUST use Google Search to identify the EXACT product line/model name
   - **PRIMARY**: Search using the MODEL CODE first (format like CK0697-010, DM0029-100)
     * Search: "[brand] [model code]" (e.g., "Nike CK0697-010")
     * This is usually the most accurate identifier
   - **SECONDARY**: If model code doesn't yield results, try style code
     * Search: "[brand] [style code]" (e.g., "Nike SP200710EAG")
   - **TERTIARY**: Try combinations if needed
     * Search: "[brand] [model code] [style code]" (e.g., "Nike CK0697-010 SP200710EAG")
   - Identify the SPECIFIC product line (e.g., "Tech Fleece", "Air Jordan 1 Mid", "Air Max 90")
   - DO NOT use generic terms like "jacket" or "trainers" when you can identify the specific product line
   - **The model code (CK0697-010 format) is usually your PRIMARY KEY - use it first!**

Step 3: Use Google Search to verify: Search "[brand] [product line from step 2] [model code]" to confirm exact product
   - Use the model code (CK0697-010) as the primary identifier in your search

Step 4: If labels are unclear or missing, state "Unable to read labels clearly" and provide best visual match with LOW confidence

Step 5: NEVER guess model numbers or style codes that aren't visible

Step 6: **CRITICAL**: If ANY code is visible (model code CK0697-010, style code SP200710EAG, etc.), you MUST:
   - Check ALL codes you see (don't just use one)
   - Use the model code (CK0697-010 format) as PRIMARY identifier
   - Identify it as the specific product line (Tech Fleece, not just "Nike Jacket")

**Identity Confidence Levels:**
- HIGH CONFIDENCE: You can read the brand name, model, AND style code from labels + verified via Google Search
- MEDIUM CONFIDENCE: You can read brand and partial model info from labels
- LOW CONFIDENCE: No readable labels, identification based on visual similarity only

**CRUCIAL:** Exact item identification is the #1 priority. If you cannot identify the EXACT item from labels:
1. State this clearly in the description
2. Provide the closest match you can determine
3. Mark confidence as LOW
4. Use generic pricing ranges

Base your entire listing on what you can READ and VERIFY, not what you THINK you see

3. **Provide (based on label reading):**
   - **title**: Clear, factual title (${platform === 'ebay' ? '80 chars max' : '140 chars max for Vinted/Gumtree'}).
     **REQUIRED FORMAT:** [Brand] [Model/Name] [Colourway] [Size] [Model Number if available]
     **CRITICAL REQUIREMENTS:**
     - Include brand, model/product name, colourway, and size
     - Add model number at the end if available (e.g., "AR0479-001")
     - Keep it clean and factual - avoid marketing language in title
     - Example: "Nike Air Revaderchi Granite Red Plum UK8 AR0479-001"
     - Avoid filler words ("Amazing", "Wow", "Look", "Rare") unless genuinely rare
     - Use natural keyword placement - title should read well
     - ${platform === 'ebay' ? 'eBay: Keep concise, 80 char limit' : 'Vinted/Gumtree: Use full 140 chars for more keywords'}
     Examples:
     * eBay: "Nike Air Jordan 1 Mid White Black UK 10 Leather Trainers DM0029-100"
     * Vinted: "Nike Air Jordan 1 Mid Basketball Trainers UK 10 White Black Leather Retro Sneakers Streetwear"
     * "Acqua di Parma Colonia Intensa Eau de Cologne 100ml Italian Luxury Fragrance"
     * "Nike Tech Fleece Jacket Large Black Premium Sportswear Hoodie SP200710EAG"
     * "Samsung Galaxy S23 256GB Phantom Black Unlocked 5G Smartphone"

   - **brand**: EXACT brand name as it appears on the label (not assumed)

   - **category**: Full category breadcrumb path for ${platform} using backslash separators
     **CRITICAL CATEGORY REQUIREMENTS:**
     - Use FULL navigation path from Home to most specific category
     - Format: "Home \\ Parent Category \\ Subcategory \\ Specific Category"
     - Examples for Vinted:
       * Men's cardigan: "Home \\ Men \\ Clothing \\ Jumpers & sweaters \\ Cardigans"
       * Women's dress: "Home \\ Women \\ Clothing \\ Dresses \\ Maxi dresses"
       * Kids shoes: "Home \\ Kids \\ Shoes \\ Trainers"
     - Examples for eBay:
       * Electronics: "Home \\ Electronics \\ Computers \\ Laptops"
       * Clothing: "Home \\ Clothing \\ Men's Clothing \\ Shirts"
     - Be as specific as possible - drill down to the most precise category available

   - **description**: Structured marketplace listing with clear sections for maximum clarity and appeal
     **CRITICAL: Follow this EXACT structure with clear section headers**

     **REQUIRED FORMAT:**

     **Marketing Paragraph** (2-3 sentences):
     - Engaging opening about what the item is, what it offers, and its benefits
     - Focus on value proposition without being grandiose
     - Use standard marketing language that highlights key selling points
     - Example: "The Nike Air Revaderchi brings retro trail-running style to modern streetwear. Inspired by the iconic Air Mowabb, these trainers combine premium materials with classic design elements for a distinctive look that stands out from the crowd."

     **---** (separator line)

     **Facts**
     List key product specifications and details:
     • Size: [UK/US/EUR/CM sizing]
     • Material: [upper materials, construction details]
     • Colourway: [specific colour names]
     • Model Number: [style code if available]
     • [Any other relevant specifications]

     **----** (separator line)

     **Condition**
     Detailed condition assessment including:
     - Overall condition category (New/Excellent/Good/Fair etc.)
     - Specific condition notes from AI analysis
     - Any user-provided condition information
     - Visible wear, marks, or defects
     - Example: "Fair condition with visible dirt and scuff marks on the back heel area and moderate wear on the soles. The uppers show typical signs of use but remain structurally sound. Missing insoles as noted."

     **MANDATORY FOOTER:**
     - MUST end with: "\n\nListing generated from photos by AI, free at www.quicklist.it.com"
     - This attribution MUST be included in every description

     **SEO WRITING RULES:**
     - Use target keywords naturally 2-3 times in description (brand, product line, item type)
     - Include keyword variations (trainers/sneakers, fragrance/cologne/perfume)
     - Mention what it's perfect for (running, casual wear, collectors, gifts)
     - Use descriptive adjectives that match search intent (premium, luxury, authentic, vintage, retro)
     - Include measurements if visible (50ml, 100ml, UK 10, Large, etc.)
     - Natural keyword density: 2-5% (not stuffing)

     **WRITING STYLE RULES:**
     - Use active, engaging language ("features", "boasts", "offers", "delivers")
     - Avoid generic phrases like "nice item" or "good condition" - be specific
     - Create desire: Make the reader WANT this item
     - Stay truthful: Don't exaggerate, but highlight positives
     - Use UK English spelling and terminology
     - Vary sentence length for rhythm and readability

     **MANDATORY CONTENT:**
     - MUST include exact product line/model name (identified via code lookup) in first sentence - NOT generic terms
     - MUST mention size/volume if visible on labels
     - MUST include materials/composition from care labels
     - MUST mention model code if visible (include in parentheses: "Model: CK0697-010" or "Style: CK0697-010")
     - If multiple codes are visible, mention the model code (CK0697-010 format) as primary identifier
     - MUST describe condition accurately but positively
     - MUST include at least 2-3 specific selling points about the product line (e.g., Tech Fleece features, Air Jordan heritage, etc.)
     - MUST use Google Search to identify product line when ANY codes are present - check ALL codes, use model code (CK0697-010 format) as primary

     **EXAMPLES OF GOOD DESCRIPTIONS:**

     * Jacket: "Authentic Nike Tech Fleece Jacket in size Large (Style: SP200710EAG). This premium streetwear piece features Nike's signature Tech Fleece fabric - a lightweight, insulating material that provides exceptional warmth without bulk. The classic black colourway offers versatile styling options, perfect for layering or wearing standalone. The jacket boasts a modern fit with ribbed cuffs and hem for a tailored look. In excellent pre-owned condition with minimal signs of wear - the fabric remains soft and the zippers function perfectly. A must-have for any streetwear enthusiast looking to add a quality Nike piece to their collection at a fraction of retail price.\n\nListed by https://www.quicklist.it.com"

     * Trainers: "Nike Air Jordan 1 Mid in UK Size 10 (Style: DM0029-100). These iconic basketball-inspired trainers feature the classic Mid silhouette with premium leather uppers that have developed a beautiful patina. The crisp white panels contrast beautifully with bold accent colours, creating a timeless look that works with any outfit. The Air cushioning provides excellent comfort for all-day wear, while the high-top design offers ankle support. Condition is excellent with minimal creasing to the toe box and clean, barely-worn outsoles showing the original tread pattern. A versatile addition to any sneaker collection that offers instant street style credibility.\n\nListed by https://www.quicklist.it.com"
     
     **AVOID:**
     - Generic statements: "Nice jacket", "Good item", "Works well"
     - Repetitive language: Don't say "condition" multiple times
     - Overly technical jargon that doesn't sell
     - Negative framing: "No major flaws" → "Excellent condition"
     - Copy-paste from labels without context

   - **rrp**: Original Recommended Retail Price in GBP. Format: "£XX.XX" or "£XXX" or "Unknown"
     **CRITICAL:** You MUST use Google Search grounding to find the EXACT retail price
     **REQUIRED STEPS:**
     1. Extract exact product name and style code from labels
     2. Search: "{brand} {exact product name} {style code} RRP UK retail price"
     3. Search: "{brand} {product name} {size} original price UK"
     4. Look for official brand websites, major retailers (Nike.com, JD Sports, etc.)
     5. Find the price when this item was NEW, not resale price
     6. If multiple sizes have different prices, use the price for the specific size shown
     7. Format as "£XX" or "£XX.XX" - NEVER use "Unknown" unless you've searched extensively
     **If you cannot find RRP after searching, state "Unknown" but note this in description**

   - **price**: Competitive resale price in GBP based on SOLD listings. Format: "£XX" or "£XX.XX"
     **REQUIRED:** You MUST use Google Search grounding to find ACTUAL sold prices
     **MANDATORY STEPS:**
     1. Search: "{brand} {product name} {style code} sold ${platform} UK"
     2. Search: "{brand} {product name} {size} sold price ${platform}"
     3. Look for completed/sold listings, NOT active listings
     4. Find 5-10 recent sold listings for similar condition
     5. Calculate average sold price
     6. Adjust for condition: Excellent = 60-70% of RRP, Very Good = 50-60%, Good = 40-50%, Fair = 30-40%
     7. Price competitively: Slightly below average sold price for quick sale
     **NEVER guess prices - ALWAYS base on actual sold listing data from Google Search**

   - **condition**: Detailed condition assessment. Categories: New with Tags, Like New, Excellent, Very Good, Good, Fair, Poor.
     **CRITICAL:** Examine ALL images carefully and be SPECIFIC:
     - Check every angle for wear, damage, stains, scuffs
     - Look at close-up shots for detail
     - Note packaging condition if visible (box condition, tags present)
     - Assess liquid level for fragrances (e.g., "90% full", "Appears full", "Near full")
     - For clothing: Check seams, zippers, buttons, fabric condition
     - For shoes: Check soles, uppers, insoles, laces
     - For electronics: Check screens, ports, buttons, overall wear
     - Be honest but frame positively: "Excellent condition with minimal wear" not "Has some wear"
     - Format: "{Category} - {specific details}"
     - Examples: 
       * "Excellent - Appears barely worn, no visible flaws"
       * "Very Good - Minor wear to soles, uppers in great condition"
       * "Good - Some scuffing on heel, overall well-maintained"

   - **keywords**: 8-15 relevant search terms (array of strings) - SEO-OPTIMIZED FOR ${platform}
     **CRITICAL SEO REQUIREMENTS:**
     - Front-load high-search-volume terms (brand, item type, key features)
     - Include: Brand, Item Type, Style/Model Name, Color, Size, Material, Condition
     - Mix of exact product terms and category terms
     - Include style codes or model numbers you read
     - Add use-case keywords (e.g., "casual wear", "running", "streetwear", "collectors")
     - Include synonyms (trainers/sneakers/shoes, perfume/fragrance/cologne)
     - Avoid keyword stuffing - only relevant, high-value terms
     - **MANDATORY: ALWAYS include "#quicklist" as the LAST keyword in the array**
     - ${platform === 'ebay' ? '15-20 keywords max (eBay allows more)' : '8-12 keywords ideal for Vinted/Gumtree'}
     Examples:
     * Nike trainers: ["Nike", "Air Jordan 1 Mid", "trainers", "sneakers", "shoes", "basketball", "UK 10", "white", "leather", "streetwear", "casual", "retro", "90s", "#quicklist"]
     * Fragrance: ["Acqua di Parma", "Colonia Intensa", "eau de cologne", "100ml", "men's fragrance", "Italian", "luxury", "citrus", "cologne", "#quicklist"]

   - **sources**: 1-2 reference URLs for price verification (array of objects with url and title)
     These will be automatically populated from your Google Search results

   - **stockImageUrl**: Direct URL to official manufacturer stock product image (OPTIONAL - will be found separately in Phase 4)
     Format: Direct image URL ending in .jpg, .png, or .webp, or null if not found
     Note: This field is optional - stock images are found in a separate phase after identification

**Pricing Guidelines - GOOGLE SEARCH IS MANDATORY:**
1. **RRP Research (REQUIRED):**
   - Search: "{brand} {exact product name} {style code} RRP UK"
   - Check official brand websites first
   - Check major UK retailers (JD Sports, Footasylum, Nike.com, etc.)
   - Look for original retail price, not sale price
   - If item is discontinued, find last known retail price
   - Format: "£XX" or "£XX.XX" - only use "Unknown" if genuinely not findable

2. **Resale Price Research (REQUIRED):**
   - Search: "{brand} {product name} {style code} sold ${platform} UK"
   - Find 5-10 completed/sold listings
   - Calculate average sold price
   - Price at 5-10% below average for competitive listing
   - Adjust for condition shown in images
   - Condition multipliers: Excellent (65%), Very Good (55%), Good (45%), Fair (35%) of RRP

3. **Price Formatting:**
   - Round to nearest £5 for items under £50
   - Round to nearest £10 for items over £50
   - Example: £42.50 → £40, £67 → £65, £123 → £120

4. **Quality Check:**
   - If RRP is "Unknown" but price seems high, verify with more searches
   - If price seems too low, check if condition justifies it
   - Always include sources in the sources array for price verification

**Output Requirements:**
Return ONLY valid JSON. No markdown code blocks, no explanatory text.

**CRITICAL: CONFIDENCE-BASED OUTPUT:**
- If confidence is HIGH: Return single listing object
- If confidence is MEDIUM or LOW: Return object with "alternatives" array containing up to 3 closest matches

**Single Match (HIGH confidence):**
{
  "confidence": "HIGH",
  "title": "",
  "brand": "",
  "category": "",
  "description": "",
  "condition": "",
  "rrp": "",
  "price": "",
  "keywords": [],
  "sources": [{"url": "", "title": ""}]
}

**Multiple Matches (MEDIUM/LOW confidence):**
{
  "confidence": "MEDIUM" or "LOW",
  "title": "best match title",
  "brand": "best match brand",
  "category": "best match category",
  "description": "best match description",
  "condition": "best match condition",
  "rrp": "best match rrp",
  "price": "best match price",
  "keywords": [],
  "sources": [{"url": "", "title": ""}],
  "alternatives": [
    {
      "title": "alternative 1 title",
      "brand": "alternative 1 brand",
      "category": "alternative 1 category",
      "description": "alternative 1 description",
      "condition": "alternative 1 condition",
      "rrp": "alternative 1 rrp",
      "price": "alternative 1 price",
      "matchReason": "why this is a close match"
    },
    {
      "title": "alternative 2 title",
      "brand": "alternative 2 brand",
      "category": "alternative 2 category",
      "description": "alternative 2 description",
      "condition": "alternative 2 condition",
      "rrp": "alternative 2 rrp",
      "price": "alternative 2 price",
      "matchReason": "why this is a close match"
    }
  ]
}

**CRITICAL RULES - LABEL ACCURACY:**

⚠️ ABSOLUTE REQUIREMENTS:
1. READ LABELS FIRST - Check every angle for tags, labels, text before identifying
2. QUOTE WHAT YOU READ - If you see "Nike" on a label, use "Nike" (not "appears to be Nike")
3. NO GUESSING MODELS - If you can't read a style code, don't invent one
4. STATE UNCERTAINTY - If labels are blurry or hidden, say "Unable to confirm exact model from visible labels"
5. EVIDENCE-BASED ONLY - Every detail in your listing must come from visible evidence

❌ NEVER DO:
- Make up style codes, model numbers, or SKUs not visible in photos
- Assume brand based on design alone without confirming with labels
- Identify specific product lines without reading tags
- Use generic descriptions when you can't read labels

✅ ALWAYS DO:
- Explicitly state what text you read from labels in the description
- Zoom in mentally on label close-ups
- Prioritize inside tags over external appearance
- Say "Label not visible" rather than guess
- Be specific about what you CAN and CANNOT see
- **READ ALL CODES ON TAGS**: Tags often have multiple codes - read EVERY line, EVERY code
- **CHECK ALL CODES**: When you see codes (model code CK0697-010, style code SP200710EAG, SKU 19315498680), check ALL of them
- **USE MODEL CODE FIRST**: The model code (format like CK0697-010, DM0029-100) is usually the PRIMARY identifier - use it first in Google Search
- **LOOK UP CODES**: Use Google Search to identify the exact product line/model name - start with model code, then try style code if needed
- **USE SPECIFIC PRODUCT NAMES**: If you find "Tech Fleece" via code lookup, say "Tech Fleece Jacket" not just "Jacket"
- **INCLUDE PRODUCT LINE FEATURES**: Mention specific features of the product line (Tech Fleece fabric, Air cushioning, etc.)
- **MENTION MODEL CODE**: Include the model code (CK0697-010) in the description, not just style codes`;

    logger.info('Calling Gemini Vision API:', { platform, imageCount: images.length, userId });

    // Build parts array: prompt text + all images
    const parts = [{ text: prompt }, ...images.map(prepareImageForGemini)];

    // Enable Google Search grounding for real-time price research
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7, // Increased for more creative, engaging descriptions while maintaining accuracy
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 3072, // Increased to allow for longer, more detailed descriptions
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { rawError: errorText };
      }
      logger.error('Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        userId,
        requestId: req.id,
      });
      throw new Error(
        `Gemini API request failed: ${response.status} - ${errorData.error?.message || errorText.substring(0, 200) || response.statusText}`
      );
    }

    const data = await response.json();

    // Check for safety blocks or other issues
    if (!data.candidates || data.candidates.length === 0) {
      logger.error('No candidates in Gemini response:', { data, userId });
      throw new Error('No response from AI model');
    }

    const candidate = data.candidates[0];
    const textParts = [];
    candidate.content.parts.forEach((part) => {
      if (typeof part.text === 'string' && part.text.trim().length > 0) {
        textParts.push(part.text.trim());
      } else if (
        part.inlineData?.mimeType === 'application/json' &&
        typeof part.inlineData.data === 'string'
      ) {
        try {
          const decoded = Buffer.from(part.inlineData.data, 'base64').toString('utf-8').trim();
          if (decoded.length > 0) {
            textParts.push(decoded);
          }
        } catch (decodeError) {
          logger.warn('Failed to decode inlineData from Gemini response', {
            error: decodeError.message,
            userId,
          });
        }
      }
    });

    const combinedText = textParts.join('\n').trim();

    if (!combinedText) {
      logger.error('Gemini response contains no text parts', {
        parts: candidate.content.parts.length,
        userId,
      });
      throw new Error('No text returned from AI model');
    }

    logger.info('Received response from Gemini:', { length: combinedText.length, userId });

    // Extract grounding metadata (Google Search sources)
    const groundingMetadata = data.candidates[0]?.groundingMetadata;
    const searchSources = [];

    if (groundingMetadata?.webSearchQueries) {
      logger.info('Google Search queries used:', {
        queries: groundingMetadata.webSearchQueries,
        userId,
      });
    }

    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk) => {
        if (chunk.web?.uri && chunk.web?.title) {
          searchSources.push({
            url: chunk.web.uri,
            title: chunk.web.title,
          });
        }
      });
      logger.info('Found research sources:', { count: searchSources.length, userId });
    }

    const listing = extractListingFromGeminiText(combinedText);
    if (listing) {
      // Merge AI-generated sources with grounding sources
      if (searchSources.length > 0) {
        listing.sources = [...searchSources, ...(listing.sources || [])];
      }

      // Determine confidence level
      const confidence =
        listing.confidence ||
        (listing.alternatives && listing.alternatives.length > 0 ? 'MEDIUM' : 'HIGH');
      listing.confidence = confidence;

      // PHASE 4: Find stock image (runs after product identification)
      let stockImageData = null;
      if (listing.brand && listing.title) {
        // Add model codes to listing for stock image search
        listing.modelCodes = parsedCodes.modelCodes || [];
        stockImageData = await findStockImage(listing, apiKey);
        if (stockImageData && stockImageData.stockImageUrl) {
          listing.stockImageUrl = stockImageData.stockImageUrl;
          listing.stockImageSource = stockImageData.source;
          listing.stockImageConfidence = stockImageData.confidence;
          listing.stockImageAlternatives = stockImageData.alternatives || [];
        }
      }

      // Get eBay pricing intelligence if platform is eBay (only for primary match)
      let pricingIntelligence = null;
      let predictedPrice = null;
      if ((platform === 'ebay' || platform === 'all') && listing.brand && listing.title) {
        logger.info('Fetching eBay pricing intelligence:', { userId });
        pricingIntelligence = await getEbayPricingIntelligence(
          listing.brand || '',
          listing.title,
          listing.category
        );

        if (pricingIntelligence) {
          listing.pricingData = pricingIntelligence;
          logger.info('Pricing intelligence retrieved:', {
            avgPrice: pricingIntelligence.soldPrices?.average,
            soldCount: pricingIntelligence.soldCount,
            userId,
          });

          // Feature 5: Predictive pricing based on eBay data and quality
          predictedPrice = await predictOptimalPrice(
            listing,
            pricingIntelligence,
            avgQualityScore // Use the average quality score from images
          );

          if (predictedPrice) {
            // Override AI's price with data-driven prediction
            listing.price = `£${predictedPrice.recommendedPrice}`;
            listing.pricingConfidence = predictedPrice.confidence;
            listing.pricingReasoning = predictedPrice.reasoning;
            listing.marketInsights = predictedPrice.marketInsights;
          }
        }
      }

      // Track usage after successful generation
      try {
        await safeQuery(
          `INSERT INTO usage_tracking (user_id, period_start, period_end, ai_generations, listings_created)
                     VALUES ($1, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', 1, 0)
                     ON CONFLICT (user_id, period_start) 
                     DO UPDATE SET ai_generations = usage_tracking.ai_generations + 1`,
          [userId]
        );
      } catch (usageError) {
        logger.warn('Usage tracking failed:', { error: usageError.message, userId });
      }

      logger.info('Successfully generated listing:', {
        title: listing.title,
        confidence,
        alternatives: listing.alternatives?.length || 0,
        userId,
      });

      res.json({
        listing,
        pricingIntelligence,
        predictedPrice,
        stockImageData,
        imageQuality: {
          averageScore: avgQualityScore,
          individualScores: qualityAnalysis,
          criticalIssues,
          recommendations: allRecommendations,
          passesMinimumQuality: avgQualityScore >= 60,
        },
        requiresUserSelection:
          confidence !== 'HIGH' && listing.alternatives && listing.alternatives.length > 0,
      });
    } else {
      logger.error('Failed to extract JSON from Gemini response:', {
        textPreview: combinedText.substring(0, 500),
        userId,
      });
      throw new Error('AI response JSON parsing failed');
    }
  } catch (error) {
    logger.error('Generate listing error:', { error: error.message, requestId: req.id, userId });
    res.status(500).json({
      error: 'Failed to generate listing',
      details: error.message,
    });
  }
});

// Barcode lookup endpoint
app.post('/api/lookup-barcode', authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.body;
    const userId = req.user.id;

    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({ error: 'Barcode required' });
    }

    // Validate barcode format (8-13 digits for UPC/EAN)
    if (!/^\d{8,13}$/.test(barcode)) {
      return res.status(400).json({ error: 'Invalid barcode format. Must be 8-13 digits' });
    }

    logger.info('Barcode lookup request:', { barcode, userId });

    // Try UPC Database API (free tier - 100 requests/day)
    let productData = await lookupUPCDatabase(barcode);

    // If not found, try alternative sources
    if (!productData.found) {
      // Try Open Food Facts for food items (free, unlimited)
      if (barcode.length === 13 || barcode.length === 8) {
        productData = await lookupOpenFoodFacts(barcode);
      }
    }

    if (productData.found) {
      logger.info('Barcode product found:', { barcode, title: productData.title });
    } else {
      logger.info('Barcode product not found:', { barcode });
    }

    res.json(productData);
  } catch (error) {
    logger.error('Barcode lookup error:', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Barcode lookup failed',
      found: false,
      details: error.message,
    });
  }
});

// Helper function: UPC Database API lookup
async function lookupUPCDatabase(barcode) {
  try {
    // UPC Database API - free tier (no API key required for trial)
    const response = await axios.get(`https://api.upcitemdb.com/prod/trial/lookup`, {
      params: { upc: barcode },
      timeout: 5000,
    });

    if (response.data && response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      return {
        found: true,
        barcode: barcode,
        title: item.title || item.description || 'Unknown Product',
        brand: item.brand || '',
        category: item.category || '',
        description: item.description || '',
        images: item.images || [],
        msrp: item.msrp ? `$${item.msrp}` : null,
        rrp: item.highest_recorded_price ? `$${item.highest_recorded_price}` : null,
        specifications: {
          EAN: item.ean || barcode,
          UPC: item.upc || barcode,
          Model: item.model || 'N/A',
          Size: item.size || 'N/A',
          Color: item.color || 'N/A',
          Weight: item.weight || 'N/A',
        },
        source: 'UPC Database',
      };
    }

    return { found: false, barcode };
  } catch (error) {
    logger.warn('UPC Database API error:', { error: error.message, barcode });
    return { found: false, barcode };
  }
}

// Helper function: Open Food Facts API lookup (for food/grocery items)
async function lookupOpenFoodFacts(barcode) {
  try {
    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { timeout: 5000 }
    );

    if (response.data && response.data.status === 1) {
      const product = response.data.product;
      return {
        found: true,
        barcode: barcode,
        title: product.product_name || 'Unknown Product',
        brand: product.brands || '',
        category: product.categories || 'Food/Grocery',
        description: [
          product.product_name,
          product.generic_name,
          product.ingredients_text_en || product.ingredients_text,
        ]
          .filter(Boolean)
          .join('. '),
        images: product.image_url ? [product.image_url] : [],
        rrp: null, // Price not available in Open Food Facts
        specifications: {
          Barcode: barcode,
          Quantity: product.quantity || 'N/A',
          Brands: product.brands || 'N/A',
          Categories: product.categories || 'N/A',
          Countries: product.countries || 'N/A',
          Ingredients: product.ingredients_text_en || product.ingredients_text || 'N/A',
        },
        source: 'Open Food Facts',
      };
    }

    return { found: false, barcode };
  } catch (error) {
    logger.warn('Open Food Facts API error:', { error: error.message, barcode });
    return { found: false, barcode };
  }
}

// Post listing to eBay
app.post('/api/listings/:id/post-to-ebay', authenticateToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    const userId = req.user.id;

    // Get listing from database
    const listingResult = await pool.query(
      `SELECT l.*, 
                    (SELECT json_agg(i.image_data ORDER BY i.image_order) 
                     FROM images i WHERE i.listing_id = l.id) as images 
             FROM listings l 
             WHERE l.id = $1 AND l.user_id = $2`,
      [listingId, userId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];

    // Get user's eBay token (would be stored in users table or separate table)
    // For now, assume it's in environment or user needs to provide
    const ebayToken = process.env.EBAY_AUTH_TOKEN; // Should come from user's stored credentials

    if (!ebayToken) {
      return res.status(400).json({ error: 'eBay authentication token not configured' });
    }

    // Post to eBay
    const result = await postToEbay(
      listing,
      listing.images || [],
      ebayToken,
      req.body.ebayCategoryId
    );

    // Update listing with eBay item ID
    await pool.query(
      'UPDATE listings SET ebay_item_id = $1, posted_to_ebay = true, ebay_posted_at = CURRENT_TIMESTAMP WHERE id = $2',
      [result.itemId, listingId]
    );

    logger.info('Posted to eBay:', { listingId, itemId: result.itemId, userId });
    res.json({
      success: true,
      itemId: result.itemId,
      url: result.url,
    });
  } catch (error) {
    logger.error('Post to eBay error:', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Failed to post to eBay',
      details: error.message,
    });
  }
});

// Feature 6: AI Damage Detection
// Analyze multiple images for damage, defects, and wear
async function analyzeLabelImage(image, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const labelPrompt = `You are a product information extraction AI analyzing a product label image.

EXTRACT ALL VISIBLE INFORMATION from this product label:

1. PRODUCT IDENTIFICATION:
   - Product name/title
   - Brand name
   - Model number/code
   - SKU/Product code
   - Barcode number (UPC, EAN, etc.)

2. PRODUCT DETAILS:
   - Category (e.g., clothing, electronics, shoes, toys, etc.)
   - Size (if applicable - clothing size, dimensions, volume, weight)
   - Color
   - Material/fabric composition
   - Country of origin/manufacture
   - Date of manufacture (if visible)

3. PRICING INFORMATION:
   - Retail price/RRP/MSRP (if visible)
   - Any price tags or stickers

4. CARE INSTRUCTIONS:
   - Washing instructions
   - Care symbols
   - Storage instructions

5. OTHER INFORMATION:
   - Serial numbers
   - Batch/lot numbers
   - Certifications (CE, UL, etc.)
   - Age recommendations
   - Warnings or safety information

Return JSON:
{
  "found": true/false,
  "title": "product name",
  "brand": "brand name",
  "model": "model number",
  "barcode": "barcode number",
  "category": "product category",
  "size": "size information",
  "color": "color",
  "material": "material composition",
  "rrp": "retail price",
  "price": "any visible price",
  "countryOfOrigin": "country",
  "careInstructions": ["instruction 1", "instruction 2"],
  "features": ["feature 1", "feature 2"],
  "description": "comprehensive product description based on label info",
  "confidence": 0.0-1.0,
  "extractedText": "all readable text from label"
}

BE COMPREHENSIVE. Extract every piece of readable information from the label.
If you can't read certain parts clearly, note this in the response.`;

    const parts = [{ text: labelPrompt }, prepareImageForGemini(image)];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for accurate text extraction
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Gemini API error in label analysis:', {
        status: response.status,
        error: errorData,
      });
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const labelData = JSON.parse(cleanedText);

    return labelData;
  } catch (error) {
    logger.error('Label analysis error:', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function analyzeDamageInImages(images, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const damagePrompt = `You are a professional product inspector analyzing images for defects and damage.

ANALYZE ALL ${images.length} IMAGE(S) SYSTEMATICALLY:

For EACH image, identify:
1. VISIBLE DEFECTS:
   - Stains (location, color, size)
   - Tears/holes (location, size)
   - Scratches (severity, location)
   - Discoloration/fading
   - Missing parts (buttons, zippers, etc.)
   - Structural damage (bent, broken, cracked)
   - Wear patterns (fraying, pilling, sole wear)

2. DEFECT SEVERITY:
   - CRITICAL: Makes item unusable or significantly impacts value
   - MAJOR: Clearly visible, impacts appearance/function
   - MINOR: Small, barely noticeable, doesn't affect function
   - NORMAL WEAR: Expected for used item

3. LOCATION:
   - Specific location on item (front, back, left sleeve, right toe, etc.)
   - Size estimate (cm or % of area)

4. RECOMMENDED CONDITION RATING:
   - New with tags
   - New without tags
   - Like New (no visible wear)
   - Excellent (minimal wear)
   - Very Good (light wear, no defects)
   - Good (obvious wear, minor defects)
   - Fair (significant wear, multiple defects)
   - Poor (major defects, functional issues)

Return JSON:
{
  "overallCondition": "Good/Fair/Poor/Excellent",
  "damageFound": true/false,
  "damages": [
    {
      "type": "stain|tear|scratch|discoloration|missing_part|structural|wear",
      "location": "specific location on item",
      "severity": "critical|major|minor|normal_wear",
      "confidence": 0.0-1.0,
      "description": "detailed description",
      "imageIndex": 0,
      "estimatedSize": "measurement or %"
    }
  ],
  "conditionDisclosure": "Professional paragraph describing all defects for listing",
  "recommendations": [
    "Take closer photo of stain on front",
    "Add photo showing full back side",
    "Include close-up of damaged zipper"
  ],
  "conditionJustification": "Why this condition rating was chosen",
  "honestyScore": 80
}

BE THOROUGH. Better to over-report minor issues than miss major ones.
Provide honest but not alarming language for the condition disclosure.`;

    // Build parts array: prompt text + all images
    const parts = [{ text: damagePrompt }, ...images.map(prepareImageForGemini)];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more factual damage assessment
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Gemini API error in damage detection:', {
        status: response.status,
        error: errorData,
      });
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      logger.error('No candidates in Gemini damage detection response:', { data });
      throw new Error('No response from AI model');
    }

    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const damageData = JSON.parse(jsonMatch[0]);

      // Ensure all required fields exist with defaults
      return {
        overallCondition: damageData.overallCondition || 'Good',
        damageFound:
          damageData.damageFound !== undefined
            ? damageData.damageFound
            : damageData.damages && damageData.damages.length > 0,
        damages: damageData.damages || [],
        conditionDisclosure:
          damageData.conditionDisclosure || 'Item is in good condition with normal signs of wear.',
        recommendations: damageData.recommendations || [],
        conditionJustification: damageData.conditionJustification || '',
        honestyScore: damageData.honestyScore || 85,
      };
    }

    // Fallback if no JSON found
    return {
      overallCondition: 'Good',
      damageFound: false,
      damages: [],
      conditionDisclosure:
        'Unable to fully assess condition from images. Please inspect item carefully.',
      recommendations: ['Provide clearer images for accurate assessment'],
      conditionJustification: 'Assessment limited by image quality',
      honestyScore: 50,
    };
  } catch (error) {
    logger.error('Damage detection error:', { error: error.message });
    throw error;
  }
}

// Damage detection endpoint
app.post('/api/analyze-damage', authenticateToken, async (req, res) => {
  try {
    const { images } = req.body;
    const userId = req.user.id;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Images array required' });
    }

    if (images.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 images allowed' });
    }

    logger.info('Analyzing damage in images:', { userId, imageCount: images.length });

    const apiKey = process.env.GEMINI_API_KEY;
    const damageAnalysis = await analyzeDamageInImages(images, apiKey);

    // Calculate severity distribution
    const severityCount = {
      critical: 0,
      major: 0,
      minor: 0,
      normal_wear: 0,
    };

    damageAnalysis.damages.forEach((damage) => {
      if (severityCount[damage.severity] !== undefined) {
        severityCount[damage.severity]++;
      }
    });

    // Add severity summary to response
    damageAnalysis.severitySummary = severityCount;

    logger.info('Damage analysis complete:', {
      userId,
      damageFound: damageAnalysis.damageFound,
      damageCount: damageAnalysis.damages.length,
      condition: damageAnalysis.overallCondition,
    });

    res.json(damageAnalysis);
  } catch (error) {
    logger.error('Damage detection endpoint error:', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze damage', details: error.message });
  }
});

// Label Analysis - Extract all product information from a label image
app.post('/api/analyze-label', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    const userId = req.user.id;

    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }

    logger.info('Analyzing product label:', { userId });

    const apiKey = process.env.GEMINI_API_KEY;
    const labelData = await analyzeLabelImage(image, apiKey);

    logger.info('Label analysis complete:', {
      userId,
      found: labelData.found,
      hasTitle: !!labelData.title,
      hasBrand: !!labelData.brand,
      hasBarcode: !!labelData.barcode,
    });

    res.json(labelData);
  } catch (error) {
    logger.error('Label analysis endpoint error:', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze label', details: error.message });
  }
});

// ============================================================================
// PLATFORM-AGNOSTIC LISTING ENDPOINTS
// ============================================================================

// Import platform optimizers
const platformOptimizers = require('./utils/platformOptimizers');

// Generate platform-specific variations for a listing
app.get('/api/listings/:id/platform-variations', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get listing
    const listingResult = await pool.query(
      'SELECT * FROM listings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];

    // Check for cached optimizations first
    const cachedEbay = await platformOptimizers.getCachedOptimization(id, 'ebay');
    const cachedVinted = await platformOptimizers.getCachedOptimization(id, 'vinted');
    const cachedDepop = await platformOptimizers.getCachedOptimization(id, 'depop');
    const cachedFacebook = await platformOptimizers.getCachedOptimization(id, 'facebook');

    // Generate missing optimizations
    const variations = {
      ebay: cachedEbay || (await platformOptimizers.optimizeForEbay(listing)),
      vinted: cachedVinted || (await platformOptimizers.optimizeForVinted(listing)),
      depop: cachedDepop || (await platformOptimizers.optimizeForDepop(listing)),
      facebook: cachedFacebook || (await platformOptimizers.optimizeForFacebook(listing)),
    };

    // Cache any newly generated optimizations
    if (!cachedEbay) await platformOptimizers.cacheOptimization(id, 'ebay', variations.ebay);
    if (!cachedVinted) await platformOptimizers.cacheOptimization(id, 'vinted', variations.vinted);
    if (!cachedDepop) await platformOptimizers.cacheOptimization(id, 'depop', variations.depop);
    if (!cachedFacebook)
      await platformOptimizers.cacheOptimization(id, 'facebook', variations.facebook);

    res.json(variations);
  } catch (error) {
    logger.error('Platform variations error:', error);
    res.status(500).json({ error: 'Failed to generate platform variations' });
  }
});

// Optimize listing for single platform
app.post('/api/listings/:id/optimize-for-platform', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { platform } = req.body;
    const userId = req.user.id;

    if (!['ebay', 'vinted', 'depop', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Get listing
    const listingResult = await pool.query(
      'SELECT * FROM listings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];

    // Generate optimization
    let optimized;
    switch (platform) {
      case 'ebay':
        optimized = await platformOptimizers.optimizeForEbay(listing);
        break;
      case 'vinted':
        optimized = await platformOptimizers.optimizeForVinted(listing);
        break;
      case 'depop':
        optimized = await platformOptimizers.optimizeForDepop(listing);
        break;
      case 'facebook':
        optimized = await platformOptimizers.optimizeForFacebook(listing);
        break;
    }

    res.json(optimized);
  } catch (error) {
    logger.error('Platform optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize for platform' });
  }
});

// Get platform statuses for a listing
app.get('/api/listings/:id/platform-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify listing belongs to user
    const listingCheck = await pool.query(
      'SELECT id FROM listings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get platform statuses
    const statusResult = await pool.query(
      `SELECT platform, status, platform_listing_id, platform_url,
              view_count, watcher_count, posted_at, sold_at, sale_price
       FROM listing_platform_status
       WHERE listing_id = $1
       ORDER BY platform`,
      [id]
    );

    res.json(statusResult.rows);
  } catch (error) {
    logger.error('Get platform status error:', error);
    res.status(500).json({ error: 'Failed to get platform status' });
  }
});

// Update platform status for a listing
app.post('/api/listings/:id/platform-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, status, platformListingId, platformUrl } = req.body;
    const userId = req.user.id;

    if (!['ebay', 'vinted', 'depop', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    if (!['draft', 'posted', 'sold', 'delisted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify listing belongs to user
    const listingCheck = await pool.query(
      'SELECT id FROM listings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Update or insert platform status
    await pool.query(
      `INSERT INTO listing_platform_status
         (listing_id, platform, status, platform_listing_id, platform_url, posted_at)
       VALUES ($1, $2, $3, $4, $5,
         CASE WHEN $3 = 'posted' THEN NOW() ELSE NULL END)
       ON CONFLICT (listing_id, platform)
       DO UPDATE SET
         status = EXCLUDED.status,
         platform_listing_id = COALESCE(EXCLUDED.platform_listing_id, listing_platform_status.platform_listing_id),
         platform_url = COALESCE(EXCLUDED.platform_url, listing_platform_status.platform_url),
         posted_at = CASE
           WHEN EXCLUDED.status = 'posted' AND listing_platform_status.posted_at IS NULL
           THEN NOW()
           ELSE listing_platform_status.posted_at
         END,
         updated_at = NOW()`,
      [id, platform, status, platformListingId, platformUrl]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Update platform status error:', error);
    res.status(500).json({ error: 'Failed to update platform status' });
  }
});

// Track clipboard analytics
app.post('/api/analytics/clipboard', authenticateToken, async (req, res) => {
  try {
    const { listingId, platform, action, success, errorMessage, sessionId } = req.body;
    const userId = req.user.id;

    if (!['ebay', 'vinted', 'depop', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    if (!['copy', 'open_platform', 'paste_detected', 'post_confirmed', 'error'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const userAgent = req.headers['user-agent'] || 'unknown';

    await pool.query(
      `INSERT INTO clipboard_analytics
         (user_id, listing_id, platform, action, success, error_message, user_agent, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, listingId, platform, action, success, errorMessage, userAgent, sessionId]
    );

    res.json({ tracked: true });
  } catch (error) {
    logger.error('Clipboard analytics error:', error);
    res.status(500).json({ error: 'Failed to track clipboard action' });
  }
});

// Get listings with platform statuses (enhanced endpoint)
app.get('/api/listings-with-platforms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         l.id,
         l.title,
         l.price,
         l.rrp,
         l.brand,
         l.category,
         l.condition,
         l.size,
         l.color,
         l.material,
         l.is_platform_agnostic,
         l.target_platforms,
         l.created_at,
         l.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'platform', lps.platform,
               'status', lps.status,
               'url', lps.platform_url,
               'views', lps.view_count,
               'watchers', lps.watcher_count,
               'posted_at', lps.posted_at
             )
           ) FILTER (WHERE lps.id IS NOT NULL),
           '[]'::json
         ) AS platform_statuses
       FROM listings l
       LEFT JOIN listing_platform_status lps ON l.id = lps.listing_id
       WHERE l.user_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get listings with platforms error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

// ============================================================================
// EBAY OAUTH & INVENTORY API
// ============================================================================

const ebayAuth = require('./utils/ebayAuth');
const EbayInventory = require('./utils/ebayInventory');

// Step 1: Redirect user to eBay authorization
app.get('/auth/ebay/authorize', authenticateToken, async (req, res) => {
  try {
    const authUrl = await ebayAuth.getAuthorizationUrl(req.user.id);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('eBay authorization error:', error);
    res.redirect('/?ebay=error');
  }
});

// Step 2: Handle OAuth callback from eBay
app.get('/auth/ebay/callback', authenticateToken, async (req, res) => {
  const { code, state } = req.query;

  try {
    // Verify state (CSRF protection)
    const stateValid = await ebayAuth.verifyState(req.user.id, state);
    if (!stateValid) {
      logger.warn('eBay OAuth state verification failed');
      return res.redirect('/?ebay=error&reason=invalid_state');
    }

    // Exchange code for tokens
    const tokens = await ebayAuth.getAccessToken(code);

    // Get eBay user info
    let ebayUserId = null;
    try {
      const userInfo = await ebayAuth.getUserInfo(tokens.accessToken);
      ebayUserId = userInfo.userId;
    } catch (_error) {
      // User info fetch failed, but continue anyway
      logger.warn('Failed to fetch eBay user info, continuing without it');
    }

    // Store tokens
    await ebayAuth.storeTokens(req.user.id, tokens, ebayUserId);

    logger.info('eBay account connected:', { userId: req.user.id, ebayUserId });

    // Redirect back to app
    res.redirect('/?ebay=connected');
  } catch (error) {
    logger.error('eBay OAuth callback error:', error);
    res.redirect('/?ebay=error');
  }
});

// Check eBay connection status
app.get('/api/ebay/status', authenticateToken, async (req, res) => {
  try {
    const status = await ebayAuth.getConnectionStatus(req.user.id);
    res.json(status);
  } catch (error) {
    logger.error('eBay status check error:', error);
    res.status(500).json({ error: 'Failed to check eBay status' });
  }
});

// Disconnect eBay account
app.post('/api/ebay/disconnect', authenticateToken, async (req, res) => {
  try {
    await ebayAuth.disconnect(req.user.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('eBay disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect eBay account' });
  }
});

// Post listing to eBay
app.post('/api/ebay/post-listing', authenticateToken, async (req, res) => {
  const { listingId, variation } = req.body;

  try {
    // Get valid eBay access token
    const accessToken = await ebayAuth.getValidToken(req.user.id);

    // Get listing details
    const listingResult = await pool.query(
      'SELECT * FROM listings WHERE id = $1 AND user_id = $2',
      [listingId, req.user.id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];

    // Initialize eBay Inventory API
    const isSandbox = process.env.EBAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    const ebayInventory = new EbayInventory(accessToken, isSandbox);

    // Create and publish listing
    const published = await ebayInventory.createAndPublishListing(listing);

    // Update platform status in database
    await pool.query(
      `INSERT INTO listing_platform_status (
        listing_id, platform, status, platform_listing_id, platform_url, posted_at
      )
      VALUES ($1, 'ebay', 'posted', $2, $3, NOW())
      ON CONFLICT (listing_id, platform)
      DO UPDATE SET
        status = 'posted',
        platform_listing_id = EXCLUDED.platform_listing_id,
        platform_url = EXCLUDED.platform_url,
        posted_at = NOW(),
        updated_at = NOW()`,
      [listingId, published.itemId, published.url]
    );

    logger.info('Listing posted to eBay:', { listingId, itemId: published.itemId });

    res.json({
      success: true,
      itemId: published.itemId,
      url: published.url,
      listingId: published.listingId,
      offerId: published.offerId,
      sku: published.sku,
    });
  } catch (error) {
    logger.error('eBay posting error:', { error: error.message, listingId });
    res.status(500).json({
      error: 'Failed to post to eBay',
      message: error.message,
    });
  }
});

// Get eBay listing analytics
app.get('/api/ebay/analytics/:listingId', authenticateToken, async (req, res) => {
  const { listingId } = req.params;

  try {
    // Get eBay item ID from platform status
    const result = await pool.query(
      `SELECT platform_listing_id
       FROM listing_platform_status
       WHERE listing_id = $1 AND platform = 'ebay'`,
      [listingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'eBay listing not found' });
    }

    const itemId = result.rows[0].platform_listing_id;

    // Get access token
    const accessToken = await ebayAuth.getValidToken(req.user.id);

    // Fetch analytics
    const isSandbox = process.env.EBAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    const ebayInventory = new EbayInventory(accessToken, isSandbox);
    const analytics = await ebayInventory.getItemAnalytics(itemId);

    // Update database
    await pool.query(
      `UPDATE listing_platform_status
       SET view_count = $1,
           watcher_count = $2,
           updated_at = NOW()
       WHERE listing_id = $3 AND platform = 'ebay'`,
      [analytics.viewCount, analytics.watcherCount, listingId]
    );

    res.json(analytics);
  } catch (error) {
    logger.error('eBay analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.round(process.uptime()),
      memory: {
        used: Math.round(memoryUsage.rss / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      services: {
        database: 'unknown',
        gemini: 'configured',
        stripe: stripe ? 'configured' : 'not configured',
      },
    };

    // Check database
    try {
      await pool.query('SELECT NOW()');
      health.services.database = 'ok';
    } catch (dbError) {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    // Check Gemini API (lightweight check)
    if (!process.env.GEMINI_API_KEY) {
      health.services.gemini = 'not configured';
      health.status = 'degraded';
    }

    const allHealthy = Object.values(health.services).every(
      (s) => s === 'ok' || s === 'configured'
    );
    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check error:', { error: error.message });
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

// Sentry error handling middleware (must be after all routes but before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler (catches any errors not handled by routes)
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    requestId: req.id,
  });
});

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  // Give Sentry time to send the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server (only in non-serverless environments)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`QuickList AI server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
