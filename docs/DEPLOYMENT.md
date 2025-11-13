# 🚀 QuickList AI - Production Deployment Guide

## Vercel Deployment

### Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **GitHub Repository**: Push code to GitHub
3. **Database**: Neon PostgreSQL database (or any PostgreSQL)
4. **Environment Variables**: All required vars configured

---

## Step 1: Prepare Repository

```bash
# Ensure all changes are committed
git add .
git commit -m "Production ready - Vercel deployment"
git push origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./Quicklist-Claude` (if repo root)
   - **Build Command**: `npm run build` (or leave empty)
   - **Output Directory**: `.` (current directory)
   - **Install Command**: `npm install`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd Quicklist-Claude
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: quicklist-ai
# - Directory: ./
# - Override settings? No
```

---

## Step 3: Configure Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables, add:

### Required Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
JWT_SECRET=your_secure_random_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
```

### Optional Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/auth/google/callback

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_STARTER=price_your_starter_id
STRIPE_PRICE_PRO=price_your_pro_id
STRIPE_PRICE_BUSINESS=price_your_business_id

# eBay (optional)
EBAY_APP_ID=your_ebay_app_id
EBAY_DEV_ID=your_ebay_dev_id
EBAY_CERT_ID=your_ebay_cert_id
EBAY_SITE_ID=3
EBAY_SANDBOX=false

# Imgur (optional)
IMGUR_CLIENT_ID=your_imgur_client_id

# Logging
LOG_LEVEL=info
PORT=3000
```

**Important**: 
- Set all variables for **Production** environment
- Use **live** Stripe keys (not test keys)
- Set `EBAY_SANDBOX=false` for production
- Generate new `JWT_SECRET` for production

---

## Step 4: Initialize Database

After first deployment:

1. Visit: `https://your-app.vercel.app/api/init-db`
2. This creates all tables and indexes
3. **Note**: This endpoint should be restricted in production (add authentication)

---

## Step 5: Verify Deployment

### Health Check
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T...",
  "services": {
    "database": "ok",
    "gemini": "configured",
    "stripe": "configured"
  }
}
```

### Test Authentication
1. Visit: `https://your-app.vercel.app`
2. Sign up with test account
3. Verify JWT token received
4. Test listing generation

---

## Step 6: Configure Custom Domain (Optional)

1. In Vercel Dashboard → Project → Settings → Domains
2. Add your domain: `quicklist.ai`
3. Follow DNS configuration instructions
4. Update `FRONTEND_URL` environment variable

---

## Production Checklist

- [x] All environment variables configured
- [x] Database initialized (`/api/init-db`)
- [x] Health check passing
- [x] Authentication working
- [x] Listing generation working
- [x] Custom domain configured (if applicable)
- [x] SSL certificate active (automatic with Vercel)
- [x] Error tracking configured (optional)
- [x] Monitoring set up (optional)

---

## Post-Deployment

### Restrict Database Initialization

Add authentication to `/api/init-db` endpoint:

```javascript
app.get('/api/init-db', authenticateToken, async (req, res) => {
    // Only allow admin users
    if (req.user.email !== 'admin@quicklist.ai') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    // ... rest of code
});
```

### Set Up Monitoring

1. **Error Tracking**: Add Sentry or similar
2. **Uptime Monitoring**: Use UptimeRobot or similar
3. **Logs**: View in Vercel Dashboard → Logs

### Database Backups

Configure automated backups:
- Neon: Automatic backups enabled
- Or use pg_dump cron job

---

## Troubleshooting

### Issue: Database Connection Failed

**Solution**: 
- Verify `DATABASE_URL` is correct
- Check SSL mode (`?sslmode=require`)
- Ensure database allows Vercel IPs

### Issue: CORS Errors

**Solution**:
- Verify `FRONTEND_URL` matches your domain
- Check CORS configuration in `server.js`

### Issue: API Routes Not Working

**Solution**:
- Verify `vercel.json` configuration
- Check route rewrites
- Ensure `api/server.js` exists

### Issue: Static Files Not Loading

**Solution**:
- Verify `express.static('.')` configuration
- Check file paths are correct
- Verify build output

---

## Environment-Specific Configuration

### Development
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:4577
LOG_LEVEL=debug
```

### Production
```env
NODE_ENV=production
FRONTEND_URL=https://quicklist.ai
LOG_LEVEL=info
```

---

## Rollback Procedure

If deployment fails:

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"
4. Investigate issue in failed deployment logs

---

## Performance Optimization

### Vercel Edge Functions (Future)

Consider migrating API routes to Edge Functions for:
- Faster response times
- Lower latency globally
- Better scalability

### CDN Configuration

Vercel automatically provides:
- Global CDN for static assets
- Automatic compression
- HTTP/2 support
- Image optimization

---

## Security Hardening

✅ **Completed**:
- Helmet.js security headers
- CORS restrictions
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection headers

**Additional Recommendations**:
- Enable Vercel DDoS protection
- Configure WAF rules
- Set up IP allowlisting for admin endpoints
- Implement 2FA for admin accounts

---

## Support

For deployment issues:
- Check Vercel logs: Dashboard → Logs
- Review error messages in browser console
- Verify environment variables
- Test API endpoints with curl/Postman

---

**Last Updated**: 2025-01-27

