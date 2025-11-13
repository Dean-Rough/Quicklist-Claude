# ⚡ Quick Start Guide

> **Important:** Authentication now uses Clerk only. Ignore any legacy steps in this guide that mention `JWT_SECRET`, Neon Auth, or manual OAuth configuration—they no longer apply. Use `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` instead.

## What You Need Right Now

### 1. **Minimum Required Setup** (To Run Locally)

```bash
# 1. Copy env.example to .env
cp env.example .env

# 2. Fill in these 3 REQUIRED variables in .env:
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require  # Your Neon DB
JWT_SECRET=$(openssl rand -hex 64)                           # Generate secret
GEMINI_API_KEY=your_gemini_key_here                          # From Google AI Studio

# 3. Install dependencies
npm install

# 4. Initialize database
npm start
# Then visit: http://localhost:3000/api/init-db

# 5. Open app
# Visit: http://localhost:4577
```

### 2. **For Google Sign-In (Neon Auth)**

```bash
# Add to .env:
NEON_AUTH_APP_ID=your_app_id        # From Neon Console > Neon Auth
NEON_AUTH_API_KEY=your_api_key      # From Neon Console > Neon Auth

# Then in Neon Console:
# 1. Enable Neon Auth
# 2. Enable Google OAuth provider
# 3. Add Google OAuth credentials
# 4. Set redirect URI: http://localhost:4577
```

## ✅ What's Already Done

- ✅ All code implemented
- ✅ Neon Auth integration ready
- ✅ Database schema ready
- ✅ API endpoints ready
- ✅ Frontend UI ready

## 🎯 What You Need to Provide

1. **Database URL** → From Neon Console
2. **JWT Secret** → Generate with `openssl rand -hex 64`
3. **Gemini API Key** → From [Google AI Studio](https://makersuite.google.com/app/apikey)
4. **Neon Auth Credentials** → From Neon Console (optional, for Google sign-in)

## 🚀 That's It!

Once you have those 3-4 values in your `.env` file, you're ready to go!

---

**Full details:** See [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
