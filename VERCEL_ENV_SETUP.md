# Vercel Environment Variables Setup

## Required Environment Variables

Your QuickList application requires these environment variables to be set in Vercel:

### 1. Database (PostgreSQL - Neon)
```
DATABASE_URL=postgresql://username:password@host.neon.tech/quicklist?sslmode=require
```
Get from: https://neon.tech dashboard

### 2. AI (Google Gemini)
```
GEMINI_API_KEY=your_gemini_api_key
```
Get from: https://aistudio.google.com/app/apikey

### 3. Authentication (Clerk)
```
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```
Get from: https://dashboard.clerk.com → Your App → API Keys

### 4. Optional: Payments (Stripe)
```
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_CASUAL=price_xxxxx
STRIPE_PRICE_PRO=price_xxxxx
STRIPE_PRICE_MAX=price_xxxxx
```
Get from: https://dashboard.stripe.com/test/apikeys

### 5. Optional: eBay Integration
```
EBAY_APP_ID=your_ebay_app_id
EBAY_DEV_ID=your_ebay_dev_id
EBAY_CERT_ID=your_ebay_cert_id
EBAY_SITE_ID=3
EBAY_SANDBOX=true
```
Get from: https://developer.ebay.com/my/keys

### 6. Production Domain Configuration
```
FRONTEND_URL=https://quicklist.it.com
NODE_ENV=production
LOG_LEVEL=info
```

**Important**: `FRONTEND_URL` must match your actual production domain. This is used for:
- Stripe checkout redirect URLs
- CORS configuration
- OAuth callbacks
- Email notifications

## How to Add Environment Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dean-roughs-projects/quicklist-claude
2. Click **Settings** tab
3. Click **Environment Variables** in the sidebar
4. For each variable:
   - **Key**: Enter the variable name (e.g., `DATABASE_URL`)
   - **Value**: Enter the variable value
   - **Environments**: Select **Production**, **Preview**, and **Development**
   - Click **Add**
5. After adding all variables, click **Redeploy** on the Deployments tab

### Method 2: Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variables (one at a time)
vercel env add DATABASE_URL production
# Paste your database URL when prompted

vercel env add GEMINI_API_KEY production
# Paste your Gemini API key when prompted

vercel env add CLERK_SECRET_KEY production
# Paste your Clerk secret key when prompted

vercel env add CLERK_PUBLISHABLE_KEY production
# Paste your Clerk publishable key when prompted

# Repeat for all other variables...
```

### Method 3: Import from .env file

```bash
# Create a production.env file with all your variables
cat > production.env << 'EOF'
DATABASE_URL=your_database_url
GEMINI_API_KEY=your_gemini_key
CLERK_SECRET_KEY=your_clerk_secret
CLERK_PUBLISHABLE_KEY=your_clerk_publishable
FRONTEND_URL=https://quicklist.it.com
NODE_ENV=production
EOF

# Import all at once
vercel env pull production
```

## Quick Setup Checklist

- [ ] **Database**: Create Neon PostgreSQL database and copy connection string
- [ ] **Gemini AI**: Get API key from Google AI Studio
- [ ] **Clerk Auth**: Create Clerk app and copy both keys
- [ ] **Add all required env vars to Vercel** (DATABASE_URL, GEMINI_API_KEY, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY)
- [ ] **Set FRONTEND_URL** to your production domain
- [ ] **Optional**: Add Stripe keys if using payments
- [ ] **Redeploy** your Vercel project

## Testing Environment Variables

After adding environment variables and redeploying, test that they're working:

1. **Check API health endpoint**:
   ```bash
   curl https://quicklist.it.com/api/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check auth config endpoint**:
   ```bash
   curl https://quicklist.it.com/api/config/auth
   ```
   Should return Clerk configuration with publishable key

3. **Check database connection**:
   - Sign in to your app
   - Try creating a listing
   - Check that it saves to the database

## Common Issues

### "Authentication system not ready"
**Cause**: Clerk environment variables not set or incorrect
**Fix**:
1. Verify `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are set in Vercel
2. Check that keys start with `sk_test_` and `pk_test_`
3. Redeploy after adding variables

### "Database connection failed"
**Cause**: DATABASE_URL not set or incorrect
**Fix**:
1. Copy connection string from Neon dashboard
2. Ensure it includes `?sslmode=require`
3. Make sure to select all environments (Production, Preview, Development)

### "Failed to initialize auth"
**Cause**: Frontend can't reach `/api/config/auth`
**Fix**:
1. Check that API rewrites are working: `curl https://quicklist.it.com/api/config/auth`
2. Verify vercel.json has the rewrites configuration
3. Check Vercel deployment logs for errors

### Environment variables not updating
**Cause**: Vercel caches builds
**Fix**:
1. After changing env vars, go to Deployments tab
2. Click the three dots on latest deployment
3. Click **Redeploy**
4. Clear browser cache and test again

## Security Notes

- ✅ Never commit `.env` files to git
- ✅ Use test keys (`_test_`) for development/preview environments
- ✅ Use production keys (`_live_`) only for production environment
- ✅ Rotate keys if accidentally exposed
- ✅ Keep `CLERK_SECRET_KEY` and `STRIPE_SECRET_KEY` private

## Custom Domain Setup (quicklist.it.com)

### 1. Add Domain in Vercel

1. Go to your project: https://vercel.com/dean-roughs-projects/quicklist-claude
2. Click **Settings** → **Domains**
3. Enter your domain: `quicklist.it.com`
4. Click **Add**
5. Vercel will show you the DNS records to add

### 2. Configure DNS Records

Add these records in your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare):

**Option A: A Records (Recommended)**
```
Type: A
Name: @ (or leave blank for root domain)
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**Option B: CNAME Record**
```
Type: CNAME
Name: @ (or quicklist.it.com)
Value: cname.vercel-dns.com
```

### 3. Wait for DNS Propagation

- DNS changes can take 24-48 hours to fully propagate
- Check status: https://www.whatsmydns.net/#A/quicklist.it.com
- Vercel will automatically issue SSL certificate once DNS is verified

### 4. Update Clerk Configuration

After domain is active, update your Clerk app settings:

1. Go to https://dashboard.clerk.com
2. Select your app
3. Go to **Paths** or **URLs**
4. Update:
   - **Home URL**: `https://quicklist.it.com`
   - **Sign-in URL**: `https://quicklist.it.com`
   - **Sign-up URL**: `https://quicklist.it.com`
   - **Allowed redirect URLs**: `https://quicklist.it.com/*`

### 5. Update Stripe Configuration (if using Stripe)

1. Go to https://dashboard.stripe.com
2. Settings → **Business settings** → **Domain**
3. Add `quicklist.it.com` to allowed domains
4. Update webhook endpoint: `https://quicklist.it.com/api/stripe/webhook`

## Next Steps After Setup

1. ✅ Verify all environment variables are set in Vercel
2. ✅ Add custom domain (quicklist.it.com) in Vercel
3. ✅ Configure DNS records with your domain registrar
4. ✅ Wait for DNS propagation and SSL certificate
5. ✅ Update Clerk redirect URLs to use custom domain
6. ✅ Update FRONTEND_URL environment variable to `https://quicklist.it.com`
7. ✅ Redeploy your application
8. ✅ Test authentication by signing in
9. ✅ Test listing creation and database storage
10. ✅ Optional: Test Stripe checkout flow
