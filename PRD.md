# Quicklist AI — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-02-10  
**Status:** Production (Active Development)

---

## 1. Executive Summary

**Quicklist AI** turns product photos into marketplace-ready listings in seconds. Users upload photos, AI analyzes the items, and generates complete listings with titles, descriptions, pricing recommendations, and keywords optimized for eBay, Vinted, and Gumtree.

### Value Proposition
- **Speed:** 30 seconds vs 10+ minutes per listing
- **Quality:** AI-generated descriptions that convert
- **Intelligence:** Market-based pricing recommendations
- **Convenience:** One upload → multiple platform formats

---

## 2. User Success Metrics

### Primary KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first listing | < 2 minutes | Signup → generated listing |
| Listings per user/month | 5+ (free), 20+ (paid) | Monthly active usage |
| Free → Paid conversion | 5-10% | Within 30 days of signup |
| User retention (30-day) | 40%+ | Return after first listing |

### Secondary KPIs
| Metric | Target | Notes |
|--------|--------|-------|
| AI accuracy (user edits) | < 20% fields edited | Fewer edits = better AI |
| Export completion rate | 80%+ | Users who download/copy listings |
| Upgrade modal → checkout | 15%+ | Click-through on upsell |
| NPS score | 40+ | Quarterly survey |

### User Success Definition
A user is "successful" when they:
1. Generate a listing they're happy with (minimal edits)
2. Export/copy it to a marketplace
3. Return to create more listings

---

## 3. Tech Stack

### Frontend
- **Framework:** Vanilla JavaScript (single-file `index.html`)
- **Styling:** CSS with CSS variables, dark mode default
- **State:** Single `app` object with reactive updates
- **No build step** — instant development iteration

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.x
- **Deployment:** Vercel Serverless Functions

### Database
- **Primary:** PostgreSQL (Neon serverless)
- **Tables:** `users`, `listings`, `images`, `subscriptions`, `usage_tracking`
- **Connection:** Pooled connections (max 20)

### AI / ML
- **Vision:** Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Capabilities:** Product identification, description generation, pricing research

### Authentication
- **Primary:** Clerk (OAuth, email, MFA)
- **Session:** Clerk session tokens
- **Legacy:** JWT fallback (deprecated)

### Payments
- **Provider:** Stripe
- **Products:** 3 tiers (Casual £4.99, Pro £9.99, Max £19.99)
- **Webhooks:** Subscription lifecycle events

### Image Handling
- **Upload:** Cloudinary
- **Processing:** Client-side resize before upload
- **Storage:** Cloudinary CDN

### External APIs
- **eBay:** Trading API for direct listing (optional)
- **Barcode lookup:** Open Food Facts, UPC Database

---

## 4. Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                │
└─────────────────────────────────────────────────────────────────────────┘

[Upload Photos] → [Cloudinary] → [AI Analysis] → [Edit/Refine] → [Export]
                       ↓              ↓                              ↓
                  CDN URLs      Gemini Vision            ZIP / Copy / Share
                       ↓              ↓                              ↓
                  [Database]    [Generate Listing]          [Marketplace]
                       ↓              ↓
                  images table   listings table


┌─────────────────────────────────────────────────────────────────────────┐
│                          API DATA FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

Client Request
     ↓
[Clerk Middleware] → Validate session token
     ↓
[Rate Limiter] → Check request limits
     ↓
[Express Route Handler]
     ↓
[PostgreSQL Query] ← → [External API (Gemini/eBay/Stripe)]
     ↓
JSON Response → Client


┌─────────────────────────────────────────────────────────────────────────┐
│                        SUBSCRIPTION DATA FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

[Upgrade Click] → [Stripe Checkout] → [Payment] → [Webhook]
                                                       ↓
                                              [Update DB: subscriptions]
                                                       ↓
                                              [Update usage_tracking limits]
                                                       ↓
                                              [Unlock features in UI]
```

### Key Database Relationships
```sql
users (1) ←→ (N) listings
users (1) ←→ (N) images (via listings)
users (1) ←→ (1) subscriptions
users (1) ←→ (N) usage_tracking (monthly periods)
```

---

## 5. UX Flow

### 5.1 Onboarding Flow (New User)
```
Landing Page
    ↓
[Sign Up] (Clerk modal)
    ↓ OAuth or Email
Dashboard (empty state)
    ↓
"Upload your first photos" CTA
    ↓
Photo Upload (drag & drop or click)
    ↓
AI Analysis (3-5 seconds)
    ↓
Generated Listing Preview
    ↓
Edit fields (optional)
    ↓
Export (Download ZIP / Copy / Share)
    ↓
Success! "Create another" CTA
```

### 5.2 Returning User Flow
```
Landing/Dashboard
    ↓
[Sign In] (if needed)
    ↓
Dashboard (shows saved listings)
    ↓
[Create New] or [Edit Existing]
    ↓
... normal flow
```

### 5.3 Upgrade Flow (Free → Paid)
```
Usage limit warning (80%+)
    ↓
Sticky upsell footer appears
    ↓
[Upgrade] button
    ↓
Pricing modal (3 tiers)
    ↓
[Select Plan]
    ↓
Stripe Checkout
    ↓
Payment success
    ↓
Webhook updates DB
    ↓
UI reflects new plan (upsell hidden)
```

### 5.4 Listing Generation Flow
```
Upload 1-10 photos
    ↓
Select target platform (eBay/Vinted/Gumtree)
    ↓
[Analyze] button
    ↓
Loading state (spinner)
    ↓
Gemini Vision analyzes photos:
  - Identify product
  - Detect brand/model
  - Assess condition
  - Research market pricing
    ↓
Generate structured output:
  - Title (optimized for search)
  - Description (platform-appropriate)
  - Category suggestion
  - Condition assessment
  - RRP + Recommended price
  - Keywords/tags
    ↓
Display in editable form
    ↓
User can edit any field
    ↓
Export options:
  - Download ZIP (all files)
  - Copy to clipboard
  - Share (native share sheet)
  - Open in eBay/Vinted
```

---

## 6. Authentication Flow

### 6.1 Sign Up
```
[Sign Up Button]
    ↓
Clerk Modal
    ↓
Options:
  - Email + Password
  - Google OAuth
  - Apple OAuth (if configured)
    ↓
Email verification (if email signup)
    ↓
Create user in DB (via webhook or first request)
    ↓
Session established
    ↓
Redirect to dashboard
```

### 6.2 Sign In
```
[Sign In Button]
    ↓
Clerk Modal
    ↓
Enter credentials
    ↓
Clerk validates
    ↓
Session token issued
    ↓
Client stores session
    ↓
All API requests include: Authorization: Bearer <session_token>
```

### 6.3 Session Validation (Per Request)
```
Incoming Request
    ↓
[clerkMiddleware()]
    ↓
Extract session from cookie/header
    ↓
Validate with Clerk servers
    ↓
Attach userId to request
    ↓
Handler executes with authenticated context
```

### 6.4 Token Refresh
Clerk handles token refresh automatically. Sessions persist across browser restarts via secure cookies.

---

## 7. Subscription Tiers

| Feature | Free | Casual (£4.99) | Pro (£9.99) | Max (£19.99) |
|---------|------|----------------|-------------|--------------|
| Listings/month | 5 | 30 | 100 | Unlimited |
| AI personalities | Standard only | All 5 | All 5 | All 5 |
| Image enhancement | ❌ | ❌ | ✅ | ✅ |
| Bulk processing | ❌ | ❌ | ❌ | ✅ |
| Priority AI | ❌ | ❌ | ✅ | ✅ |
| eBay direct post | ❌ | ❌ | ✅ | ✅ |

---

## 8. API Endpoints (Key Routes)

### Authentication
- `POST /api/auth/login` — Email/password login (deprecated)
- `GET /api/auth/google` — Google OAuth initiation

### Listings
- `POST /api/analyze` — Analyze photos, generate listing
- `GET /api/listings` — Get user's listings
- `POST /api/listings` — Save a listing
- `PUT /api/listings/:id` — Update a listing
- `DELETE /api/listings/:id` — Delete a listing
- `PATCH /api/listings/:id/sold` — Mark as sold

### Subscription
- `GET /api/subscription/status` — Get plan + usage
- `POST /api/create-checkout-session` — Start Stripe checkout
- `POST /api/webhook/stripe` — Handle Stripe events

### Images
- `POST /api/upload-image` — Upload to Cloudinary
- `GET /api/cloudinary/signature` — Get signed upload params

### Utilities
- `GET /api/health` — Health check
- `POST /api/barcode-lookup` — Product info from barcode
- `GET /api/config/pricing` — Get pricing tiers config

---

## 9. Security Measures

### Authentication & Authorization
- Clerk-managed sessions (no custom JWT)
- All API routes require authentication
- User can only access own listings

### Data Protection
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- CORS whitelist (production domain only)
- Helmet.js security headers
- Rate limiting on all sensitive endpoints

### API Security
- Rate limits: Auth (5/15min), Generate (10/min), Upload (20/min)
- Request size limits (10MB max)
- API keys stored in environment variables

---

## 10. Current Limitations & Known Issues

### Must Fix Before Scale
1. ❌ Clerk signups currently disabled (needs enabling)
2. ⚠️ No OG image for social sharing
3. ⚠️ Error handling could be more user-friendly

### Technical Debt
- Single-file frontend (5600 lines) — consider splitting
- Base64 image storage — should migrate fully to Cloudinary URLs
- No automated testing — needs E2E tests

### Feature Gaps
- No batch/bulk upload flow
- No listing templates
- No draft auto-save
- No marketplace analytics integration

---

## 11. Success Criteria for Launch

### MVP (Current)
- [x] Photo upload works
- [x] AI generates listings
- [x] Export to ZIP/clipboard
- [ ] Stripe payments work end-to-end
- [ ] Sign up enabled
- [ ] 10 beta users successfully create listings

### Growth Phase
- [ ] 100 paying users
- [ ] < 5% churn rate
- [ ] NPS > 30
- [ ] Featured in 2+ reseller communities

---

*Document maintained by Terry (PM). Last updated: 2026-02-10*
