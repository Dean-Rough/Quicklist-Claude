# Gemini API Failsafe Protection (NOT Rate Limiting!)

## ⚠️ READ THIS FIRST

**This is a FAILSAFE system, NOT customer rate limiting:**
- Limits are **intentionally VERY HIGH**
- Normal customers will **NEVER** hit these limits
- Even power users working all day won't hit them
- Only catches: bugs, infinite loops, accidents, abuse

**If a legitimate customer hits a limit, that's OUR bug - the limit needs raising!**

---

## Purpose

Protect against runaway costs from:
1. **Code bugs** - Infinite loops, retry storms
2. **UI accidents** - User rapidly clicking generate button
3. **Automated abuse** - Bots, scrapers
4. **Anomalies** - Unexpected usage patterns

**NOT for:**
- Managing customer usage
- Enforcing subscription tiers
- Limiting legitimate heavy users

---

## Failsafe Thresholds

### Free Tier
| Period | Limit | What It Means |
|--------|-------|---------------|
| Hourly | 50 | 1 request every 72 seconds for an hour |
| Daily | 100 | All-day heavy usage OK |
| Monthly | 2,000 | ~66/day average |
| Per Request | 50 images | Photo dump batches OK |

### Starter Tier
| Period | Limit | What It Means |
|--------|-------|---------------|
| Hourly | 200 | 1 request every 18 seconds |
| Daily | 500 | Professional all-day usage |
| Monthly | 10,000 | ~333/day average |
| Per Request | 50 images | Large batches OK |

### Pro Tier
| Period | Limit | What It Means |
|--------|-------|---------------|
| Hourly | 500 | Very rapid usage allowed |
| Daily | 2,000 | Heavy professional usage |
| Monthly | 50,000 | ~1,666/day average |
| Per Request | 100 images | Extra large batches |

### Business Tier
| Period | Limit | What It Means |
|--------|-------|---------------|
| Hourly | 1,000 | Even business gets hourly failsafe |
| Daily | ∞ | Unlimited |
| Monthly | ∞ | Unlimited |
| Per Request | 100 images | Large batches |

---

## Monthly Budget Failsafe

**Default: $5,000/month** (not $500!)

This is the **ultimate emergency brake**. It should be:
- Much higher than your expected monthly spend
- High enough for legitimate growth
- Low enough to catch catastrophic bugs

**Recommended settings:**
- Starting out: $1,000
- Growing: $5,000
- Established: $10,000+

Set via: `GEMINI_MONTHLY_BUDGET=5000`

---

## Emergency Kill Switch

```bash
GEMINI_EMERGENCY_SHUTDOWN=true
```

**Use when:**
- Unexpected massive spike in usage
- Suspected security breach
- Need immediate stop while investigating

**Effect:**
- ALL Gemini API calls blocked immediately
- Returns 503 to all users
- Logs "EMERGENCY SHUTDOWN"

---

## What Happens When Triggered

### Hourly Limit (Most Important)
```json
{
  "error": "Unusual activity detected: 50 requests in 1 hour. This suggests a potential issue. Please wait a moment and try again.",
  "code": "ANOMALY_DETECTED"
}
```
**This is the primary loop/bug detector**

### Daily Limit
```json
{
  "error": "Daily safety limit reached (100 generations). This is unusually high. If you need more, please contact support.",
  "code": "DAILY_FAILSAFE"
}
```

### Monthly Limit
```json
{
  "error": "Monthly safety limit reached (2000 generations). Please contact support to discuss your usage needs.",
  "code": "MONTHLY_FAILSAFE"
}
```

### Too Many Images
```json
{
  "error": "Too many images in one request (max 50). Try splitting into smaller batches.",
  "code": "TOO_MANY_IMAGES"
}
```

### Budget Exceeded
```json
{
  "error": "Monthly API budget exceeded. Service will resume next month.",
  "code": "BUDGET_EXCEEDED"
}
```

---

## Cost Tracking (Always On)

Every API call is logged:
- User ID
- Endpoint
- Image count
- Estimated cost
- Timestamp

**This runs regardless of limits** - gives you visibility into actual usage.

---

## Monitoring

### Admin Endpoint
```bash
GET /api/admin/usage-stats
Authorization: Bearer <your-token>
```

**Returns:**
```json
{
  "monthlyStats": {
    "total_calls": 1250,
    "total_images": 5430,
    "total_cost": 12.45,
    "unique_users": 89
  },
  "monthlySpend": 12.45,
  "monthlyBudget": 5000,
  "budgetRemaining": 4987.55,
  "emergencyShutdown": false
}
```

**Access:** Set `ADMIN_EMAILS=your@email.com` in environment

---

## Real-World Scenarios

### Scenario: Legitimate Power User
- **Usage:** 30 generations/day, every day
- **Monthly:** 900 generations
- **Result:** ✅ Never hits any limit (well under 2,000)

### Scenario: Batch Processing Business Customer
- **Usage:** 200 generations/day, 20 images each
- **Monthly:** 6,000 generations
- **Result:** ✅ Never hits limits (Pro tier: 50,000 monthly)

### Scenario: Infinite Loop Bug
- **Usage:** 1 request every 5 seconds (bug in frontend)
- **Result:** ❌ Hourly limit hit after 50 requests (~4 minutes)
- **Cost prevented:** Could have been thousands of requests

### Scenario: Accidental Double-Click
- **Usage:** User clicks generate 5 times rapidly
- **Result:** ✅ All succeed (well under 50/hour)

---

## Setup

### 1. Database Migration
```bash
psql $DATABASE_URL < migrations/add_api_usage_tracking.sql
```

### 2. Environment Variables
```bash
# Failsafe budget (set high!)
GEMINI_MONTHLY_BUDGET=5000

# Admin access
ADMIN_EMAILS=you@example.com

# Emergency kill switch (usually false)
GEMINI_EMERGENCY_SHUTDOWN=false
```

### 3. Deploy
Push to production - protection is active immediately

---

## Adjusting Limits

**If a legitimate customer hits a limit:**

1. **Check the logs** - Is this really legitimate?
2. **Raise the limit** in `middleware/apiProtection.js`
3. **Redeploy**
4. **Contact customer** to apologize

**Example adjustment:**
```javascript
// In middleware/apiProtection.js
free: {
  hourly: 100,  // Raised from 50
  daily: 200,   // Raised from 100
  // ...
}
```

---

## Monitoring Best Practices

### Daily
- Check `/api/admin/usage-stats`
- Look for anomalies
- Verify failsafe hasn't triggered

### Weekly
- Review cost trends
- Check for unusual users
- Adjust budget if needed

### Monthly
- Review total spend
- Analyze per-user costs
- Plan for next month's budget

---

## Cost Estimates

**Per request (average 5 images):**
- Input: ~1,790 tokens
- Output: ~1,000 tokens
- Cost: ~$0.00043

**Monthly costs at scale:**
```
Free users (50/day avg): $0.65/month each
Paid users (20/day avg): $0.26/month each

100 free users = $65/month
200 paid users = $52/month
Total = $117/month

Well under $5,000 failsafe!
```

---

## FAQ

**Q: Why not use strict subscription limits?**
A: We want customers to succeed. Strict limits create friction. Failsafes catch bugs without blocking real usage.

**Q: What if someone abuses this?**
A: Hourly limit catches abuse quickly. Plus we log everything. Can always lower limits for specific users if needed.

**Q: Should I lower the limits to save money?**
A: NO! That defeats the purpose. This is insurance, not a cost-saving measure. If cost is an issue, address it through pricing/tiers, not artificial limits.

**Q: A customer hit the hourly limit. What do I do?**
A: First, check if it's legitimate. If yes, raise the limit and apologize. If no (bug/abuse), investigate.

**Q: How do I know if limits are working?**
A: Check logs. If you never see "FAILSAFE TRIGGERED", limits are probably fine. If you see it for legitimate users, raise them!

---

## Emergency Procedures

### High Usage Alert
1. Check `/api/admin/usage-stats`
2. Identify the user(s)
3. Check their usage pattern (legitimate or anomaly?)
4. If anomaly: investigate code/logs
5. If needed: enable kill switch temporarily

### Budget About to Exceed
1. Check current spend
2. Identify top users
3. Options:
   - Raise budget temporarily
   - Enable kill switch
   - Lower limits for free tier only
4. Plan for next month

### Suspected Bug
1. Enable kill switch immediately
2. Check server logs for errors
3. Review recent deployments
4. Fix bug
5. Disable kill switch
6. Notify affected users

---

## Summary

✅ **DO:**
- Keep limits very high
- Monitor regularly
- Raise limits if customers hit them
- Use as insurance against bugs

❌ **DON'T:**
- Use for customer rate limiting
- Set limits too low
- Block legitimate usage
- Use as cost control mechanism

**Remember: Customers first, failsafe second!**

---

**Questions?** Check logs, adjust limits, or contact support.
