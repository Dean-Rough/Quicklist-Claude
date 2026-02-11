#!/bin/bash
set -e

BASE_URL="http://localhost:4577"
echo "=== QuickList AI E2E Test Suite ==="
echo "Base URL: $BASE_URL"
echo ""

if [ -z "${CLERK_TEST_TOKEN:-}" ]; then
  echo "Generating Clerk test token via npm run clerk:token..."
  if ! TOKEN=$(npm run -s clerk:token); then
    echo "Failed to generate Clerk test token. Ensure CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY (or CLERK_FRONTEND_API) are set."
    exit 1
  fi
else
  TOKEN="$CLERK_TEST_TOKEN"
fi

echo "Using Clerk test token: ${TOKEN:0:8}..."
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/api/health" | jq . || echo "FAILED"
echo ""

# Test 2: Verify Token
echo "2. Testing token verification..."
curl -s -X GET "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 3: Get Listings (may be empty)
echo "3. Testing get listings..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 4: Create a test listing
echo "4. Testing create listing..."
LISTING_RESPONSE=$(curl -s -X POST "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Product Listing",
    "brand": "Test Brand",
    "category": "Electronics",
    "description": "This is a test listing created by E2E test suite",
    "condition": "Good",
    "rrp": "£100",
    "price": "£50",
    "keywords": ["test", "product", "electronics"],
    "sources": [{"url": "https://example.com", "title": "Example"}],
    "platform": "vinted",
    "images": [{"url": "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", "isBlurry": false}]
  }')
echo $LISTING_RESPONSE | jq .
LISTING_ID=$(echo $LISTING_RESPONSE | jq -r '.listing.id')
echo "Created listing ID: $LISTING_ID"
echo ""

# Test 5: Get specific listing
echo "5. Testing get specific listing..."
curl -s -X GET "$BASE_URL/api/listings/$LISTING_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 6: Update listing
echo "6. Testing update listing..."
curl -s -X PUT "$BASE_URL/api/listings/$LISTING_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Product",
    "brand": "Updated Brand",
    "category": "Electronics",
    "description": "Updated description",
    "condition": "Like New",
    "rrp": "£120",
    "price": "£60",
    "keywords": ["updated", "test"],
    "sources": [],
    "platform": "ebay"
  }' | jq .
echo ""

# Test 7: Get all listings (should have 1)
echo "7. Testing get all listings (should have 1)..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 8: Delete listing
echo "8. Testing delete listing..."
curl -s -X DELETE "$BASE_URL/api/listings/$LISTING_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 9: Verify listing deleted
echo "9. Verifying listing was deleted..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "=== E2E Test Suite Complete ==="
