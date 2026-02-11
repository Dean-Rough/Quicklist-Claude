# QuickList AI - Quick Reference Guide

## At a Glance

**What is it?** AI-powered listing generator for resale marketplaces (Vinted, eBay, Gumtree)

**How it works:**

1. User uploads product images
2. AI analyzes images using Google Gemini Vision API
3. Multi-phase processing: code parsing → visual recognition → pricing research → stock image search
4. Returns complete listing (title, description, price, keywords, sources)
5. User edits/saves/downloads as ZIP

**Key Files:**

- `/index.html` - 4229 line all-in-one frontend
- `/server.js` - 1610 line Express backend
- `/schema.sql` - Database schema
- `/package.json` - Node dependencies

---

## Current Features Summary

| Feature                   | Status         | Details                                               |
| ------------------------- | -------------- | ----------------------------------------------------- |
| AI Listing Generation     | ✅ Complete    | 4-phase pipeline (OCR, Vision, Pricing, Stock Images) |
| Image Upload              | ✅ Complete    | Multi-image, device camera support                    |
| Marketplace Support       | ✅ 3 platforms | Vinted, eBay, Gumtree                                 |
| eBay Pricing Intelligence | ✅ Complete    | Finds sold/active listings, price recommendations     |
| Product Code Parsing      | ✅ Complete    | OCR extraction of SKUs, model codes, size             |
| Visual Recognition        | ✅ Complete    | Google Vision to identify product lines               |
| Stock Image Finder        | ✅ Complete    | Phase 4, finds official product images                |
| User Accounts             | ✅ Complete    | Sign up, JWT auth, cross-device access                |
| Save/Load Listings        | ✅ Complete    | Database persistence                                  |
| ZIP Download              | ✅ Complete    | Export listing + images                               |
| eBay Direct Posting       | ⚠️ Partial     | Code ready, may need auth flow                        |
| Vinted Integration        | ⚠️ Basic       | Autofill/redirect only                                |
| Batch Processing          | ❌ Incomplete  | UI present, not implemented                           |
| Hero Image Generation     | ❌ UI only     | Toggle in UI, not implemented                         |
| Image Enhancement         | ❌ UI only     | Toggle in UI, not implemented                         |

---

## API Endpoints (17 total)

### Authentication (3)

- `POST /api/auth/signup` - Register
- `POST /api/auth/signin` - Login
- `GET /api/auth/verify` - Verify token

### Listings (5)

- `GET /api/listings` - All user's listings
- `GET /api/listings/:id` - Specific listing
- `POST /api/listings` - Save new listing
- `PUT /api/listings/:id` - Update listing
- `DELETE /api/listings/:id` - Delete listing

### Generation (1)

- `POST /api/generate` - Generate listing from images

### eBay (1)

- `POST /api/listings/:id/post-to-ebay` - Post to eBay

### Utilities (2)

- `GET /api/health` - Health check
- `GET /api/init-db` - Initialize database

---

## Tech Stack

**Frontend:**

- Vanilla JavaScript (no framework)
- Single HTML file (4229 lines)
- localStorage for persistence
- JSZip for downloads

**Backend:**

- Node.js + Express
- PostgreSQL (Neon)
- bcryptjs (password hashing)
- JWT (authentication)

**External APIs:**

- Google Gemini 2.0 Flash (vision)
- eBay Finding API (pricing)
- eBay Trading API (posting)
- Imgur API (optional image hosting)

---

## Competitive Strengths

1. **Advanced OCR** - Reads product codes from labels (CK0697-010, SP200710EAG formats)
2. **Multi-phase AI** - 4 parallel/sequential phases for better accuracy
3. **Real-time pricing** - Google Search grounding finds current market prices
4. **Stock image finder** - Locates official product images from brand websites
5. **Free tier** - No subscription required for basic use
6. **Single interface** - Works with 3 marketplaces from one UI

---

## Competitive Gaps

**Major Gaps:**

- No direct Vinted/Gumtree posting (only autofill)
- No other marketplace support (Depop, Mercari, Poshmark)
- Incomplete batch processing
- No analytics/performance tracking
- No hero image or image enhancement
- No mobile app

**Minor Gaps:**

- No subscription system (free tier logic UI only)
- No API for custom integrations
- No team collaboration
- Limited logging/monitoring
- No rate limiting

---

## Database Overview

**3 Tables:**

1. **users** - Email, password_hash, timestamps
2. **listings** - Title, brand, category, description, price, keywords (array), sources (JSON), eBay tracking
3. **images** - Base64 image data, order, blur flag

**Data Relationships:**

```
User (1) → (N) Listings → (N) Images
Cascade deletes: User → Listings → Images
```

---

## Marketplace Features by Platform

### eBay (Most Advanced)

- Pricing intelligence from sold listings
- Post directly to eBay account
- Category mapping (11450 generic fallback)
- 7 condition levels
- Shipping configuration (Royal Mail, £3.50)
- Return policy setup
- GBP currency, GB shipping
- XML-based API integration

### Vinted (Basic)

- List generation only
- Autofill button opens Vinted with URL params
- Manual data entry on Vinted
- Vinted-specific categories

### Gumtree (Basic)

- List generation only
- No direct integration
- Manual posting on Gumtree

---

## AI Processing Pipeline

**Phase 1: Code Parsing (Parallel)**

- Extracts ALL text from product tags
- Identifies model codes (CK0697-010), style codes (SP200710EAG), SKU numbers
- Reads size markings (UK 10, M, L, 50ml, etc.)
- Uses Gemini with low temperature (0.1) for accuracy

**Phase 3: Vision Recognition (Parallel)**

- Identifies product line from visual features
- Recognizes logos and brand marks
- Extracts design elements
- Uses Gemini with low temperature (0.2)

**Phase 2: Main Generation (Sequential)**

- Uses extracted codes and visual recognition
- Generates SEO-optimized title (80 chars max)
- Writes sales-focused description (1000 chars max)
- Extracts 5-10 keywords including codes
- Identifies brand and category
- Assesses condition from all angles
- Provides RRP (retail price) research
- Suggests resale price based on market data

**Phase 4: Stock Image Finder (Sequential)**

- Searches for official product images
- Checks brand websites first
- Checks authorized retailers
- Returns confidence level

**Bonus: eBay Pricing Intelligence**

- Finds completed/sold listings
- Calculates average, median, min/max prices
- Analyzes active competitors
- Generates 3 pricing recommendations

---

## Environment Variables Required

```env
DATABASE_URL=postgresql://...  # Neon or local PostgreSQL
GEMINI_API_KEY=...            # Google AI Studio
JWT_SECRET=...                 # Secure random string
PORT=4577                      # Server port
```

**Optional (eBay features):**

```env
EBAY_APP_ID=...
EBAY_DEV_ID=...
EBAY_CERT_ID=...
EBAY_SITE_ID=3                # 3 = UK
EBAY_SANDBOX=false
EBAY_AUTH_TOKEN=...
IMGUR_CLIENT_ID=...
```

---

## File Size Notes

- **server.js**: 1610 lines
- **index.html**: 4229 lines
- **schema.sql**: 66 lines
- **Total JS/Backend**: ~1610 lines
- **Total Frontend**: ~4229 lines
- **Analysis document**: 31KB (this document)

---

## Quick Start

1. `npm install` - Install dependencies
2. Copy `.env.example` to `.env` and add credentials
3. `npm run dev` - Start development server
4. Visit `http://localhost:4577`
5. Visit `/api/init-db` to initialize database

---

## Known Limitations

1. **Single marketplace per listing** - Must generate separately for Vinted/eBay
2. **Base64 image storage** - Images stored as strings in DB (can be large)
3. **No batch processing** - Generate one listing at a time
4. **Manual marketplace posting** - Only eBay has direct API integration
5. **UK-focused** - Prices in GBP, categories optimized for UK
6. **No real-time inventory sync** - Must manage inventory manually after posting
7. **7-day token expiry** - Users must re-login weekly
8. **Destructive init** - `/api/init-db` drops all tables

---

## Deployment Notes

**Production Checklist:**

- [ ] Generate new JWT_SECRET (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- [ ] Restrict `/api/init-db` endpoint
- [ ] Enable CORS restrictions
- [ ] Add rate limiting
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Add request logging
- [ ] Configure database backups
- [ ] Move secrets to secure vault

---

## For Competitive Analysis

**Key Differentiators:**

1. Multi-phase AI for better accuracy
2. Real-time market pricing
3. Free tier with no credit card
4. OCR code extraction from labels
5. Stock image integration

**Key Vulnerabilities:**

1. Limited marketplace coverage
2. No batch processing
3. No analytics
4. Incomplete Vinted/Gumtree integration
5. Missing advanced image features

**Most Likely Next Features:**

1. Direct Vinted API posting
2. Batch processing
3. Hero image generation
4. Image enhancement
5. Analytics dashboard

---

## Contact/Support

**Project Location:** `/Users/deannewton/Projects/QLC/Quicklist-Claude`
**Analysis Date:** November 10, 2025
**Version Analyzed:** v1.0.0

---
