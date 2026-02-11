# eBay Integration Setup Guide

## Overview

QuickList AI now includes:

1. **Smart Pricing Engine** - Real-time pricing intelligence from eBay sold listings
2. **Automated eBay Posting** - One-click posting to eBay marketplace

## What Was Implemented

### Backend (`server.js`)

- ✅ `getEbayPricingIntelligence()` - Fetches pricing data from eBay Finding API
- ✅ `postToEbay()` - Posts listings to eBay using Trading API
- ✅ `uploadImageToHosting()` - Image hosting service (Imgur or fallback)
- ✅ `/api/generate` - Enhanced to include pricing intelligence for eBay
- ✅ `/api/listings/:id/post-to-ebay` - New endpoint for posting to eBay

### Frontend (`index.html`)

- ✅ Pricing Intelligence UI - Displays average sold price, price range, recommendations
- ✅ Post to eBay button - One-click posting functionality
- ✅ Use Recommended Price - Click recommendations to auto-fill price

### Database (`schema.sql`)

- ✅ Added `ebay_item_id` column
- ✅ Added `pricing_data` JSONB column
- ✅ Added `posted_to_ebay` boolean column
- ✅ Added `ebay_posted_at` timestamp column

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install:

- `xml2js` - For parsing eBay XML responses
- `axios` - For HTTP requests to eBay APIs

### 2. Get eBay API Credentials

1. **Create eBay Developer Account**
   - Go to https://developer.ebay.com/
   - Sign in with your eBay account
   - Create a new application

2. **Get Your Credentials**
   - App ID (Client ID)
   - Dev ID
   - Cert ID
   - User Token (OAuth token - see below)

3. **Get User Token (OAuth)**
   - For production: Implement OAuth flow
   - For testing: Use eBay Token Generator tool
   - Or use sandbox tokens for development

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# eBay API Credentials
EBAY_APP_ID=your_ebay_app_id_here
EBAY_DEV_ID=your_ebay_dev_id_here
EBAY_CERT_ID=your_ebay_cert_id_here
EBAY_AUTH_TOKEN=your_ebay_user_token_here
EBAY_SANDBOX=true  # Set to false for production
EBAY_SITE_ID=3  # 3 = UK, 0 = US, etc.

# Optional: Imgur for image hosting
IMGUR_CLIENT_ID=your_imgur_client_id_here
```

### 4. Update Database Schema

Run the database migration:

```bash
# Start your server
npm start

# Visit in browser:
http://localhost:3000/api/init-db
```

Or manually run the SQL from `schema.sql` (the new columns are already added).

### 5. Test the Integration

1. **Test Pricing Intelligence:**
   - Upload images of a product
   - Select "eBay" as platform
   - Generate listing
   - Check for pricing intelligence card

2. **Test eBay Posting:**
   - Generate a listing for eBay
   - Save the listing
   - Click "Post to eBay" button
   - Verify listing appears on eBay

## How It Works

### Pricing Intelligence Flow

1. User generates listing with eBay platform selected
2. Backend calls Gemini API to generate listing
3. Backend calls eBay Finding API to search sold listings
4. Calculates statistics (average, median, price range)
5. Generates recommendations
6. Returns pricing intelligence to frontend
7. Frontend displays pricing card with recommendations

### eBay Posting Flow

1. User saves listing (required before posting)
2. User clicks "Post to eBay" button
3. Backend uploads images to hosting (Imgur or fallback)
4. Backend maps QuickList fields to eBay format
5. Backend calls eBay Trading API `AddItem`
6. eBay returns Item ID
7. Backend updates listing with eBay Item ID
8. Frontend shows success and opens eBay listing

## Important Notes

### Image Hosting

- **Imgur API**: Requires free account at https://api.imgur.com/oauth2/addclient
- **Fallback**: Currently uses base64 (may not work with eBay - needs proper hosting)
- **Production**: Should implement proper image hosting service

### eBay Category Mapping

- Currently uses generic category ID `11450`
- **TODO**: Implement proper category mapping service
- eBay has thousands of categories - need to map text categories to numeric IDs

### eBay OAuth

- Currently uses single token from environment
- **Production**: Should implement OAuth flow for each user
- Each user needs their own eBay token

### Rate Limits

- eBay API has rate limits
- Finding API: ~5,000 calls/day
- Trading API: Varies by call type
- Implement request queuing/throttling if needed

## Troubleshooting

### Pricing Intelligence Not Showing

- Check `EBAY_APP_ID` is set in `.env`
- Check console for errors
- Verify eBay API credentials are correct
- Check network tab for API responses

### Posting Fails

- Verify `EBAY_AUTH_TOKEN` is set
- Check token is valid (not expired)
- Verify images are uploading correctly
- Check eBay API error messages in console
- Try sandbox mode first (`EBAY_SANDBOX=true`)

### Images Not Uploading

- Check `IMGUR_CLIENT_ID` if using Imgur
- Verify Imgur API is working
- Check image size limits
- Fallback to base64 may not work with eBay

## Next Steps

1. **Implement OAuth Flow** - Allow users to connect their eBay accounts
2. **Category Mapping** - Map text categories to eBay category IDs
3. **Image Hosting** - Implement proper image hosting service
4. **Error Handling** - Add better error messages and retry logic
5. **Rate Limiting** - Implement request queuing/throttling
6. **Testing** - Test with various product types and conditions

## API Documentation

- eBay Finding API: https://developer.ebay.com/DevZone/finding/Concepts/FindingAPIGuide.html
- eBay Trading API: https://developer.ebay.com/DevZone/XML/docs/Reference/eBay/index.html
- eBay OAuth: https://developer.ebay.com/api-docs/static/oauth-application-credentials.html

## Support

For issues or questions:

- Check eBay API documentation
- Review server logs for errors
- Test with eBay sandbox first
- Verify all credentials are correct
