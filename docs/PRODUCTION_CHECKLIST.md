# ✅ Production Deployment Checklist

> **Reminder:** Authentication is Clerk-only. Skip any references to `JWT_SECRET` or Neon Auth unless you're reviewing legacy history.

## Pre-Deployment

### Security
- [x] All environment variables validated
- [x] JWT_SECRET is strong (32+ chars in production)
- [x] Helmet.js security headers configured
- [x] CORS restricted to known origins
- [x] Rate limiting implemented
- [x] Input validation on all endpoints
- [x] SQL injection protection (parameterized queries)
- [x] XSS protection headers
- [x] Security.txt file created

### Configuration
- [x] vercel.json configured
- [x] API routes configured for Vercel
- [x] Environment variable template created
- [x] Build scripts added
- [x] Frontend API URL auto-detection

### Code Quality
- [x] All console.log removed (server-side)
- [x] Error handling comprehensive
- [x] Logging structured with request IDs
- [x] Transaction handling implemented
- [x] Usage tracking implemented

### Performance
- [x] Compression middleware added
- [x] Database connection pooling configured
- [x] Pagination implemented
- [x] Batch database operations
- [x] Health check optimized

### Documentation
- [x] API documentation created
- [x] Deployment guide created
- [x] Environment setup documented
- [x] Troubleshooting guide included

---

## Deployment Steps

### 1. Environment Setup
```bash
# Generate secure JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set all environment variables in Vercel dashboard
```

### 2. Database Setup
- [ ] Create Neon PostgreSQL database (or use existing)
- [ ] Set DATABASE_URL in Vercel
- [ ] Test connection
- [ ] Initialize schema via `/api/init-db`

### 3. Vercel Deployment
- [ ] Connect GitHub repository
- [ ] Configure project settings
- [ ] Set environment variables
- [ ] Deploy
- [ ] Verify deployment

### 4. Post-Deployment
- [ ] Test health check endpoint
- [ ] Test authentication flow
- [ ] Test listing generation
- [ ] Verify CORS working
- [ ] Check error handling
- [ ] Monitor logs

### 5. Security Hardening
- [ ] Restrict `/api/init-db` endpoint
- [ ] Set ALLOW_DB_INIT=false in production
- [ ] Verify security headers
- [ ] Test rate limiting
- [ ] Verify CORS restrictions

### 6. Monitoring Setup
- [ ] Set up error tracking (optional)
- [ ] Configure uptime monitoring
- [ ] Set up log aggregation
- [ ] Create alerts

---

## Production Environment Variables

### Required
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<64-char-random-string>
GEMINI_API_KEY=...
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
```

### Recommended
```env
LOG_LEVEL=info
ALLOW_DB_INIT=false
```

### Optional
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
EBAY_APP_ID=...
```

---

## Verification Tests

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```
Expected: `{"status":"ok",...}`

### 2. Authentication
```bash
curl -X POST https://your-app.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```
Expected: User object + token

### 3. Protected Endpoint
```bash
curl https://your-app.vercel.app/api/listings \
  -H "Authorization: Bearer <token>"
```
Expected: Listings array or empty array

### 4. Rate Limiting
```bash
# Make 6 rapid signup requests
# 6th should return 429
```

### 5. CORS
```bash
curl -H "Origin: https://evil.com" \
  https://your-app.vercel.app/api/listings
```
Expected: CORS error or 403

---

## Rollback Plan

If deployment fails:

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "Promote to Production"
4. Investigate issue in logs

---

## Success Criteria

- [ ] All endpoints responding correctly
- [ ] Authentication working
- [ ] Database connected
- [ ] Health check passing
- [ ] Security headers present
- [ ] Rate limiting working
- [ ] CORS restricted
- [ ] No console errors
- [ ] Performance acceptable (<2s response time)

---

**Status**: Ready for deployment ✅
