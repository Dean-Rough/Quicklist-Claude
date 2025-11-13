# QuickList AI - API Documentation

**Base URL**: `https://quicklist.ai/api` (production) or `http://localhost:3000/api` (development)

---

## Authentication

QuickList AI now relies exclusively on [Clerk](https://clerk.com/) for identity. The frontend uses Clerk's SDK to sign users in (email, passwordless, or social). Every authenticated API request must include the Clerk session token in the `Authorization` header:

```
Authorization: Bearer <clerk_session_token>
```

### GET `/api/config/auth`
Returns feature flags and the Clerk publishable key so the frontend can bootstrap the SDK.

**Response:**
```json
{
  "clerk": {
    "enabled": true,
    "publishableKey": "pk_live_..."
  },
  "authProvider": "clerk"
}
```

### GET `/api/auth/verify`
Validates the Clerk token, syncs the user into Postgres, and returns the canonical user record.

**Headers:**
```
Authorization: Bearer <clerk_session_token>
```

**Response:**
```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "name": "Sample User",
    "clerkId": "user_abc123"
  }
}
```

> ⚠️ Legacy `/api/auth/signup`, `/api/auth/signin`, and Google OAuth endpoints have been removed. Attempting to call them will return `404`.

---

## Endpoints

### Listings

#### POST `/api/listings`
Create a new listing.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Nike Tech Fleece Jacket",
  "brand": "Nike",
  "category": "Clothing",
  "description": "Excellent condition...",
  "condition": "Excellent",
  "rrp": "£120",
  "price": "£80",
  "keywords": ["nike", "tech fleece", "jacket"],
  "sources": [{"url": "https://...", "title": "..."}],
  "platform": "ebay",
  "images": [
    {
      "data": "data:image/jpeg;base64,...",
      "isBlurry": false
    }
  ]
}
```

**Response:**
```json
{
  "listing": {
    "id": 1,
    "title": "Nike Tech Fleece Jacket",
    ...
  }
}
```

---

#### GET `/api/listings`
Get all user's listings.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "listings": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

#### GET `/api/listings/:id`
Get specific listing.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "listing": {
    "id": 1,
    "title": "...",
    "images": [...]
  }
}
```

---

#### PUT `/api/listings/:id`
Update listing.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** Same as POST `/api/listings` (all fields optional)

**Response:** Updated listing object

---

#### DELETE `/api/listings/:id`
Delete listing.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Listing deleted successfully"
}
```

---

### AI Generation

#### POST `/api/generate`
Generate listing from images.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "images": [
    "data:image/jpeg;base64,..."
  ],
  "platform": "ebay",
  "hint": "Optional user hint about the item"
}
```

**Constraints:**
- Maximum 10 images
- Maximum 5MB per image
- Plan limits enforced (free: 5/month, starter: 50/month, etc.)

**Response:**
```json
{
  "listing": {
    "title": "...",
    "brand": "...",
    "description": "...",
    "price": "£80",
    "rrp": "£120",
    "keywords": [...],
    "sources": [...],
    "confidence": "HIGH",
    "alternatives": []
  },
  "pricingIntelligence": {...},
  "stockImageData": {...},
  "requiresUserSelection": false
}
```

**Rate Limit:** 10 requests per minute

---

### Subscriptions

#### GET `/api/subscription/status`
Get user's subscription status and usage.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {...},
  "subscription": {
    "planType": "free",
    "status": "active",
    "currentPeriodStart": "...",
    "currentPeriodEnd": "..."
  },
  "usage": {
    "listingsCreated": 3,
    "limit": 5,
    "percentage": 60
  }
}
```

---

#### GET `/api/usage`
Get detailed usage tracking.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "listingsCreated": 3,
  "aiGenerations": 2,
  "backgroundRemovals": 0
}
```

---

### Stripe (Payment)

#### POST `/api/stripe/create-checkout-session`
Create Stripe checkout session.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "priceId": "price_xxx",
  "planType": "pro"
}
```

**Response:**
```json
{
  "sessionId": "cs_xxx",
  "url": "https://checkout.stripe.com/..."
}
```

---

#### POST `/api/stripe/create-portal-session`
Create Stripe billing portal session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

#### GET `/api/stripe/publishable-key`
Get Stripe publishable key for frontend.

**Response:**
```json
{
  "publishableKey": "pk_live_..."
}
```

---

#### POST `/api/stripe/webhook`
Stripe webhook endpoint (handles subscription events).

**Headers:**
```
Stripe-Signature: <signature>
```

**Note:** This endpoint uses `express.raw()` middleware for signature verification.

---

### eBay Integration

#### POST `/api/listings/:id/post-to-ebay`
Post listing to eBay.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "ebayCategoryId": "11450"
}
```

**Response:**
```json
{
  "success": true,
  "itemId": "123456789",
  "url": "https://www.ebay.co.uk/itm/123456789"
}
```

---

### Utilities

#### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T...",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "ok",
    "gemini": "configured",
    "stripe": "configured"
  },
  "uptime": 3600,
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

---

#### GET `/api/init-db`
Initialize database schema.

**Security:** Disabled by default. Set `ALLOW_DB_INIT=true` explicitly (preferably only in local development) or the endpoint returns `403`.

**Response:**
```json
{
  "message": "Database initialized successfully",
  "files": ["schema.sql", "schema_updates.sql", "schema_clerk_migration.sql"]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (rate limit exceeded, plan limit exceeded)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable (database down, etc.)

---

## Rate Limits

- **Authentication endpoints**: 5 requests per 15 minutes
- **Generate endpoint**: 10 requests per minute
- **Other endpoints**: No specific limits (protected by authentication)

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995200
```

---

## Request/Response Headers

### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Response Headers
```
X-Request-ID: <uuid>
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## Plan Limits

| Plan | AI Generations/Month | Listings/Month |
|------|---------------------|----------------|
| Free | 5 | Unlimited |
| Starter | 50 | Unlimited |
| Pro | 200 | Unlimited |
| Business | 1000 | Unlimited |

---

## Webhooks

### Stripe Webhook Events

The `/api/stripe/webhook` endpoint handles:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## Examples

### cURL Examples

**Verify Clerk Token:**
```bash
curl -X GET https://quicklist.ai/api/auth/verify \
  -H "Authorization: Bearer <clerk_session_token>"
```

**Generate Listing:**
```bash
curl -X POST https://quicklist.ai/api/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "images": ["data:image/jpeg;base64,..."],
    "platform": "ebay"
  }'
```

**Get Listings:**
```bash
curl https://quicklist.ai/api/listings?page=1&limit=20 \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated**: 2025-01-27
