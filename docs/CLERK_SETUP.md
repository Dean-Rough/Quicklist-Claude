# 🔐 Clerk Authentication Setup Guide

## ✅ What's Been Done

1. ✅ Installed `@clerk/express` package (official Express.js SDK)
2. ✅ Updated server.js with `clerkMiddleware()` and `getAuth()`
3. ✅ Added Clerk SDK to frontend (index.html)
4. ✅ Created auth config endpoint `/api/config/auth`
5. ✅ Simplified auth middleware using Clerk Express helpers
6. ✅ Added user sync from Clerk to database
7. ✅ Updated frontend auth functions

## 📋 Setup Steps

### 1. Add Environment Variables

Add these to your `.env` file:

```env
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

Get these keys from your [Clerk Dashboard](https://dashboard.clerk.com) → API Keys section.

### 2. Update Database Schema

Run the migration to add `clerk_id` column:

```bash
# Connect to your database and run:
psql $DATABASE_URL -f schema_clerk_migration.sql

# Or manually:
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
```

### 3. Configure Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Settings** → **OAuth**
4. Enable **Google** OAuth provider
5. Add redirect URLs:
   - Development: `http://localhost:4577`
   - Production: Your production URL

### 4. Restart Server

```bash
# Kill existing server
lsof -ti:4577 | xargs kill -9

# Start with Clerk enabled
cd /Users/deannewton/Projects/QLC/Quicklist-Claude
PORT=4577 npm run dev
```

## 🧪 Testing

### Test Auth Config Endpoint

```bash
curl http://localhost:4577/api/config/auth
# Should return: {"clerk":{"enabled":true,"publishableKey":"pk_test_..."},...}
```

### Test Authentication Flow

1. Open http://localhost:4577
2. Click "Sign In / Sign Up"
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Should redirect back and be authenticated

## 🔧 How It Works

### Backend Flow

1. Frontend gets Clerk session token
2. Sends token in `Authorization: Bearer <token>` header
3. Backend verifies token with Clerk SDK
4. Gets user info from Clerk
5. Syncs user to database (creates if doesn't exist)
6. Returns user info to frontend

### Frontend Flow

1. Clerk SDK loads on page load
2. Checks for existing session
3. If session exists, gets token and verifies with backend
4. Updates UI state
5. User can sign in via Google OAuth or email/password

## 🐛 Troubleshooting

### Clerk Not Initializing

- Check browser console for errors
- Verify `CLERK_PUBLISHABLE_KEY` is set correctly in your `.env` file
- Check that Clerk SDK loaded: `window.clerk` should exist

### Authentication Failing

- Check server logs for Clerk errors
- Verify `CLERK_SECRET_KEY` is correct
- Test token verification manually

### Database Sync Issues

- Ensure `clerk_id` column exists in users table
- Check database logs for constraint violations
- Verify user email is unique

## 📝 Notes

- Clerk automatically handles OAuth redirects
- Users are synced to database on first login
- Legacy JWT auth still works as fallback
- Clerk tokens are session-based (no expiration needed)

## 🚀 Next Steps

1. ✅ Add Clerk keys to `.env`
2. ✅ Run database migration
3. ✅ Configure Google OAuth in Clerk dashboard
4. ✅ Restart server
5. ✅ Test authentication flow
