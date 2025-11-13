# Clerk Authentication Implementation Analysis

> **Update:** The hybrid Clerk/JWT architecture described below has been superseded. QuickList AI now authenticates exclusively through Clerk—JWT fallback paths have been removed.

## Overview

QuickList AI implements a **hybrid authentication system** that supports both **Clerk** (modern, recommended) and **legacy JWT** (fallback). This architecture allows for graceful migration from the old JWT-based auth to Clerk while maintaining backward compatibility.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Check Clerk availability (window.clerk)            │ │
│  │  2. Try Clerk OAuth (Google)                           │ │
│  │  3. Fallback to legacy JWT (email/password)            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  authenticateToken Middleware                          │ │
│  │  1. Try Clerk token verification (if enabled)          │ │
│  │  2. Fallback to JWT verification                       │ │
│  │  3. Set req.user for downstream handlers               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Database                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  users table                                           │ │
│  │  - clerk_id (nullable) - Clerk user ID                │ │
│  │  - email (unique)                                      │ │
│  │  - password_hash (nullable for OAuth)                 │ │
│  │  - google_id (nullable for Google OAuth)              │ │
│  │  - auth_provider ('clerk', 'google', 'email')         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Detection

### Environment Variables

**Clerk (Recommended)**:
```env
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Legacy JWT (Fallback)**:
```env
JWT_SECRET=your_secure_random_secret_here
```

### Server-Side Detection

Location: [server.js:36-45](server.js#L36-L45)

```javascript
const isClerkEnabled = !!(process.env.CLERK_SECRET_KEY &&
                          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

if (isClerkEnabled) {
    logger.info('Clerk authentication enabled');
} else {
    logger.warn('Clerk not configured, using legacy JWT auth');
    if (!process.env.JWT_SECRET) {
        logger.error('JWT_SECRET required when Clerk is not configured');
        process.exit(1);
    }
}
```

**Key Insight**: The system **requires at least one auth method**. If Clerk is not configured, JWT_SECRET is mandatory.

### Frontend Configuration Endpoint

Location: [server.js:181-205](server.js#L181-L205)

**Endpoint**: `GET /api/config/auth`

**Response**:
```json
{
  "clerk": {
    "enabled": true,
    "publishableKey": "pk_test_..."
  },
  "neonAuth": {
    "projectId": null,
    "publishableKey": null,
    "baseUrl": "https://auth.neon.tech",
    "enabled": false
  },
  "authProvider": "clerk"  // or "jwt" or "neon"
}
```

This endpoint allows the frontend to dynamically adapt to the backend's auth configuration.

## Frontend Implementation

### Initialization Flow

Location: [index.html:2125-2153](index.html#L2125-L2153)

```javascript
// 1. Fetch auth config from server
const response = await fetch('/api/config/auth');
const config = await response.json();

// 2. Initialize Clerk if enabled
if (config.clerk && config.clerk.enabled && config.clerk.publishableKey) {
    window.clerk = new Clerk(publishableKey);
    await window.clerk.load();

    // 3. Listen for auth state changes
    window.clerk.addListener(({ user, session }) => {
        if (user && session) {
            window.dispatchEvent(new CustomEvent('clerkSignedIn', {
                detail: { user, session }
            }));
        } else {
            window.dispatchEvent(new CustomEvent('clerkSignedOut'));
        }
    });
}

// 4. Signal that auth system is ready
window.dispatchEvent(new CustomEvent('authReady'));
```

### Authentication Check on App Init

Location: [index.html:2216-2235](index.html#L2216-L2235)

```javascript
async init() {
    // 1. Wait for auth system to be ready
    await new Promise((resolve) => {
        window.addEventListener('authReady', resolve, { once: true });
    });

    // 2. Try Clerk auth first
    await this.checkClerkAuth();

    // 3. Fallback to legacy JWT if not authenticated
    if (!this.state.isAuthenticated) {
        await this.verifyToken();
    }

    // 4. Update UI based on auth state
    this.updateUI();
}
```

### Clerk Sign-In Flow

Location: [index.html:5046-5067](index.html#L5046-L5067)

**Method**: `app.signInWithClerk(provider)`

```javascript
async signInWithClerk(provider = 'google') {
    if (!window.clerk) {
        this.showToast('Clerk not initialized', 'error');
        return;
    }

    if (provider === 'google') {
        // OAuth redirect flow
        await window.clerk.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: window.location.href,
            redirectUrlComplete: window.location.href
        });
    } else {
        // Clerk UI for email/password
        await window.clerk.openSignIn();
    }
}
```

**UI Integration**: Location [index.html:2047-2055](index.html#L2047-L2055)

```html
<button
    class="btn btn-secondary clerk-oauth-btn"
    data-provider="google"
    onclick="app.signInWithClerk('google')"
>
    <svg><!-- Google logo --></svg>
    Sign in with Google
</button>
```

### Clerk Authentication Check

Location: [index.html:5013-5043](index.html#L5013-L5043)

```javascript
async checkClerkAuth() {
    if (!window.clerk) return;

    const session = await window.clerk.session;
    if (session) {
        // Get Clerk session token
        const token = await session.getToken();

        // Verify with backend
        const response = await fetch(`${this.apiUrl}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            this.state.user = data.user;
            this.state.token = token;
            this.state.isAuthenticated = true;
            localStorage.setItem('quicklist-token', token);
        }
    }
}
```

### Sign Out Flow

Location: [index.html:5184-5192](index.html#L5184-L5192)

```javascript
async signOut() {
    // Sign out from Clerk if available
    if (window.clerk) {
        await window.clerk.signOut();
    }

    // Clear local state
    this.state.isAuthenticated = false;
    this.state.user = null;
    this.state.token = null;
    localStorage.removeItem('quicklist-token');

    // Update UI
    this.updateUI();
}
```

## Backend Implementation

### Authentication Middleware

Location: [server.js:276-324](server.js#L276-L324)

**Function**: `authenticateToken(req, res, next)`

This is the **core authentication middleware** used by all protected routes.

```javascript
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // ========== CLERK PATH ==========
    if (isClerkEnabled) {
        try {
            const { verifyToken } = require('@clerk/clerk-sdk-node');
            const session = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY
            });

            if (session && session.sub) {
                // Get full user from Clerk API
                const user = await clerkClient.users.getUser(session.sub);

                // Set req.user for downstream handlers
                req.user = {
                    id: user.id,
                    email: user.emailAddresses[0]?.emailAddress,
                    name: user.firstName + ' ' + user.lastName,
                    clerkId: user.id
                };
                return next();
            }
        } catch (clerkError) {
            logger.debug('Clerk auth failed, trying JWT fallback');
            // Fall through to JWT
        }
    }

    // ========== JWT FALLBACK ==========
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};
```

**Key Features**:
1. **Try Clerk first** if enabled
2. **Graceful fallback** to JWT if Clerk fails
3. **Consistent req.user** interface for downstream handlers
4. **No user preference** - Clerk always takes priority if configured

### Token Verification Endpoint

Location: [server.js:456-522](server.js#L456-L522)

**Endpoint**: `GET /api/auth/verify`

**Purpose**: Verify token validity and sync Clerk users to database.

```javascript
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    // If using Clerk, sync user to database
    if (isClerkEnabled && req.user.clerkId) {
        // Check if user exists in database
        const existingUser = await safeQuery(
            'SELECT * FROM users WHERE clerk_id = $1 OR email = $2',
            [req.user.clerkId, req.user.email]
        );

        if (existingUser.rows.length === 0 && req.user.email) {
            // Create user in database
            await safeQuery(
                `INSERT INTO users (email, clerk_id, auth_provider, name, password_hash)
                 VALUES ($1, $2, 'clerk', $3, NULL)
                 ON CONFLICT (email) DO UPDATE
                 SET clerk_id = EXCLUDED.clerk_id,
                     auth_provider = 'clerk',
                     name = EXCLUDED.name`,
                [req.user.email, req.user.clerkId, req.user.name]
            );

            // Create free tier subscription for new user
            // ...
        } else if (existingUser.rows[0] && !existingUser.rows[0].clerk_id) {
            // Migrate existing JWT user to Clerk
            await safeQuery(
                'UPDATE users SET clerk_id = $1, auth_provider = $2 WHERE id = $3',
                [req.user.clerkId, 'clerk', existingUser.rows[0].id]
            );
        }

        // Get database user ID
        const dbUser = await safeQuery(
            'SELECT id, email, name, clerk_id FROM users WHERE clerk_id = $1',
            [req.user.clerkId]
        );

        req.user.id = dbUser.rows[0].id;
    }

    res.json({ user: req.user });
});
```

**Critical Function**: This endpoint handles **automatic user migration** from JWT to Clerk:
- **New Clerk users** → Created in database
- **Existing users** → Linked with `clerk_id`

### Legacy JWT Endpoints

Location: [server.js:341-445](server.js#L341-L445)

**These endpoints are still active** for backward compatibility:

1. **POST /api/auth/signup**
   - Email/password registration
   - Bcrypt password hashing (10 rounds)
   - Returns JWT token (7-day expiry)

2. **POST /api/auth/signin**
   - Email/password login
   - Password verification with bcrypt
   - Returns JWT token

**Important**: These endpoints are **not disabled** when Clerk is enabled. They coexist to support:
- Users who signed up before Clerk migration
- Fallback if Clerk service is down
- Testing without Clerk credentials

## Database Schema

### Users Table

Location: [schema.sql:4-15](schema.sql#L4-L15)

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),        -- NULL for OAuth/Clerk users
    google_id VARCHAR(255) UNIQUE,     -- Legacy Google OAuth
    clerk_id VARCHAR(255) UNIQUE,      -- Clerk user ID (added via migration)
    auth_provider VARCHAR(50) DEFAULT 'email',  -- 'clerk', 'google', 'email'
    name VARCHAR(255),
    avatar_url TEXT,
    ebay_auth_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
```

### Migration Support

Location: [schema_clerk_migration.sql](schema_clerk_migration.sql)

```sql
-- For existing databases, run this migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
```

### Auth Provider States

| auth_provider | password_hash | clerk_id | google_id | Description |
|--------------|---------------|----------|-----------|-------------|
| `'email'` | ✓ | NULL | NULL | Legacy JWT user |
| `'clerk'` | NULL | ✓ | NULL | Clerk user (email or OAuth) |
| `'google'` | NULL | NULL | ✓ | Legacy Google OAuth user |

## Authentication Flows

### Flow 1: New User with Clerk (Google OAuth)

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Browser │                │ Server  │                │  Clerk  │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. Load /api/config/auth │                          │
     ├─────────────────────────>│                          │
     │ { clerk: { enabled:true }}                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 2. Initialize Clerk SDK  │                          │
     ├──────────────────────────┼─────────────────────────>│
     │                          │      Clerk UI loads      │
     │<─────────────────────────┼──────────────────────────┤
     │                          │                          │
     │ 3. Click "Sign in with Google"                      │
     ├──────────────────────────┼─────────────────────────>│
     │                          │   OAuth redirect to Google
     │<─────────────────────────┼──────────────────────────┤
     │                          │   (user authorizes)      │
     │                          │                          │
     │ 4. Redirected back with session                     │
     │<─────────────────────────┼──────────────────────────┤
     │                          │                          │
     │ 5. Get session token     │                          │
     ├──────────────────────────┼─────────────────────────>│
     │      token               │                          │
     │<─────────────────────────┼──────────────────────────┤
     │                          │                          │
     │ 6. POST /api/auth/verify │                          │
     │    Authorization: Bearer <token>                    │
     ├─────────────────────────>│                          │
     │                          │ 7. Verify token          │
     │                          ├─────────────────────────>│
     │                          │   session data           │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ 8. Create user in DB     │
     │                          │    (clerk_id, email)     │
     │                          │                          │
     │ 9. { user: {...} }       │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 10. Authenticated, store token in localStorage      │
     └──────────────────────────────────────────────────────┘
```

### Flow 2: Existing JWT User Migrating to Clerk

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Browser │                │ Server  │                │  Clerk  │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. User has old JWT token in localStorage           │
     │                          │                          │
     │ 2. Signs in via Clerk    │                          │
     ├──────────────────────────┼─────────────────────────>│
     │                          │                          │
     │ 3. Get Clerk token       │                          │
     │<─────────────────────────┼──────────────────────────┤
     │                          │                          │
     │ 4. POST /api/auth/verify │                          │
     │    Authorization: Bearer <clerk_token>              │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ 5. Find user by email    │
     │                          │    (email = user@ex.com) │
     │                          │    (clerk_id = NULL)     │
     │                          │                          │
     │                          │ 6. UPDATE users          │
     │                          │    SET clerk_id = 'xyz'  │
     │                          │    WHERE email = '...'   │
     │                          │                          │
     │ 7. { user: {...} }       │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 8. User migrated! Old JWT token no longer works.    │
     │    New Clerk token stored in localStorage.          │
     └──────────────────────────────────────────────────────┘
```

### Flow 3: Legacy JWT User (Clerk Disabled)

```
┌─────────┐                ┌─────────┐
│ Browser │                │ Server  │
└────┬────┘                └────┬────┘
     │                          │
     │ 1. Load /api/config/auth │
     ├─────────────────────────>│
     │ { authProvider: "jwt" }  │
     │<─────────────────────────┤
     │                          │
     │ 2. Show email/password form
     │                          │
     │ 3. POST /api/auth/signin │
     │    { email, password }   │
     ├─────────────────────────>│
     │                          │
     │                          │ 4. Check password hash
     │                          │    bcrypt.compare(...)
     │                          │
     │                          │ 5. Generate JWT
     │                          │    jwt.sign({...}, JWT_SECRET)
     │                          │
     │ 6. { user, token }       │
     │<─────────────────────────┤
     │                          │
     │ 7. Store token in localStorage
     └──────────────────────────┘
```

## Security Analysis

### Strengths

1. **Defense in Depth**: Dual auth system provides fallback
2. **Token Verification**: All tokens verified server-side
3. **Rate Limiting**: Auth endpoints limited to 5 req/15min
4. **Bcrypt Hashing**: Password hashing with 10 rounds
5. **JWT Expiry**: 7-day token expiration
6. **HTTPS Only**: Production enforces HTTPS
7. **Clerk Security**: Benefits from Clerk's security features:
   - MFA support
   - Session management
   - Brute force protection
   - Device tracking

### Potential Issues

1. **Dual Auth Complexity**: More attack surface with two systems
   - **Mitigation**: Clerk takes priority, JWT is fallback only

2. **JWT Secret Strength**: Requires 32+ chars in production
   - **Check**: [server.js:91-94](server.js#L91-L94) validates this
   - **Risk**: Weak secrets in development environments

3. **Token Storage**: Tokens stored in localStorage
   - **Risk**: XSS attacks can steal tokens
   - **Mitigation**: Helmet.js CSP headers, input sanitization
   - **Better**: Consider httpOnly cookies for JWT

4. **No Token Revocation**: JWT tokens cannot be invalidated before expiry
   - **Risk**: Stolen tokens valid until expiration
   - **Mitigation**: 7-day expiry limits exposure
   - **Clerk Benefit**: Clerk has proper session revocation

5. **Email Case Sensitivity**: Emails lowercased and trimmed
   - **Good**: Prevents duplicate accounts (john@ex.com vs John@ex.com)

6. **Migration Security**: Automatic linking by email
   - **Risk**: If Clerk account uses different email, user gets new account
   - **Impact**: Low (same user, just separate account)

### Recommendations

1. **Priority 1: Remove JWT Long-Term**
   - Fully migrate to Clerk
   - Remove JWT signup/signin endpoints
   - Reduces attack surface

2. **Priority 2: Token Storage**
   ```javascript
   // Instead of localStorage, use httpOnly cookie for JWT
   res.cookie('token', token, {
       httpOnly: true,
       secure: isProduction,
       sameSite: 'strict',
       maxAge: 7 * 24 * 60 * 60 * 1000
   });
   ```

3. **Priority 3: Token Revocation**
   - If keeping JWT, implement token blacklist
   - Use Redis for revoked tokens
   - Check blacklist in authenticateToken middleware

4. **Priority 4: CSRF Protection**
   - Implement CSRF tokens for state-changing operations
   - Use `csurf` middleware

5. **Priority 5: Audit Logging**
   - Log all authentication events
   - Track failed login attempts per user
   - Alert on suspicious activity

## Testing Checklist

### Manual Tests

- [ ] **Clerk Google OAuth**: Sign in with Google → verify user created in DB
- [ ] **Clerk Email**: Use Clerk email/password → verify works
- [ ] **JWT Legacy**: Sign up with email/password → verify JWT issued
- [ ] **JWT to Clerk Migration**: JWT user signs in via Clerk → verify `clerk_id` updated
- [ ] **Token Expiry**: Wait 7 days → verify JWT expired
- [ ] **Fallback**: Disable Clerk → verify JWT still works
- [ ] **Protected Routes**: Access `/api/listings` without token → verify 401
- [ ] **Rate Limiting**: 6 login attempts in 15min → verify rate limit error
- [ ] **Sign Out**: Sign out → verify Clerk session cleared
- [ ] **Concurrent Sessions**: Sign in on 2 devices → verify both work

### Automated Tests (Recommended)

```javascript
// Example test structure (not implemented)
describe('Authentication', () => {
    describe('Clerk Auth', () => {
        it('should authenticate with valid Clerk token');
        it('should reject invalid Clerk token');
        it('should sync Clerk user to database');
        it('should migrate JWT user to Clerk');
    });

    describe('JWT Auth', () => {
        it('should issue JWT on signup');
        it('should verify JWT on protected routes');
        it('should reject expired JWT');
    });

    describe('Middleware', () => {
        it('should try Clerk before JWT');
        it('should fallback to JWT if Clerk fails');
    });
});
```

## Migration Guide

### Current State
- Clerk is **partially implemented**
- JWT is **fully functional**
- Both coexist

### Recommended Migration Path

**Phase 1: Enable Clerk (Current State)**
- [x] Install `@clerk/clerk-sdk-node`
- [x] Add Clerk env vars
- [x] Implement Clerk frontend SDK
- [x] Implement Clerk backend verification
- [x] Add database `clerk_id` column
- [x] Implement auto-migration in `/api/auth/verify`

**Phase 2: Promote Clerk (Recommended Next Step)**
- [ ] Update UI to prioritize Clerk OAuth buttons
- [ ] Add banner encouraging existing users to "Sign in with Google"
- [ ] Monitor usage: track `auth_provider` distribution

**Phase 3: Deprecate JWT (Future)**
- [ ] Announce deprecation date (e.g., 90 days)
- [ ] Email users to migrate to Clerk
- [ ] Disable JWT signup (keep signin for existing users)
- [ ] Monitor: ensure no new JWT users

**Phase 4: Remove JWT (Final)**
- [ ] Disable JWT signin endpoint
- [ ] Remove JWT code from `authenticateToken`
- [ ] Remove `password_hash` column from database
- [ ] Remove `bcrypt` dependency
- [ ] Update documentation

## Configuration Examples

### Development (.env)
```env
# Clerk (recommended)
CLERK_SECRET_KEY=sk_test_abcd1234...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_efgh5678...

# JWT (fallback, keep for now)
JWT_SECRET=dev_secret_min_32_chars_long_abc123

# Database
DATABASE_URL=postgresql://...

# Other
GEMINI_API_KEY=...
PORT=4577
NODE_ENV=development
```

### Production (.env)
```env
# Clerk (primary)
CLERK_SECRET_KEY=sk_live_abcd1234...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_efgh5678...

# JWT (remove after full migration)
JWT_SECRET=<64_char_random_hex>

# Database
DATABASE_URL=postgresql://...

# Other
GEMINI_API_KEY=...
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://quicklist.ai
```

### Testing without Clerk
```env
# Disable Clerk, use JWT only
# CLERK_SECRET_KEY=  # commented out
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # commented out

JWT_SECRET=test_secret_for_development_only
DATABASE_URL=postgresql://...
```

## Troubleshooting

### Issue: "Clerk not initialized"
**Symptom**: Button click shows toast error
**Cause**: Clerk publishable key missing or invalid
**Fix**:
1. Check `/api/config/auth` returns valid publishable key
2. Check browser console for Clerk load errors
3. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in env vars

### Issue: "Invalid or expired token"
**Symptom**: API returns 403
**Cause**: JWT expired (7 days) or invalid
**Fix**:
1. Clear localStorage: `localStorage.removeItem('quicklist-token')`
2. Sign in again
3. Check token expiry: decode JWT at jwt.io

### Issue: Clerk user not syncing to database
**Symptom**: User authenticated but has no listings
**Cause**: `/api/auth/verify` not called or DB sync failed
**Fix**:
1. Check browser network tab: verify `/api/auth/verify` called
2. Check server logs for database errors
3. Manually query database: `SELECT * FROM users WHERE email = '...'`

### Issue: Rate limit on auth endpoints
**Symptom**: "Too many authentication attempts"
**Cause**: 5 requests in 15 minutes exceeded
**Fix**:
1. Wait 15 minutes
2. For development, increase limit in [server.js:97-103](server.js#L97-L103)

### Issue: Duplicate users (JWT and Clerk)
**Symptom**: Same email has 2 accounts
**Cause**: User signed up with JWT, then signed up (not signed in) with Clerk
**Fix**:
1. Manually merge in database
2. Update listings: `UPDATE listings SET user_id = <clerk_user_id> WHERE user_id = <jwt_user_id>`
3. Delete old user: `DELETE FROM users WHERE id = <jwt_user_id>`

## Summary

### Current Implementation Status
✅ **Implemented**:
- Clerk SDK integration (frontend & backend)
- Hybrid authentication middleware
- Automatic user migration (JWT → Clerk)
- Database schema support (`clerk_id` column)
- Dynamic auth config endpoint

⚠️ **Partially Complete**:
- UI still shows email/password forms (should prioritize Clerk)
- JWT still fully functional (good for now, deprecate later)

❌ **Not Implemented**:
- Token revocation
- CSRF protection
- Audit logging
- Automated tests

### Key Takeaways

1. **Graceful Migration**: The hybrid approach allows seamless transition without breaking existing users
2. **Clerk Priority**: When enabled, Clerk is always tried first
3. **Database Sync**: Clerk users automatically created/updated in database
4. **Backward Compatibility**: JWT still works, allowing gradual migration
5. **Security**: Both systems have good security, but Clerk provides better features (MFA, session management)

### Next Steps

1. **Update UI**: Make Clerk OAuth more prominent
2. **Monitor Usage**: Track `auth_provider` distribution
3. **Plan Deprecation**: Set timeline for JWT removal
4. **Improve Security**: Add token revocation, CSRF, audit logs
5. **Add Tests**: Implement automated test suite for auth flows
