# 🚀 QuickList AI - Production Deployment

## Quick Start

### Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   cd Quicklist-Claude
   vercel
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - `GEMINI_API_KEY`
   - `FRONTEND_URL` (your Vercel app URL)
   - `NODE_ENV=production`

4. **Initialize Database**:
   Visit: `https://your-app.vercel.app/api/init-db?force=true`
   (Requires `ALLOW_DB_INIT=true` in environment)

5. **Verify**:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

---

## Environment Variables

See `DEPLOYMENT.md` for complete list.

**Required:**
- `DATABASE_URL`
- `JWT_SECRET` (32+ chars)
- `GEMINI_API_KEY`
- `FRONTEND_URL`
- `NODE_ENV=production`

---

## Architecture

- **Frontend**: Static HTML/CSS/JS served by Vercel
- **Backend**: Express.js serverless function on Vercel
- **Database**: Neon PostgreSQL (or any PostgreSQL)
- **CDN**: Vercel Edge Network (automatic)

---

## Security Features

✅ Helmet.js security headers  
✅ CORS restrictions  
✅ Rate limiting  
✅ Input validation  
✅ SQL injection protection  
✅ XSS protection  
✅ CSRF protection ready  
✅ Security.txt  

---

## Performance

- **CDN**: Global edge network
- **Compression**: Automatic gzip
- **Caching**: Static assets cached
- **Database**: Connection pooling
- **Pagination**: All list endpoints

---

## Monitoring

- **Health Check**: `/api/health`
- **Logs**: Vercel Dashboard → Logs
- **Errors**: Check response headers for `X-Request-ID`

---

## Support

- **Documentation**: See `DEPLOYMENT.md` and `API_DOCUMENTATION.md`
- **Issues**: Check Vercel logs and health endpoint
- **Security**: Report to security@quicklist.ai

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-27

