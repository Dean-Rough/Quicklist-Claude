#!/bin/bash
set -e

BASE_URL="http://localhost:4577"
echo "=== QuickList AI E2E Test Suite ==="
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/api/health" | jq . || echo "FAILED"
echo ""

# Test 2: Signup
echo "2. Testing signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e_test_'$(date +%s)'@example.com","password":"testpass123"}')
echo $SIGNUP_RESPONSE | jq .
TOKEN=$(echo $SIGNUP_RESPONSE | jq -r '.token')
USER_ID=$(echo $SIGNUP_RESPONSE | jq -r '.user.id')
echo "Token: ${TOKEN:0:50}..."
echo ""

# Test 3: Signin
echo "3. Testing signin..."
curl -s -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"testpassword123\"}" | jq .
echo ""

# Test 4: Verify Token
echo "4. Testing token verification..."
curl -s -X GET "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 5: Get Listings (empty)
echo "5. Testing get listings (should be empty)..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 6: Create a test listing
echo "6. Testing create listing..."
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
    "images": []
  }')
echo $LISTING_RESPONSE | jq .
LISTING_ID=$(echo $LISTING_RESPONSE | jq -r '.listing.id')
echo "Created listing ID: $LISTING_ID"
echo ""

# Test 7: Get specific listing
echo "7. Testing get specific listing..."
curl -s -X GET "$BASE_URL/api/listings/$LISTING_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 8: Update listing
echo "8. Testing update listing..."
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

# Test 9: Get all listings (should have 1)
echo "9. Testing get all listings (should have 1)..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 10: Delete listing
echo "10. Testing delete listing..."
curl -s -X DELETE "$BASE_URL/api/listings/$LISTING_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 11: Verify listing deleted
echo "11. Verifying listing was deleted..."
curl -s -X GET "$BASE_URL/api/listings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "=== E2E Test Suite Complete ==="
