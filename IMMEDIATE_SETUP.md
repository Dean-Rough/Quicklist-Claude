# Immediate Vercel Setup Required

## Critical: Add Environment Variables NOW

Your site won't work until you add these environment variables in Vercel.

### Go to Vercel Dashboard
https://vercel.com/dean-roughs-projects/quicklist-claude/settings/environment-variables

### Add These 4 Required Variables:

1. **DATABASE_URL**
   ```
   Value: Your Neon PostgreSQL connection string
   Example: postgresql://user:pass@ep-xxx.neon.tech/quicklist?sslmode=require
   ```
   - Get from: https://console.neon.tech

2. **GEMINI_API_KEY**
   ```
   Value: Your Google Gemini API key
   Example: AIzaSy...
   ```
   - Get from: https://aistudio.google.com/app/apikey

3. **CLERK_SECRET_KEY**
   ```
   Value: Your Clerk secret key (starts with sk_test_)
   Example: sk_test_...
   ```
   - Get from: https://dashboard.clerk.com → API Keys

4. **CLERK_PUBLISHABLE_KEY**
   ```
   Value: Your Clerk publishable key (starts with pk_test_)
   Example: pk_test_...
   ```
   - Get from: https://dashboard.clerk.com → API Keys

### For Each Variable:
- Click **Add New**
- Enter the **Key** (e.g., `DATABASE_URL`)
- Enter the **Value**
- Select **All Environments** (Production, Preview, Development)
- Click **Save**

## After Adding Variables

1. **Redeploy**: Go to Deployments tab → Click three dots → **Redeploy**
2. **Wait**: Deployment takes ~30-60 seconds
3. **Test**: Visit https://quicklist.it.com

## What Should Work After Setup

✅ `/api/config/auth` - Returns Clerk configuration
✅ Sign up / Sign in - Clerk authentication works
✅ `/manifest.json` - PWA manifest loads
✅ `/icons/*` - All icons load
✅ `/brand/*` - Logo SVGs load
✅ Service Worker - Registers successfully

## Troubleshooting

### Still getting "Authentication system not ready"?
- Check that CLERK_PUBLISHABLE_KEY is set correctly
- Verify it starts with `pk_test_`
- Make sure you redeployed after adding variables

### API still returning 404?
- Verify all 4 environment variables are added
- Check that "All Environments" was selected
- Force redeploy from Vercel dashboard

### Database errors?
- Verify DATABASE_URL includes `?sslmode=require`
- Check Neon database is active and not paused
- Test connection string in a database client first

## Quick Test Commands

```bash
# Test API health
curl https://quicklist.it.com/api/health

# Test auth config (should return JSON with Clerk key)
curl https://quicklist.it.com/api/config/auth

# Test manifest
curl https://quicklist.it.com/manifest.json
```

## Need Help?

Refer to the comprehensive guide: [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md)

---

**Critical**: The site will NOT work until you add the 4 environment variables above. This takes about 2 minutes.
