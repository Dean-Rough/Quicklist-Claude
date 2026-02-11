# 🚀 QuickList AI - Setup Checklist

> **Important:** QuickList now uses Clerk exclusively. Ignore any checklist items referencing JWT secrets or Neon Auth unless you're auditing historical behavior.

## ✅ What You Have (Environment Variables)

Based on your `.env` file, you have:

- ✅ Server configuration (PORT, NODE_ENV, FRONTEND_URL)
- ✅ Database connection (DATABASE_URL)
- ✅ Authentication (JWT_SECRET, Neon Auth vars)
- ✅ Google AI (GEMINI_API_KEY)
- ✅ Stripe (if using payments)
- ✅ Optional: eBay, Imgur

## 🔧 What You Need to Complete Setup

### 1. **Required Environment Variables** (Must Have)

These are the **minimum** to run the app:

```env
# ✅ You have these:
DATABASE_URL=postgresql://...          # Your Neon DB connection string
JWT_SECRET=...                         # Generate: openssl rand -hex 64
GEMINI_API_KEY=...                     # Get from Google AI Studio
NODE_ENV=development                   # or 'production'
FRONTEND_URL=http://localhost:4577     # or your production URL
```

### 2. **Neon Auth Setup** (For Google Sign-In)

To enable Google OAuth via Neon Auth:

1. **Enable Neon Auth in Neon Console:**
   - Go to https://console.neon.tech
   - Select your project
   - Navigate to **Neon Auth** settings
   - Enable Neon Auth
   - Copy **App ID** and **API Key**

2. **Add to `.env`:**

   ```env
   NEON_AUTH_APP_ID=your_app_id_from_neon_console
   NEON_AUTH_API_KEY=your_api_key_from_neon_console
   NEON_AUTH_URL=https://auth.neon.tech  # Default, usually fine
   ```

3. **Configure Google OAuth in Neon Console:**
   - In Neon Auth settings → OAuth Providers
   - Enable **Google**
   - Add Google OAuth credentials (Client ID & Secret from Google Cloud Console)
   - Set redirect URI: `http://localhost:4577` (dev) or your production URL

### 3. **Database Initialization**

Run the database setup:

```bash
# Start the server
npm start

# In another terminal or browser, visit:
http://localhost:3000/api/init-db
```

This creates all tables and indexes.

### 4. **Install Dependencies**

```bash
npm install
```

This installs:

- ✅ Express, PostgreSQL, Neon Auth SDK
- ✅ All required packages

### 5. **Test the Setup**

1. **Start server:**

   ```bash
   npm start
   ```

2. **Check health:**

   ```bash
   curl http://localhost:3000/api/health
   ```

   Should return: `{"status":"ok",...}`

3. **Open app:**

   ```
   http://localhost:4577
   ```

4. **Test auth:**
   - Click "Sign in with Google" (if Neon Auth configured)
   - Or use email/password (legacy auth)

## 📋 Quick Status Check

Run this to verify your setup:

```bash
# Check if required env vars are set
node -e "
const required = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY'];
const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.log('❌ Missing:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required env vars set');
"
```

## 🎯 What's Working vs What Needs Setup

### ✅ Already Working (No Setup Needed)

- Core app functionality
- AI listing generation (if GEMINI_API_KEY set)
- Database queries (if DATABASE_URL set)
- Legacy email/password auth (if JWT_SECRET set)

### ⚙️ Needs Configuration

- **Neon Auth** → Enable in Neon Console, add credentials
- **Google OAuth** → Configure in Neon Console (if using Neon Auth)
- **Stripe** → Add keys if using payments
- **eBay** → Add credentials if using eBay integration

### 🔒 Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOW_DB_INIT=false` (prevents accidental DB resets)
- [ ] Use production `DATABASE_URL` (not dev)
- [ ] Generate strong `JWT_SECRET` (64+ chars)
- [ ] Set production `FRONTEND_URL`
- [ ] Configure Neon Auth with production redirect URIs
- [ ] Use production Stripe keys (not test keys)
- [ ] Set `LOG_LEVEL=info` or `warn` (not debug)

## 🆘 Troubleshooting

**"Missing required environment variables" error?**
→ Check `.env` file exists and has DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

**Neon Auth not working?**
→ Check NEON_AUTH_APP_ID and NEON_AUTH_API_KEY are set
→ Verify Neon Auth is enabled in Neon Console
→ Check browser console for errors

**Database connection failed?**
→ Verify DATABASE_URL is correct
→ Check Neon project is active
→ Ensure SSL mode is correct (`?sslmode=require`)

**Can't sign in?**
→ If Neon Auth configured: Check OAuth redirect URI matches your domain
→ If legacy auth: Check JWT_SECRET is set and valid

## 📚 Next Steps

Once basic setup is complete, you can:

1. ✅ Test listing generation
2. ✅ Test saving/loading listings
3. ✅ Configure Stripe (if using payments)
4. ✅ Set up eBay integration (optional)
5. ✅ Deploy to production

---

**Need help?** Check:

- [NEON_AUTH_SETUP.md](./NEON_AUTH_SETUP.md) - Neon Auth details
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
