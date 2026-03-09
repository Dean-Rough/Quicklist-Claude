# Gemini API Cost Protection & Usage Tracking

## Overview

Comprehensive API protection system to prevent excessive costs and track Gemini API usage.

**Status:** ✅ Implemented
**Date:** 2026-03-09
**Priority:** CRITICAL - Live in production

---

## Features

### 1. **Tier-Based Rate Limiting**

| Tier | Daily Limit | Monthly Limit | Max Images/Request |
|------|------------|---------------|-------------------|
| Free | 10 | 200 | 5 |
| Starter | 50 | 1,000 | 10 |
| Pro | 200 | 5,000 | 20 |
| Business | Unlimited | Unlimited | 50 |

### 2. **Cost Estimation**

- Estimates token usage before API call
- Tracks input & output tokens
- Uses Gemini Flash pricing:
  - Input: $0.075 per 1M tokens
  - Output: $0.30 per 1M tokens

### 3. **Global Budget Protection**

- Monthly budget limit (default: $500)
- Tracks cumulative spend
- Blocks requests when budget exceeded

### 4. **Emergency Kill Switch**

Set environment variable to immediately disable all Gemini API calls:
```bash
GEMINI_EMERGENCY_SHUTDOWN=true
```

### 5. **Usage Logging**

All API calls logged to database:
- User ID
- Endpoint
- Image count
- Estimated cost
- Token usage
- Timestamp

---

## Implementation

### Files Created

1. **`middleware/apiProtection.js`** - Main protection middleware
2. **`migrations/add_api_usage_tracking.sql`** - Database schema
3. **`API_PROTECTION.md`** - This documentation

### Files Modified

1. **`server.js`** - Added middleware to endpoints

### Protected Endpoints

- `POST /api/generate` - Main listing generation
- `POST /api/photo-dump/group` - Photo grouping
- `POST /api/photo-dump/generate` - Batch generation

---

## Database Schema

### New Table: `api_usage_logs`

```sql
CREATE TABLE api_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  endpoint VARCHAR(255),
  image_count INT,
  estimated_cost DECIMAL(10, 6),
  tokens_used INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### New Views

- `api_usage_summary` - Daily aggregated stats
- `user_usage_summary` - Per-user statistics

### New Columns on `users`

- `subscription_tier` - free/starter/pro/business
- `subscription_status` - active/inactive
- `subscription_end_date` - Expiry date

---

## Setup Instructions

### 1. Run Database Migration

```bash
# Connect to your database
psql $DATABASE_URL

# Run migration
\i migrations/add_api_usage_tracking.sql
```

### 2. Set Environment Variables

```bash
# Required
GEMINI_MONTHLY_BUDGET=500  # Monthly spend limit in USD

# Optional
GEMINI_EMERGENCY_SHUTDOWN=false  # Emergency kill switch
ADMIN_EMAILS=admin@quicklist.it.com,you@example.com  # Admin access
```

### 3. Restart Server

```bash
npm run dev  # Development
npm start    # Production
```

---

## Usage

### For Developers

The middleware runs automatically on protected endpoints. No code changes needed for basic usage.

**Request Flow:**
```
1. User makes API call
2. authenticateToken verifies user
3. protectGeminiAPI checks:
   - Emergency shutdown status
   - Global budget
   - User tier limits
   - Daily/monthly quotas
   - Image count per request
4. If allowed:
   - Log usage to database
   - Update monthly spend tracker
   - Proceed to API call
5. If blocked:
   - Return 429 with reason
   - Suggest upgrade if applicable
```

### For Admins

**View Usage Stats:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://quicklist.it.com/api/admin/usage-stats
```

**Response:**
```json
{
  "monthlyStats": {
    "total_calls": 1250,
    "total_images": 5430,
    "total_cost": 12.45,
    "total_tokens": 1500000,
    "unique_users": 89
  },
  "monthlySpend": 12.45,
  "monthlyBudget": 500,
  "budgetRemaining": 487.55,
  "emergencyShutdown": false
}
```

---

## Error Responses

### 1. Emergency Shutdown
```json
{
  "error": "Service temporarily unavailable. Please try again later.",
  "code": "EMERGENCY_SHUTDOWN"
}
```
**HTTP Status:** 503

### 2. Budget Exceeded
```json
{
  "error": "Monthly API budget exceeded. Service will resume next month.",
  "code": "BUDGET_EXCEEDED"
}
```
**HTTP Status:** 429

### 3. Daily Limit Reached
```json
{
  "error": "Daily limit reached (10 generations/day for free tier)",
  "code": "RATE_LIMIT_EXCEEDED",
  "currentUsage": {
    "dailyCount": 10,
    "monthlyCount": 45
  },
  "limits": {
    "daily": 10,
    "monthly": 200,
    "maxImagesPerRequest": 5
  },
  "upgradePrompt": "Upgrade to Starter for 50 generations/day"
}
```
**HTTP Status:** 429

### 4. Too Many Images
```json
{
  "error": "Too many images (max 5 for free tier)",
  "code": "RATE_LIMIT_EXCEEDED",
  "upgradePrompt": "Upgrade for more images per request"
}
```
**HTTP Status:** 429

---

## Monitoring

### Database Queries

**Daily usage:**
```sql
SELECT * FROM api_usage_summary
ORDER BY usage_date DESC
LIMIT 7;
```

**Top users by cost:**
```sql
SELECT * FROM user_usage_summary
ORDER BY total_cost DESC
LIMIT 20;
```

**Today's spend:**
```sql
SELECT SUM(estimated_cost) as today_cost
FROM api_usage_logs
WHERE created_at >= CURRENT_DATE;
```

**Users approaching limits:**
```sql
SELECT
  u.email,
  u.subscription_tier,
  COUNT(*) as today_count,
  CASE
    WHEN u.subscription_tier = 'free' THEN 10
    WHEN u.subscription_tier = 'starter' THEN 50
    WHEN u.subscription_tier = 'pro' THEN 200
    ELSE 999999
  END as daily_limit
FROM users u
JOIN api_usage_logs l ON u.id = l.user_id
WHERE l.created_at >= CURRENT_DATE
GROUP BY u.id, u.email, u.subscription_tier
HAVING COUNT(*) > CASE
  WHEN u.subscription_tier = 'free' THEN 8
  WHEN u.subscription_tier = 'starter' THEN 45
  WHEN u.subscription_tier = 'pro' THEN 180
  ELSE 999999
END
ORDER BY today_count DESC;
```

---

## Cost Estimation Formula

```javascript
// Per image: ~258 tokens at 1024x1024
const IMAGE_TOKENS = 258;
const PROMPT_TOKENS = 500;
const OUTPUT_TOKENS = 1000;

const inputTokens = (imageCount * IMAGE_TOKENS) + PROMPT_TOKENS;
const outputTokens = OUTPUT_TOKENS;

// Gemini Flash pricing
const inputCost = (inputTokens / 1_000_000) * 0.075;
const outputCost = (outputTokens / 1_000_000) * 0.30;
const totalCost = inputCost + outputCost;
```

**Example:**
- 5 images = 1,790 input tokens + 1,000 output tokens
- Cost = (1,790 / 1M * $0.075) + (1,000 / 1M * $0.30)
- Cost = $0.000134 + $0.000300 = **$0.000434 per request**
- At 10 requests/day = $0.004/day = $0.13/month per free user

---

## Emergency Procedures

### Scenario 1: Unexpected High Usage

1. Check admin stats: `GET /api/admin/usage-stats`
2. Identify high-usage users in database
3. Contact users if needed
4. If critical, enable emergency shutdown:
   ```bash
   # In Vercel dashboard or .env
   GEMINI_EMERGENCY_SHUTDOWN=true
   ```
5. Redeploy or restart server

### Scenario 2: Budget About to Exceed

1. Check monthly spend via admin endpoint
2. If approaching limit (e.g., $450/$500):
   - Lower `GEMINI_MONTHLY_BUDGET` to current spend
   - Or enable emergency shutdown
3. Notify users of temporary disruption
4. Re-enable next month

### Scenario 3: Suspected Abuse

1. Query user usage summary:
   ```sql
   SELECT * FROM user_usage_summary
   WHERE month_count > 100
   ORDER BY total_cost DESC;
   ```
2. Review specific user logs:
   ```sql
   SELECT * FROM api_usage_logs
   WHERE user_id = <suspected_user_id>
   ORDER BY created_at DESC
   LIMIT 50;
   ```
3. If confirmed abuse:
   - Update user tier to 'free' (lower limits)
   - Or contact user
   - Or ban if TOS violation

---

## Future Enhancements

- [ ] Real-time dashboard UI
- [ ] Email alerts for high usage
- [ ] Per-endpoint cost breakdown
- [ ] Historical cost trends
- [ ] Budget allocation by user tier
- [ ] Auto-upgrade prompts in UI
- [ ] Webhook notifications for budget milestones
- [ ] Cost optimization recommendations

---

## Testing

### Test Rate Limiting

```bash
# Make 11 requests rapidly (should block on 11th for free tier)
for i in {1..11}; do
  curl -X POST https://quicklist.it.com/api/generate \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"images": ["base64..."], "platform": "ebay"}'
  echo "Request $i complete"
done
```

### Test Budget Protection

```bash
# Temporarily set low budget
GEMINI_MONTHLY_BUDGET=0.01

# Try to make request (should block)
curl -X POST https://quicklist.it.com/api/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"images": ["base64..."], "platform": "ebay"}'
```

### Test Emergency Shutdown

```bash
# Enable shutdown
GEMINI_EMERGENCY_SHUTDOWN=true

# Try request (should return 503)
curl -X POST https://quicklist.it.com/api/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"images": ["base64..."], "platform": "ebay"}'
```

---

## Notes

- Middleware runs on every protected API call
- Usage logging is non-blocking (won't fail request if log fails)
- Cost estimates are approximate (actual may vary)
- Monthly spend tracker resets manually (TODO: auto-reset)
- Admin endpoint requires email in `ADMIN_EMAILS` env var
- Database queries are indexed for performance

---

**Questions or Issues?**
- Check logs: `logger.info/warn/error` statements throughout
- Review database: `api_usage_logs` table
- Contact: support@quicklist.it.com
