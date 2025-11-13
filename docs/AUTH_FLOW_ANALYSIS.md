# 🔐 Authentication Flow Analysis

> **Note:** QuickList now uses Clerk exclusively. The Neon Auth/JWT discussion below is historical and no longer reflects the live architecture.

## Current State

### ✅ What's Working
1. **Legacy JWT Auth** - Email/password signup and signin
   - Endpoints: `/api/auth/signup`, `/api/auth/signin`
   - Uses JWT tokens stored in localStorage
   - Fully functional

2. **Legacy Google OAuth** (if configured)
   - Endpoints: `/api/auth/google/url`, `/api/auth/google/callback`
   - Requires: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Only works if Neon Auth is NOT configured

### ❌ What's Missing/Broken

1. **Neon Auth Integration** - NOT CONFIGURED
   - Status: `enabled: false` (checked via `/api/config/neon-auth`)
   - Frontend expects it but backend endpoint is missing
   - Frontend tries to call `/api/auth/neon/callback` - **DOES NOT EXIST**

2. **Missing Backend Endpoint**
   - Frontend code calls: `POST /api/auth/neon/callback` (line 5067 in index.html)
   - This endpoint **does not exist** in server.js
   - This will cause 404 errors when trying to use Neon Auth

---

## Authentication Flow Diagrams

### Current Flow (Legacy JWT)

```
User → Sign In Form
  ↓
POST /api/auth/signin { email, password }
  ↓
Backend validates → Creates JWT token
  ↓
Frontend stores token in localStorage
  ↓
All API calls include: Authorization: Bearer <token>
  ↓
Backend verifies token via authenticateToken middleware
```

### Intended Flow (Neon Auth - NOT IMPLEMENTED)

```
User → Click "Sign in with Google"
  ↓
Frontend calls /api/config/neon-auth → Gets config
  ↓
Redirects to: ${baseUrl}/oauth/google?redirect_uri=...&project_id=...
  ↓
User authenticates with Google
  ↓
Google redirects back with ?code=... or ?token=...
  ↓
Frontend calls POST /api/auth/neon/callback { code }
  ↓
❌ ENDPOINT MISSING - Returns 404
```

---

## Environment Variables Needed

### For Legacy JWT Auth (Currently Working)
```env
JWT_SECRET=your_secure_random_secret_here
DATABASE_URL=postgresql://...
```

### For Neon Auth (NOT CONFIGURED)
```env
# Option 1: New naming convention (preferred)
STACK_PROJECT_ID=your_neon_auth_project_id
STACK_PUBLISHABLE_CLIENT_KEY=your_neon_auth_publishable_key
STACK_SECRET_SERVER_KEY=your_neon_auth_secret_key  # For backend verification

# Option 2: Legacy naming (also supported)
NEON_AUTH_APP_ID=your_neon_auth_app_id
NEON_AUTH_API_KEY=your_neon_auth_api_key
NEON_AUTH_URL=https://auth.neon.tech  # Default, usually fine
```

**Current Status:** All Neon Auth env vars are `null` → `enabled: false`

---

## What You Need to Do

### Option A: Use Legacy JWT Auth (Easiest - Already Working)

**No additional setup needed!** The app already supports email/password authentication.

1. Users can sign up with email/password
2. Users can sign in with email/password
3. JWT tokens are generated and stored
4. All API endpoints work with JWT tokens

**To use this:**
- Just use the email/password form in the auth modal
- No Neon Auth configuration needed

### Option B: Enable Neon Auth (Requires Setup)

#### Step 1: Get Neon Auth Credentials

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to **Neon Auth** settings
4. Enable Neon Auth
5. Copy:
   - **Project ID** (or App ID)
   - **Publishable Client Key** (or API Key)
   - **Secret Server Key** (for backend verification)

#### Step 2: Add to `.env`

```env
# Use ONE of these naming conventions:

# New naming (preferred):
STACK_PROJECT_ID=your_project_id_here
STACK_PUBLISHABLE_CLIENT_KEY=your_publishable_key_here
STACK_SECRET_SERVER_KEY=your_secret_key_here

# OR legacy naming:
NEON_AUTH_APP_ID=your_app_id_here
NEON_AUTH_API_KEY=your_api_key_here
NEON_AUTH_URL=https://auth.neon.tech
```

#### Step 3: Configure Google OAuth in Neon Console

1. In Neon Console → Neon Auth → OAuth Providers
2. Enable **Google**
3. Add Google OAuth credentials:
   - Get from [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 Client ID
   - Add redirect URI: `http://localhost:4577` (dev) or your production URL

#### Step 4: Install Neon Auth SDK

```bash
npm install @neondatabase/stack-js
```

#### Step 5: Implement Missing Backend Endpoint

**CRITICAL:** The frontend expects this endpoint but it doesn't exist:

```javascript
// Add to server.js after line 393 (after /api/auth/verify)

// Neon Auth callback endpoint
app.post('/api/auth/neon/callback', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }

        // TODO: Exchange code with Neon Auth API
        // This requires the Neon Auth SDK or direct API calls
        // Using STACK_SECRET_SERVER_KEY to verify
        
        // For now, this is a placeholder - needs implementation
        res.status(501).json({ error: 'Neon Auth callback not yet implemented' });
        
    } catch (error) {
        logger.error('Neon Auth callback error:', { error: error.message });
        res.status(500).json({ error: 'Authentication failed' });
    }
});
```

---

## Code Locations

### Frontend Auth Code
- **Legacy Sign In:** `index.html` line ~4934 (`signIn()`)
- **Legacy Sign Up:** `index.html` line ~4900 (`signUp()`)
- **Neon Auth Sign In:** `index.html` line ~5004 (`signInWithNeonAuth()`)
- **Neon Auth Callback:** `index.html` line ~5027 (`handleNeonAuthCallback()`)
- **Auth Check:** `index.html` line ~2248 (`checkAuth()`)

### Backend Auth Code
- **Config Endpoint:** `server.js` line 168 (`/api/config/neon-auth`)
- **Sign Up:** `server.js` line 276 (`POST /api/auth/signup`)
- **Sign In:** `server.js` line 333 (`POST /api/auth/signin`)
- **Verify Token:** `server.js` line 391 (`GET /api/auth/verify`)
- **Legacy Google OAuth:** `server.js` line 408-619 (only if Neon Auth not configured)
- **❌ Missing:** `POST /api/auth/neon/callback` - **DOES NOT EXIST**

---

## Recommendations

### Quick Fix: Use Legacy Auth

Since Neon Auth is not configured and the callback endpoint is missing, **use the legacy email/password auth** for now:

1. Users click "Sign In / Sign Up"
2. Use email/password form
3. Works immediately - no setup needed

### Full Implementation: Add Neon Auth Support

If you want Google OAuth via Neon Auth:

1. ✅ Get credentials from Neon Console
2. ✅ Add to `.env` file
3. ✅ Configure Google OAuth in Neon Console
4. ✅ Install `@neondatabase/stack-js`
5. ❌ **Implement `/api/auth/neon/callback` endpoint** (currently missing)
6. ❌ Update backend to use Neon Auth SDK for code exchange
7. ❌ Sync Neon Auth users with your `users` table

---

## Testing Current Auth

### Test Legacy JWT Auth
```bash
# Sign up
curl -X POST http://localhost:4577/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Sign in
curl -X POST http://localhost:4577/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Verify token (use token from signin response)
curl http://localhost:4577/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test Neon Auth Config
```bash
curl http://localhost:4577/api/config/neon-auth
# Should return: {"enabled": false} if not configured
```

---

## Summary

**Current Situation:**
- ✅ Legacy JWT auth works perfectly
- ❌ Neon Auth is not configured (`enabled: false`)
- ❌ Neon Auth callback endpoint is missing
- ❌ Frontend expects Neon Auth but backend doesn't support it

**What You Need:**
1. **For immediate use:** Just use email/password auth (already works)
2. **For Neon Auth:** Get credentials + implement missing endpoint + install SDK

**Next Steps:**
1. Decide: Legacy auth (works now) or Neon Auth (needs work)
2. If Neon Auth: Get credentials from Neon Console
3. If Neon Auth: Implement `/api/auth/neon/callback` endpoint
4. If Neon Auth: Install and configure Neon Auth SDK
