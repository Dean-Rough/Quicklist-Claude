# Smart Pricing Engine & Automated eBay Posting - Implementation Plan

## Overview
Integrate eBay Finding API for pricing intelligence and eBay Trading API for automated posting into the listing generation flow. This will provide real-time pricing data and enable one-click posting to eBay.

---

## Phase 1: eBay API Setup & Dependencies

### 1.1 Install Required Packages
**File:** `package.json`

Add dependencies:
```json
{
  "dependencies": {
    "ebay-api": "^1.2.0",
    "xml2js": "^0.6.2",
    "axios": "^1.6.0"
  }
}
```

### 1.2 Environment Variables
**File:** `.env` (add to existing)

```env
# eBay API Credentials
EBAY_APP_ID=your_ebay_app_id
EBAY_DEV_ID=your_ebay_dev_id
EBAY_CERT_ID=your_ebay_cert_id
EBAY_AUTH_TOKEN=your_ebay_user_token
EBAY_SANDBOX=true
EBAY_SITE_ID=3  # UK site ID
```

### 1.3 Database Schema Updates
**File:** `schema.sql`

Add new columns to `listings` table:
```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_item_id VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pricing_data JSONB;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS posted_to_ebay BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_posted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);
```

---

## Phase 2: Smart Pricing Engine Integration

### 2.1 Create eBay Pricing Service
**File:** `server.js`

Add new function after line 311 (before `/api/generate`):

```javascript
// eBay Pricing Intelligence Service
async function getEbayPricingIntelligence(brand, title, category) {
    try {
        const appId = process.env.EBAY_APP_ID;
        const siteId = process.env.EBAY_SITE_ID || '3'; // UK
        
        if (!appId) {
            console.log('⚠️ eBay App ID not configured, skipping pricing intelligence');
            return null;
        }

        // Build search query
        const searchQuery = `${brand} ${title}`.trim();
        
        // eBay Finding API endpoint
        const findingApiUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
        
        // Search completed listings (sold items)
        const completedParams = new URLSearchParams({
            'OPERATION-NAME': 'findCompletedItems',
            'SERVICE-VERSION': '1.0.0',
            'SECURITY-APPNAME': appId,
            'RESPONSE-DATA-FORMAT': 'JSON',
            'REST-PAYLOAD': '',
            'keywords': searchQuery,
            'itemFilter(0).name': 'SoldItemsOnly',
            'itemFilter(0).value': 'true',
            'itemFilter(1).name': 'ListingType',
            'itemFilter(1).value': 'FixedPrice',
            'sortOrder': 'EndTimeSoonest',
            'paginationInput.entriesPerPage': '50'
        });

        const completedResponse = await fetch(`${findingApiUrl}?${completedParams}`);
        const completedData = await completedResponse.json();
        
        // Search active listings (competitors)
        const activeParams = new URLSearchParams({
            'OPERATION-NAME': 'findItemsAdvanced',
            'SERVICE-VERSION': '1.0.0',
            'SECURITY-APPNAME': appId,
            'RESPONSE-DATA-FORMAT': 'JSON',
            'REST-PAYLOAD': '',
            'keywords': searchQuery,
            'itemFilter(0).name': 'ListingType',
            'itemFilter(0).value': 'FixedPrice',
            'sortOrder': 'PricePlusShippingLowest',
            'paginationInput.entriesPerPage': '20'
        });

        const activeResponse = await fetch(`${findingApiUrl}?${activeParams}`);
        const activeData = await activeResponse.json();

        // Process sold listings
        const soldItems = completedData.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
        const soldPrices = soldItems
            .map(item => parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0))
            .filter(price => price > 0);

        // Process active listings
        const activeItems = activeData.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
        const activePrices = activeItems
            .map(item => parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0))
            .filter(price => price > 0);

        if (soldPrices.length === 0) {
            return {
                avgSoldPrice: null,
                priceRange: null,
                soldCount: 0,
                competitorCount: activePrices.length,
                recommendations: ['No sold listings found. Use AI-generated price.']
            };
        }

        // Calculate statistics
        const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
        const minSoldPrice = Math.min(...soldPrices);
        const maxSoldPrice = Math.max(...soldPrices);
        const sortedPrices = soldPrices.sort((a, b) => a - b);
        const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
        const top25Price = sortedPrices[Math.floor(sortedPrices.length * 0.75)];

        // Generate recommendations
        const recommendations = [];
        recommendations.push(`Price at £${Math.round(medianPrice)} for quick sale (median sold price)`);
        if (top25Price > medianPrice) {
            recommendations.push(`List at £${Math.round(top25Price)} for max profit (top 25% of sales)`);
        }
        if (activePrices.length > 0) {
            const avgActivePrice = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;
            if (avgActivePrice > avgSoldPrice) {
                recommendations.push(`Competitors average £${Math.round(avgActivePrice)} - consider pricing competitively`);
            }
        }

        return {
            avgSoldPrice: `£${Math.round(avgSoldPrice)}`,
            priceRange: {
                min: `£${Math.round(minSoldPrice)}`,
                max: `£${Math.round(maxSoldPrice)}`
            },
            soldCount: soldPrices.length,
            competitorCount: activePrices.length,
            recentSales: soldPrices.slice(0, 10).map(p => `£${Math.round(p)}`),
            recommendations
        };
    } catch (error) {
        console.error('❌ eBay pricing intelligence error:', error);
        return null;
    }
}
```

### 2.2 Integrate into Generation Flow
**File:** `server.js`

Modify `/api/generate` endpoint (around line 570, after parsing listing):

```javascript
// After parsing listing from Gemini response
let pricingIntelligence = null;

// Get eBay pricing intelligence if platform is eBay
if (platform === 'ebay') {
    pricingIntelligence = await getEbayPricingIntelligence(
        listing.brand,
        listing.title,
        listing.category
    );
    
    // Enhance price with eBay data if available
    if (pricingIntelligence && pricingIntelligence.avgSoldPrice) {
        // Store pricing data
        listing.pricingData = pricingIntelligence;
        
        // Optionally adjust price based on intelligence
        // (Keep AI price as default, but provide intelligence)
    }
}

// Return enhanced response
res.json({
    listing: {
        ...listing,
        pricingData: pricingIntelligence
    },
    pricingIntelligence
});
```

---

## Phase 3: Frontend Pricing Intelligence Display

### 3.1 Add Pricing Intelligence UI
**File:** `index.html`

Add new section after price field (around line 1347):

```html
<!-- Pricing Intelligence Section (only show for eBay) -->
<div class="field-group" id="pricingIntelligenceSection" style="display: none;">
    <label class="form-label">Pricing Intelligence</label>
    <div class="pricing-intelligence-card" id="pricingIntelligenceCard">
        <!-- Will be populated by JavaScript -->
    </div>
</div>
```

Add CSS styles (in `<style>` section, around line 800):

```css
.pricing-intelligence-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 0.5rem;
}

.pricing-stat {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.pricing-stat:last-child {
    border-bottom: none;
}

.pricing-stat-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.pricing-stat-value {
    color: var(--accent-indigo);
    font-weight: 600;
}

.pricing-recommendation {
    background: var(--accent-indigo-light);
    border-left: 3px solid var(--accent-indigo);
    padding: 0.75rem;
    margin-top: 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
}

.pricing-recommendation:hover {
    background: var(--bg-hover);
}

.pricing-recommendation-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.pricing-recommendation-desc {
    color: var(--text-secondary);
    font-size: 0.875rem;
}
```

### 3.2 Update displayListing Function
**File:** `index.html`

Modify `displayListing()` function (around line 1810):

```javascript
// Display listing
displayListing(listing, pricingIntelligence = null) {
    // ... existing code ...
    
    // Show pricing intelligence if available
    const pricingSection = document.getElementById('pricingIntelligenceSection');
    const pricingCard = document.getElementById('pricingIntelligenceCard');
    
    if (pricingIntelligence && document.getElementById('platformSelect').value === 'ebay') {
        pricingSection.style.display = 'block';
        
        let html = `
            <div class="pricing-stat">
                <span class="pricing-stat-label">Average Sold Price</span>
                <span class="pricing-stat-value">${pricingIntelligence.avgSoldPrice || 'N/A'}</span>
            </div>
            <div class="pricing-stat">
                <span class="pricing-stat-label">Price Range</span>
                <span class="pricing-stat-value">${pricingIntelligence.priceRange?.min || 'N/A'} - ${pricingIntelligence.priceRange?.max || 'N/A'}</span>
            </div>
            <div class="pricing-stat">
                <span class="pricing-stat-label">Sold Listings Found</span>
                <span class="pricing-stat-value">${pricingIntelligence.soldCount || 0}</span>
            </div>
            <div class="pricing-stat">
                <span class="pricing-stat-label">Active Competitors</span>
                <span class="pricing-stat-value">${pricingIntelligence.competitorCount || 0}</span>
            </div>
        `;
        
        if (pricingIntelligence.recommendations && pricingIntelligence.recommendations.length > 0) {
            html += '<div style="margin-top: 1rem;"><strong>Recommendations:</strong></div>';
            pricingIntelligence.recommendations.forEach((rec, index) => {
                const priceMatch = rec.match(/£(\d+)/);
                const price = priceMatch ? priceMatch[1] : null;
                
                html += `
                    <div class="pricing-recommendation" onclick="app.useRecommendedPrice('${price}')">
                        <div class="pricing-recommendation-title">${rec}</div>
                        ${price ? '<div class="pricing-recommendation-desc">Click to use this price</div>' : ''}
                    </div>
                `;
            });
        }
        
        pricingCard.innerHTML = html;
    } else {
        pricingSection.style.display = 'none';
    }
}
```

Add helper function:

```javascript
// Use recommended price
useRecommendedPrice(price) {
    if (price) {
        document.getElementById('outputPrice').value = `£${price}`;
        this.showToast('Price updated!');
    }
}
```

Update `generateListing()` to pass pricing intelligence:

```javascript
// In generateListing(), after calling callGeminiAPI()
const response = await this.callGeminiAPI(base64Images, platform, hint);
const listing = response.listing;
const pricingIntelligence = response.pricingIntelligence;

// Display with pricing intelligence
this.displayListing(listing, pricingIntelligence);
```

---

## Phase 4: Automated eBay Posting

### 4.1 Create Image Hosting Service
**File:** `server.js`

Add image upload function (using Imgur API as example):

```javascript
// Image hosting service (using Imgur API)
async function uploadImageToHosting(imageBase64) {
    try {
        // Option 1: Use Imgur API (free tier available)
        const imgurClientId = process.env.IMGUR_CLIENT_ID;
        if (imgurClientId) {
            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: {
                    'Authorization': `Client-ID ${imgurClientId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: imageBase64.split(',')[1],
                    type: 'base64'
                })
            });
            
            const data = await response.json();
            if (data.success) {
                return data.data.link;
            }
        }
        
        // Option 2: Serve from our own server (fallback)
        // Store image and return URL
        // This requires implementing image storage endpoint
        
        throw new Error('Image hosting not configured');
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}
```

### 4.2 Create eBay Posting Service
**File:** `server.js`

Add eBay posting function:

```javascript
// eBay Posting Service
async function postToEbay(listingData, images, userToken) {
    try {
        const appId = process.env.EBAY_APP_ID;
        const devId = process.env.EBAY_DEV_ID;
        const certId = process.env.EBAY_CERT_ID;
        const siteId = process.env.EBAY_SITE_ID || '3';
        const sandbox = process.env.EBAY_SANDBOX === 'true';
        
        if (!appId || !userToken) {
            throw new Error('eBay API credentials not configured');
        }

        // Upload images to hosting
        const imageUrls = [];
        for (const image of images) {
            const url = await uploadImageToHosting(image);
            imageUrls.push(url);
        }

        // Map condition to eBay condition ID
        const conditionMap = {
            'New with Tags': '1000',
            'Like New': '2750',
            'Excellent': '3000',
            'Very Good': '4000',
            'Good': '5000',
            'Fair': '6000',
            'Poor': '7000'
        };
        
        const conditionId = conditionMap[listingData.condition] || '5000';

        // Map category (simplified - would need full category mapping)
        // For now, use a generic category or require user to select
        const categoryId = '11450'; // Generic category - should be mapped properly

        // Build eBay XML request
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
        <eBayAuthToken>${userToken}</eBayAuthToken>
    </RequesterCredentials>
    <ErrorLanguage>en_US</ErrorLanguage>
    <WarningLevel>High</WarningLevel>
    <Item>
        <Title>${listingData.title}</Title>
        <Description><![CDATA[${listingData.description}]]></Description>
        <PrimaryCategory>
            <CategoryID>${categoryId}</CategoryID>
        </PrimaryCategory>
        <StartPrice>${listingData.price.replace('£', '')}</StartPrice>
        <ConditionID>${conditionId}</ConditionID>
        <ListingType>FixedPriceItem</ListingType>
        <ListingDuration>GTC</ListingDuration>
        <Quantity>1</Quantity>
        <Country>GB</Country>
        <Currency>GBP</Currency>
        <PictureDetails>
            ${imageUrls.map(url => `<PictureURL>${url}</PictureURL>`).join('\n            ')}
        </PictureDetails>
        <ReturnPolicy>
            <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
            <RefundOption>MoneyBack</RefundOption>
            <ReturnsWithinOption>Days_30</ReturnsWithinOption>
            <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
        </ReturnPolicy>
        <ShippingDetails>
            <ShippingType>Flat</ShippingType>
            <ShippingServiceOptions>
                <ShippingServicePriority>1</ShippingServicePriority>
                <ShippingService>UK_RoyalMailStandard</ShippingService>
                <ShippingServiceCost>3.50</ShippingServiceCost>
                <ShippingServiceAdditionalCost>0</ShippingServiceAdditionalCost>
            </ShippingServiceOptions>
        </ShippingDetails>
        <DispatchTimeMax>3</DispatchTimeMax>
    </Item>
</AddItemRequest>`;

        // eBay Trading API endpoint
        const endpoint = sandbox 
            ? 'https://api.sandbox.ebay.com/ws/api.dll'
            : 'https://api.ebay.com/ws/api.dll';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'X-EBAY-API-CALL-NAME': 'AddItem',
                'X-EBAY-API-APP-NAME': appId,
                'X-EBAY-API-DEV-NAME': devId,
                'X-EBAY-API-CERT-NAME': certId,
                'X-EBAY-API-SITEID': siteId,
                'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                'Content-Type': 'text/xml'
            },
            body: xml
        });

        const responseText = await response.text();
        
        // Parse XML response (simplified - should use proper XML parser)
        const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/);
        if (itemIdMatch) {
            return {
                success: true,
                itemId: itemIdMatch[1],
                url: `https://www.ebay.co.uk/itm/${itemIdMatch[1]}`
            };
        } else {
            const errorMatch = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/);
            throw new Error(errorMatch ? errorMatch[1] : 'eBay posting failed');
        }
    } catch (error) {
        console.error('❌ eBay posting error:', error);
        throw error;
    }
}
```

### 4.3 Add Posting Endpoint
**File:** `server.js`

Add new endpoint after `/api/generate`:

```javascript
// Post listing to eBay
app.post('/api/listings/:id/post-to-ebay', authenticateToken, async (req, res) => {
    try {
        const listingId = req.params.id;
        const userId = req.user.id;

        // Get listing from database
        const listingResult = await pool.query(
            'SELECT l.*, (SELECT json_agg(i.image_data ORDER BY i.image_order) FROM images i WHERE i.listing_id = l.id) as images FROM listings l WHERE l.id = $1 AND l.user_id = $2',
            [listingId, userId]
        );

        if (listingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        const listing = listingResult.rows[0];
        
        // Get user's eBay token (would be stored in users table or separate table)
        // For now, assume it's in environment or user needs to provide
        const ebayToken = process.env.EBAY_AUTH_TOKEN; // Should come from user's stored credentials

        // Post to eBay
        const result = await postToEbay(
            listing,
            listing.images || [],
            ebayToken
        );

        // Update listing with eBay item ID
        await pool.query(
            'UPDATE listings SET ebay_item_id = $1, posted_to_ebay = true, ebay_posted_at = CURRENT_TIMESTAMP WHERE id = $2',
            [result.itemId, listingId]
        );

        res.json({
            success: true,
            itemId: result.itemId,
            url: result.url
        });
    } catch (error) {
        console.error('Post to eBay error:', error);
        res.status(500).json({
            error: 'Failed to post to eBay',
            details: error.message
        });
    }
});
```

---

## Phase 5: Frontend Posting UI

### 5.1 Add Post to eBay Button
**File:** `index.html`

Add button in output area (around line 1370, after Download ZIP button):

```html
<!-- Post to eBay Button (only show for eBay platform) -->
<button class="btn btn-primary mt-3" id="postToEbayBtn" style="width: 100%; display: none;" onclick="app.postToEbay()">
    Post to eBay
</button>
```

### 5.2 Update JavaScript
**File:** `index.html`

Add function to `app` object (around line 2059):

```javascript
// Post listing to eBay
async postToEbay() {
    if (!this.state.currentListing || !this.state.currentListing.id) {
        this.showToast('Please save the listing first');
        return;
    }

    const btn = document.getElementById('postToEbayBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Posting to eBay...';

    try {
        const response = await fetch(`${this.apiUrl}/listings/${this.state.currentListing.id}/post-to-ebay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.state.token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Posting failed');
        }

        const data = await response.json();
        this.showToast('Successfully posted to eBay!');
        
        // Open eBay listing in new tab
        window.open(data.url, '_blank');
        
        // Update button
        btn.innerHTML = '✓ Posted to eBay';
        btn.style.background = 'var(--success)';
        
    } catch (error) {
        console.error('Post to eBay error:', error);
        alert(`Failed to post to eBay: ${error.message}`);
        btn.disabled = false;
        btn.innerHTML = 'Post to eBay';
    }
}
```

Update `displayListing()` to show button:

```javascript
// Show Post to eBay button if platform is eBay
const postBtn = document.getElementById('postToEbayBtn');
if (document.getElementById('platformSelect').value === 'ebay') {
    postBtn.style.display = 'block';
} else {
    postBtn.style.display = 'none';
}
```

---

## Phase 6: Implementation Checklist

- [ ] Install npm packages (`ebay-api`, `xml2js`, `axios`)
- [ ] Add eBay API credentials to `.env`
- [ ] Update database schema (run migration)
- [ ] Implement `getEbayPricingIntelligence()` function
- [ ] Integrate pricing into `/api/generate` endpoint
- [ ] Add pricing intelligence UI to frontend
- [ ] Implement image hosting service
- [ ] Implement `postToEbay()` function
- [ ] Add `/api/listings/:id/post-to-ebay` endpoint
- [ ] Add Post to eBay button to frontend
- [ ] Test with eBay sandbox
- [ ] Test pricing intelligence with real products
- [ ] Test posting flow end-to-end

---

## Notes & Considerations

1. **eBay OAuth**: Full implementation requires OAuth flow for user authentication. For MVP, can use single token in environment.

2. **Category Mapping**: eBay uses numeric category IDs. Need to implement category mapping service or require user selection.

3. **Image Hosting**: Imgur API requires free account. Alternative: serve images from Express server.

4. **Rate Limits**: eBay API has rate limits. Implement request queuing/throttling.

5. **Error Handling**: Add comprehensive error handling for all eBay API calls.

6. **Testing**: Start with eBay sandbox environment before production.

7. **Category Selection**: May need to add eBay category picker in UI for accurate posting.

---

## Next Steps After Implementation

1. Add eBay OAuth flow for user authentication
2. Implement category mapping service
3. Add support for other platforms (Vinted, Gumtree) with manual templates
4. Add pricing history tracking
5. Add competitor monitoring

