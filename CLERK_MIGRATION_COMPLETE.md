# Complete JWT Removal & Clerk Migration Guide

## Overview

This document describes the complete removal of JWT authentication and full migration to Clerk-only authentication.

## Changes Made to server.js

### 1. Removed Imports
```javascript
// REMOVED:
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// KEPT:
const { clerkClient, requireAuth, verifyToken } = require('@clerk/clerk-sdk-node');
```

### 2. Updated Environment Variable Validation
```javascript
// NOW REQUIRED:
const requiredEnvVars = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
];

// NO LONGER CHECKED:
- JWT_SECRET
- isClerkEnabled (always enabled now)
```

### 3. Removed Functions
- `validatePassword()` - No longer needed
- Legacy Google OAuth client initialization
- All `if (googleClient)` conditional blocks

### 4. Updated `/api/config/auth` Endpoint
```javascript
// BEFORE: Complex logic with fallbacks
// AFTER: Simple Clerk-only response
app.get('/api/config/auth', (req, res) => {
    res.json({
        clerk: {
            enabled: true,
            publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        },
        authProvider: 'clerk'
    });
});
```

### 5. Updated `authenticateToken` Middleware
```javascript
// BEFORE: Tried Clerk, fallback to JWT
// AFTER: Clerk-only with proper logging
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const session = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY
        });

        if (session && session.sub) {
            const user = await clerkClient.users.getUser(session.sub);
            req.user = {
                id: user.id,
                email: user.emailAddresses[0]?.emailAddress,
                name: user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.username,
                clerkId: user.id
            };

            logger.info('User authenticated', {
                userId: req.user.id,
                email: req.user.email,
                requestId: req.id
            });

            return next();
        } else {
            logger.warn('Clerk token verification failed: no session', { requestId: req.id });
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        logger.error('Clerk authentication error:', {
            error: error.message,
            requestId: req.id
        });
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
```

### 6. Removed Auth Endpoints
```javascript
// REMOVED COMPLETELY:
- POST /api/auth/signup
- POST /api/auth/signin
- GET /api/auth/google/url
- GET /api/auth/google/callback
- POST /api/auth/google/callback

// KEPT AND UPDATED:
- GET /api/auth/verify (Clerk user sync to database)
```

### 7. Updated `/api/auth/verify` Endpoint
```javascript
// Removed isClerkEnabled check
// Always syncs Clerk user to database
// Added improved logging
```

## Additional Files to Remove/Update

### Remove Legacy OAuth Code Sections

In `server.js`, remove all code between these lines:
1. Lines ~9-19: Conditional Google OAuth client loading
2. Lines ~363-485: All legacy Google OAuth endpoints
3. Lines ~487-600: Legacy OAuth callback handlers (if any remain)

### Complete Removal Checklist

```javascript
// Search and remove in server.js:
1. All references to `bcrypt`
2. All references to `jwt.sign`
3. All references to `jwt.verify` (except import removal)
4. All references to `OAuth2Client`
5. All references to `googleClient`
6. All references to `password_hash` in INSERT statements
7. All references to `validatePassword`
8. All references to `isClerkEnabled` checks
9. All `process.env.JWT_SECRET` references
10. All `process.env.GOOGLE_CLIENT_ID` references (legacy OAuth)
```

## Database Migration

### Run this SQL migration:

```sql
-- Already done via schema_clerk_migration.sql:
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Optional: Mark password_hash as deprecated
COMMENT ON COLUMN users.password_hash IS 'DEPRECATED: Legacy JWT auth, use clerk_id instead';

-- Optional: Clean up old JWT users without clerk_id (DANGEROUS - backup first!)
-- DELETE FROM users WHERE clerk_id IS NULL AND auth_provider != 'google';
```

## Frontend Changes (index.html)

### Remove from index.html:

1. **Email/Password Form Fields** (lines ~2030-2040)
   ```html
   <!-- REMOVE: -->
   <input type="password" id="authPassword" ...>
   <small id="passwordHelp">Minimum 6 characters</small>
   ```

2. **Legacy Auth Functions** (lines ~4940-5000)
   ```javascript
   // REMOVE:
   async signInLegacy() { ... }
   async signUpLegacy() { ... }
   ```

3. **Password Validation** (lines ~2440-2460)
   ```javascript
   // REMOVE:
   const password = authPassword.value;
   if (password && password.length < 6) { ... }
   ```

4. **JWT Token Handling** (lines ~2248-2275)
   ```javascript
   // UPDATE: Remove localStorage JWT logic
   // Keep only Clerk session handling
   ```

### Keep in index.html:

1. **Clerk SDK Loading** (line ~2123)
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"></script>
   ```

2. **Clerk OAuth Buttons** (lines ~2047-2060)
   ```html
   <button onclick="app.signInWithClerk('google')">
       Sign in with Google
   </button>
   ```

3. **Clerk Auth Functions** (lines ~5013-5067)
   ```javascript
   async checkClerkAuth() { ... }
   async signInWithClerk(provider) { ... }
   ```

## Environment Variables

### Remove from .env:
```env
# REMOVE THESE:
JWT_SECRET=...
GOOGLE_CLIENT_ID=...  # Legacy OAuth
GOOGLE_CLIENT_SECRET=...  # Legacy OAuth
GOOGLE_REDIRECT_URI=...  # Legacy OAuth
```

### Required in .env:
```env
# REQUIRED:
CLERK_SECRET_KEY=sk_test_... or sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... or pk_live_...

# STILL REQUIRED:
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4577
```

### Update .env.example:

```env
# Authentication - Clerk (Required)
CLERK_SECRET_KEY=your_clerk_secret_key_here
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

# Database (Required)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# AI Generation (Required)
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4577

# Payments (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# eBay Integration (Optional)
EBAY_APP_ID=...
EBAY_DEV_ID=...
EBAY_CERT_ID=...
EBAY_SITE_ID=3
EBAY_SANDBOX=false

# Logging
LOG_LEVEL=info
```

## Package.json Updates

### Remove dependencies:
```bash
npm uninstall bcryptjs jsonwebtoken google-auth-library
```

### Update package.json:
```json
{
  "dependencies": {
    // REMOVE:
    // "bcryptjs": "^2.4.3",
    // "jsonwebtoken": "^9.0.2",
    // "google-auth-library": "^x.x.x",  // if installed

    // KEEP:
    "@clerk/clerk-sdk-node": "^4.13.23",
    // ... other dependencies
  }
}
```

## Testing Checklist

### Manual Tests:

- [ ] **Start server**: `npm run dev` - should start without JWT_SECRET error
- [ ] **Check /api/config/auth**: Returns Clerk config only
- [ ] **Sign in with Google (Clerk OAuth)**:
  - [ ] Click "Sign in with Google" button
  - [ ] Redirected to Google OAuth
  - [ ] Redirected back to app
  - [ ] User authenticated and stored in database
  - [ ] Check database: `SELECT * FROM users WHERE clerk_id IS NOT NULL;`
- [ ] **Protected routes work**:
  - [ ] GET /api/listings (with Clerk token in Authorization header)
  - [ ] POST /api/generate (with Clerk token)
- [ ] **Invalid token rejected**:
  - [ ] Request with invalid token returns 403
- [ ] **No token rejected**:
  - [ ] Request without token returns 401
- [ ] **Sign out**:
  - [ ] Clerk session cleared
  - [ ] Cannot access protected routes

### Database Verification:

```sql
-- Check users have clerk_id
SELECT id, email, clerk_id, auth_provider FROM users LIMIT 10;

-- Check no new password_hash entries (should be NULL for new users)
SELECT id, email, password_hash IS NULL as no_password, clerk_id FROM users WHERE created_at > NOW() - INTERVAL '1 day';
```

## Rollback Plan

If migration fails:

1. **Restore server.js** from git:
   ```bash
   git checkout HEAD -- server.js
   ```

2. **Reinstall JWT dependencies**:
   ```bash
   npm install bcryptjs jsonwebtoken
   ```

3. **Restore .env**:
   Add back `JWT_SECRET=...`

4. **Restart server**:
   ```bash
   npm run dev
   ```

## Security Improvements Included

1. ✅ **No more JWT secrets** - Eliminates weak secret risk
2. ✅ **No password storage** - No more password_hash vulnerabilities
3. ✅ **Centralized auth** - Clerk handles security (MFA, brute force protection, etc.)
4. ✅ **Audit logging** - All auth events logged with request ID
5. ✅ **Session management** - Clerk provides proper session revocation
6. ✅ **Rate limiting** - Already in place for auth endpoints

## Next Steps (Optional Improvements)

1. **CSRF Protection**: Implement CSRF tokens for state-changing operations
2. **httpOnly Cookies**: Store Clerk tokens in httpOnly cookies instead of localStorage
3. **Webhooks**: Listen to Clerk webhooks for user events
4. **MFA**: Enable MFA in Clerk dashboard
5. **Audit Table**: Create database table for auth audit logs

## Support

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Issue Tracking**: Check server logs for auth errors with request IDs

## Migration Completion Date

**Date**: [TO BE FILLED]
**Migrated By**: [NAME]
**Server Version**: 2.0.0 (Clerk-only)
