# Feature Implementation Plan - QuickList AI

**Generated:** 2025-11-11
**Priority Features:** Based on competitive research and user pain points

---

## Feature Overview

This document outlines the implementation plan for 7 high-priority features identified through competitive research:

1. eBay Pricing Intelligence (FREE via eBay API)
2. Enhanced SEO Optimization (Gemini prompt improvements)
3. Image Quality Scoring (Gemini Vision)
4. Batch Photo Upload with Auto-Resize (2400px optimization)
5. AI Damage Detection (Computer vision - unique differentiator)
6. Predictive Pricing Engine (Combined with eBay data)
7. Barcode Scanner (UPC-based instant listings)

---

## Implementation Timeline

### **Week 1: Foundation & Quick Wins**

- [x] Research completed
- [ ] Enhanced SEO prompts (2-3 days)
- [ ] Image quality scoring (2-3 days)
- [ ] Batch upload with auto-resize (3-4 days)

### **Week 2: Market Intelligence**

- [ ] eBay Finding API integration (3-4 days)
- [ ] Predictive pricing engine (3-4 days)

### **Week 3-4: Advanced Features**

- [ ] AI damage detection (5-7 days)
- [ ] Barcode scanner mobile integration (5-7 days)

---

## Feature 1: Batch Photo Upload with Auto-Resize

**Priority:** HIGH (Enables token savings across all AI features)
**Complexity:** Medium
**Timeline:** 3-4 days
**Cost Impact:** Reduces Gemini API costs by ~60-70%

### Problem Statement

Currently, images are uploaded and sent to Gemini at full resolution, consuming excessive tokens and increasing API costs.

### Solution

Implement client-side image resizing before upload:

- Resize to 2400px longest side (Gemini's sweet spot for detail vs cost)
- Maintain aspect ratio
- Queue processing for 10-50 images
- Progressive upload with real-time preview

### Technical Implementation

#### 1. Image Resize Utility Function

```javascript
// Add to app object in index.html
async resizeImage(file, maxDimension = 2400) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            // Set canvas dimensions and draw
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                },
                'image/jpeg',
                0.92 // Quality setting
            );
        };

        img.src = URL.createObjectURL(file);
    });
},
```

#### 2. Update processFiles Method

```javascript
// Modify existing processFiles function
async processFiles(files) {
    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showToast(`${file.name} is not an image file`);
            continue;
        }

        try {
            // Resize image BEFORE processing
            const resizedFile = await this.resizeImage(file, 2400);

            const imageData = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: resizedFile.size, // Use resized size
                originalSize: file.size, // Track original for stats
                isBlurry: await this.detectBlur(resizedFile),
                data: await this.fileToBase64(resizedFile) // Use resized image
            };

            this.state.images.push(imageData);
            this.showToast(`Added ${file.name} (resized to ${Math.round(resizedFile.size / 1024)}KB)`, 'success');
            this.renderImages();
        } catch (error) {
            this.showToast(`Error processing ${file.name}: ${error.message}`);
        }
    }
},
```

#### 3. Batch Processing UI Enhancement

```javascript
// Add batch processing indicator
renderBatchProgress() {
    const container = document.getElementById('batchProgress');
    if (!container) return;

    const processed = this.state.images.length;
    const total = this.state.uploadQueue?.length || 0;

    if (total === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${(processed / total) * 100}%"></div>
        </div>
        <p>Processing ${processed} of ${total} images...</p>
    `;
},
```

### Database Schema Changes

No changes required - works with existing schema.

### API Changes

No backend changes required - optimization is client-side only.

### Testing Checklist

- [ ] Upload single image (verify resize to 2400px)
- [ ] Upload 10 images batch (verify queue processing)
- [ ] Upload 50 images batch (stress test)
- [ ] Upload very large image (5000x5000px+)
- [ ] Upload already small image (verify no upscaling)
- [ ] Verify aspect ratio maintained
- [ ] Check image quality after compression
- [ ] Measure token reduction in Gemini API calls

### Success Metrics

- Image file sizes reduced by 60-80%
- Gemini API costs reduced by 60-70%
- Upload processing time < 2 seconds per image
- No visible quality degradation

---

## Feature 2: Enhanced SEO Optimization

**Priority:** HIGH
**Complexity:** Low
**Timeline:** 2-3 days
**Cost Impact:** $0 (uses existing Gemini API)

### Problem Statement

Current AI-generated listings lack SEO optimization, missing high-value keywords and marketplace-specific formatting.

### Solution

Enhance Gemini prompts to inject platform-specific SEO strategies, keyword research, and structured formatting.

### Technical Implementation

#### 1. SEO-Enhanced Prompt Template

```javascript
// Update generateListing method in server.js
const seoEnhancedPrompt = `
You are an expert at creating ${platform} listings optimized for search visibility and conversions.

Platform: ${platform}
User hint: ${hint || 'None'}

CRITICAL SEO REQUIREMENTS:

1. TITLE (${platform === 'ebay' ? '80' : '140'} characters max):
   - Front-load most important keywords (brand, item type, key feature)
   - Include: Brand + Item Type + Key Features + Size/Color (if visible)
   - Example: "Nike Air Max 90 Men's Trainers UK 9 White Blue Retro Running Shoes"
   - Avoid filler words ("Amazing", "Wow", "Look")

2. DESCRIPTION (SEO-optimized structure):
   - Opening sentence: Summarize item with key search terms
   - Bullet points for scanability:
     * Condition (be honest about flaws)
     * Materials
     * Measurements/Size
     * Special features
     * Brand details
   - Include natural keyword variations (trainers/sneakers/shoes)
   - Mention what it's perfect for (running, casual wear, collectors)

3. KEYWORDS (${platform === 'vinted' ? '5-10' : '15-20'} maximum):
   - Mix of:
     * Exact product terms ("air max 90")
     * Category terms ("trainers", "sneakers")
     * Style/era ("retro", "90s", "vintage")
     * Color/material keywords
     * Use cases ("running shoes", "streetwear")
   - Avoid keyword stuffing
   - Only relevant, high-search-volume terms

4. CATEGORY:
   - Be specific (not just "Shoes" but "Trainers > Men's Shoes > Nike")
   - Match platform taxonomy exactly

5. PRICING RESEARCH:
   - Find 3-5 sold listings of similar items
   - Calculate average sold price
   - Factor in condition difference
   - Provide RRP with source
   - Suggest competitive price (not lowest, but fair)

ANALYZE IMAGE AND GENERATE:
{
  "title": "SEO-optimized title here",
  "brand": "Brand name",
  "category": "Specific category path",
  "description": "Opening paragraph with keywords, then bullet points:\n• Point 1\n• Point 2\n• Point 3",
  "condition": "Accurate condition",
  "rrp": "£XXX",
  "price": "£XXX (competitive but fair)",
  "keywords": ["keyword1", "keyword2", ...],
  "sources": [
    {"url": "...", "title": "Source for pricing"},
    {"url": "...", "title": "RRP verification"}
  ]
}

Be thorough, honest, and optimize for search visibility.
`;
```

#### 2. SEO Score Calculator (Client-side feedback)

```javascript
// Add to app object
calculateSEOScore(listing) {
    let score = 0;
    let feedback = [];

    // Title checks (30 points)
    if (listing.title.includes(listing.brand)) score += 10;
    else feedback.push('Add brand name to title');

    if (listing.title.length >= 40) score += 10;
    else feedback.push('Title too short - add more descriptive keywords');

    const titleWords = listing.title.toLowerCase().split(' ');
    if (titleWords.some(w => ['amazing', 'wow', 'look', 'rare'].includes(w))) {
        feedback.push('Remove filler words from title');
    } else {
        score += 10;
    }

    // Description checks (30 points)
    if (listing.description.length >= 100) score += 10;
    else feedback.push('Add more detail to description (min 100 characters)');

    if (listing.description.includes('•') || listing.description.includes('-')) {
        score += 10; // Bullet points
    } else {
        feedback.push('Use bullet points for better readability');
    }

    const keywordDensity = this.calculateKeywordDensity(listing.description, listing.keywords);
    if (keywordDensity >= 2 && keywordDensity <= 5) {
        score += 10; // Natural keyword usage
    } else if (keywordDensity > 5) {
        feedback.push('Too many keywords - looks like spam');
    } else {
        feedback.push('Add more relevant keywords to description');
    }

    // Keywords check (20 points)
    if (listing.keywords.length >= 5) score += 10;
    else feedback.push('Add more keywords (aim for 5-15)');

    if (listing.keywords.length <= 20) score += 10;
    else feedback.push('Too many keywords - keep it focused');

    // Category check (10 points)
    if (listing.category && listing.category.includes('>')) {
        score += 10; // Specific category
    } else {
        feedback.push('Use more specific category');
    }

    // Pricing check (10 points)
    if (listing.rrp && listing.price) {
        const rrpNum = parseFloat(listing.rrp.replace(/[^\d.]/g, ''));
        const priceNum = parseFloat(listing.price.replace(/[^\d.]/g, ''));
        if (priceNum < rrpNum) score += 10;
    }

    return {
        score: Math.min(score, 100),
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
        feedback: feedback,
        improvements: this.generateSEOImprovements(score, feedback)
    };
},

calculateKeywordDensity(text, keywords) {
    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/).length;
    let keywordCount = 0;

    keywords.forEach(kw => {
        const regex = new RegExp(kw.toLowerCase(), 'gi');
        const matches = textLower.match(regex);
        if (matches) keywordCount += matches.length;
    });

    return (keywordCount / words) * 100;
},
```

#### 3. UI Enhancement - SEO Score Display

```html
<!-- Add to listing results display -->
<div class="seo-score-card">
  <div class="seo-score-header">
    <h4>SEO Score</h4>
    <div class="score-badge grade-${seoScore.grade}">${seoScore.score}/100 (${seoScore.grade})</div>
  </div>
  <div class="seo-feedback">
    ${seoScore.feedback.map(item => `
    <div class="feedback-item">
      <span class="feedback-icon">⚠️</span>
      ${item}
    </div>
    `).join('')}
  </div>
  <button class="btn btn-secondary" onclick="app.optimizeForSEO()">Auto-Optimize SEO</button>
</div>
```

### Testing Checklist

- [ ] Generate listing and check title keyword placement
- [ ] Verify description has bullet points
- [ ] Check keyword count (5-15 range)
- [ ] Test SEO score calculator
- [ ] Compare SEO scores before/after optimization
- [ ] Test on different platforms (eBay, Vinted, Gumtree)

### Success Metrics

- SEO scores average 70+ (vs current ~40-50 estimated)
- Keyword count increases from 3-5 to 8-12
- Descriptions include 3+ bullet points
- Title includes brand + item type + key feature

---

## Feature 3: Image Quality Scoring

**Priority:** HIGH
**Complexity:** Low-Medium
**Timeline:** 2-3 days
**Cost Impact:** Minimal (uses existing Gemini Vision)

### Problem Statement

Users upload poor-quality images (blurry, dark, cluttered backgrounds) without realizing it, leading to lower sales.

### Solution

Use Gemini Vision to analyze image quality and provide actionable feedback before listing.

### Technical Implementation

#### 1. Image Quality Analysis Prompt

```javascript
// Add new method to server.js
async function analyzeImageQuality(imageBase64) {
  const prompt = `
Analyze this product image for marketplace listing quality.

Evaluate on these criteria (score 0-10 for each):

1. SHARPNESS/FOCUS
   - Is the product clearly in focus?
   - Any motion blur or camera shake?
   - Score 0-10: ____

2. LIGHTING
   - Is the product well-lit?
   - Any harsh shadows or overexposure?
   - Score 0-10: ____

3. BACKGROUND
   - Is background clean/uncluttered?
   - Any distracting elements?
   - Score 0-10: ____

4. COMPOSITION
   - Is product centered and properly framed?
   - Is entire product visible?
   - Score 0-10: ____

5. ANGLE/VIEW
   - Does this angle show product well?
   - What views are missing?
   - Score 0-10: ____

CRITICAL DEFECTS (Yes/No):
- Motion blur:
- Extreme darkness:
- Product cut off:
- Watermark present:
- Text overlay:

Return JSON:
{
  "overallScore": 0-100,
  "sharpness": 0-10,
  "lighting": 0-10,
  "background": 0-10,
  "composition": 0-10,
  "angle": 0-10,
  "criticalIssues": ["issue1", "issue2"],
  "recommendations": [
    "Specific actionable suggestion",
    "Another improvement",
    ...
  ],
  "passesMinimumQuality": true/false
}
`;

  const response = await callGeminiVision(imageBase64, prompt);
  return JSON.parse(response);
}
```

#### 2. Quality Gating System

```javascript
// Add to app.processFiles after blur detection
const qualityAnalysis = await fetch('/api/analyze-image-quality', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.state.user.token}`,
  },
  body: JSON.stringify({ image: imageData.data }),
});

const quality = await qualityAnalysis.json();

imageData.qualityScore = quality.overallScore;
imageData.qualityIssues = quality.criticalIssues;
imageData.qualityRecommendations = quality.recommendations;

// Warn if below threshold
if (quality.overallScore < 60) {
  this.showQualityWarning(imageData, quality);
}
```

#### 3. Quality Warning Modal

```javascript
showQualityWarning(imageData, quality) {
    const modal = `
        <div class="modal quality-warning-modal">
            <div class="modal-content">
                <h3>⚠️ Image Quality Issues Detected</h3>
                <div class="quality-score">
                    Score: ${quality.overallScore}/100
                </div>
                <img src="${imageData.data}" style="max-width: 300px;">
                <div class="quality-breakdown">
                    <div class="quality-item">
                        <span>Sharpness:</span>
                        <div class="quality-bar">
                            <div class="quality-fill" style="width: ${quality.sharpness * 10}%"></div>
                        </div>
                        <span>${quality.sharpness}/10</span>
                    </div>
                    <div class="quality-item">
                        <span>Lighting:</span>
                        <div class="quality-bar">
                            <div class="quality-fill" style="width: ${quality.lighting * 10}%"></div>
                        </div>
                        <span>${quality.lighting}/10</span>
                    </div>
                    <div class="quality-item">
                        <span>Background:</span>
                        <div class="quality-bar">
                            <div class="quality-fill" style="width: ${quality.background * 10}%"></div>
                        </div>
                        <span>${quality.background}/10</span>
                    </div>
                    <div class="quality-item">
                        <span>Composition:</span>
                        <div class="quality-bar">
                            <div class="quality-fill" style="width: ${quality.composition * 10}%"></div>
                        </div>
                        <span>${quality.composition}/10</span>
                    </div>
                </div>
                <div class="recommendations">
                    <h4>Recommendations:</h4>
                    <ul>
                        ${quality.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="app.retakePhoto(${imageData.id})">
                        Retake Photo
                    </button>
                    <button class="btn btn-primary" onclick="app.useImageAnyway(${imageData.id})">
                        Use Anyway
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
},
```

### Backend Changes (server.js)

```javascript
// Add new endpoint
app.post('/api/analyze-image-quality', requireAuth, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image required' });
    }

    const quality = await analyzeImageQuality(image);

    res.json(quality);
  } catch (error) {
    console.error('Image quality analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze image quality' });
  }
});
```

### Testing Checklist

- [ ] Upload high-quality image (expect score 80+)
- [ ] Upload blurry image (expect sharpness < 5)
- [ ] Upload dark image (expect lighting < 5)
- [ ] Upload cluttered background (expect background < 5)
- [ ] Upload cut-off product (expect composition < 5)
- [ ] Verify recommendations are actionable
- [ ] Test "Retake Photo" flow
- [ ] Test "Use Anyway" override

### Success Metrics

- Average image quality score improves from ~50 to 70+
- Users retake 20-30% of poor-quality photos
- Listings with quality score 70+ sell 25% faster (track over time)

---

## Feature 4: eBay Pricing Intelligence + Predictive Pricing

**Priority:** CRITICAL
**Complexity:** Medium-High
**Timeline:** 5-7 days
**Cost Impact:** $0 (eBay API is free)

### Problem Statement

Current pricing relies on Gemini's web research, which is:

- Inconsistent
- Not real-time
- Doesn't show sold vs unsold items
- No predictive analysis

### Solution

Integrate eBay Finding API to fetch real sold listings data and build ML-based price prediction engine.

### Technical Implementation

#### 1. eBay Finding API Setup

```javascript
// Add to server.js
const ebay = require('ebay-api');

const ebayFindingAPI = new ebay({
  clientID: process.env.EBAY_APP_ID,
  env: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
});

async function getEbayPricingIntelligence(title, category) {
  try {
    // Search for completed listings (sold + unsold)
    const completedListings = await ebayFindingAPI.findCompletedItems({
      keywords: title,
      categoryId: category,
      itemFilter: [
        { name: 'ListingType', value: 'All' },
        { name: 'Condition', value: 'Used' },
      ],
      sortOrder: 'EndTimeSoonest',
      paginationInput: { entriesPerPage: 50 },
    });

    // Separate sold from unsold
    const soldItems = completedListings.filter(
      (item) => item.sellingStatus.sellingState === 'EndedWithSales'
    );
    const unsoldItems = completedListings.filter(
      (item) => item.sellingStatus.sellingState !== 'EndedWithSales'
    );

    // Calculate statistics
    const soldPrices = soldItems.map((item) => parseFloat(item.sellingStatus.currentPrice.value));
    const unsoldPrices = unsoldItems.map((item) =>
      parseFloat(item.sellingStatus.currentPrice.value)
    );

    return {
      totalResults: completedListings.length,
      soldCount: soldItems.length,
      unsoldCount: unsoldItems.length,
      soldPrices: {
        average: calculateAverage(soldPrices),
        median: calculateMedian(soldPrices),
        min: Math.min(...soldPrices),
        max: Math.max(...soldPrices),
        priceDistribution: calculateDistribution(soldPrices),
      },
      unsoldPrices: {
        average: calculateAverage(unsoldPrices),
        median: calculateMedian(unsoldPrices),
      },
      pricePoints: [
        { price: calculatePercentile(soldPrices, 25), sellProbability: 0.85, label: 'Quick sale' },
        { price: calculatePercentile(soldPrices, 50), sellProbability: 0.7, label: 'Balanced' },
        { price: calculatePercentile(soldPrices, 75), sellProbability: 0.45, label: 'Premium' },
      ],
      soldExamples: soldItems.slice(0, 5).map((item) => ({
        title: item.title,
        price: item.sellingStatus.currentPrice.value,
        endDate: item.listingInfo.endTime,
        url: item.viewItemURL,
      })),
    };
  } catch (error) {
    console.error('eBay pricing intelligence error:', error);
    return null;
  }
}

function calculateAverage(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function calculateMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculatePercentile(arr, percentile) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

function calculateDistribution(prices) {
  const buckets = [0, 20, 40, 60, 80, 100, 150, 200, 300, 500, 1000];
  const distribution = {};

  buckets.forEach((bucket, i) => {
    const next = buckets[i + 1] || Infinity;
    const count = prices.filter((p) => p >= bucket && p < next).length;
    distribution[`${bucket}-${next === Infinity ? '+' : next}`] = count;
  });

  return distribution;
}
```

#### 2. Predictive Pricing Engine

```javascript
async function predictOptimalPrice(listing, ebayData) {
  // Features for prediction
  const features = {
    soldCount: ebayData.soldCount,
    unsoldCount: ebayData.unsoldCount,
    sellThroughRate: ebayData.soldCount / (ebayData.soldCount + ebayData.unsoldCount),
    medianSoldPrice: ebayData.soldPrices.median,
    avgSoldPrice: ebayData.soldPrices.average,
    priceSpread: ebayData.soldPrices.max - ebayData.soldPrices.min,

    // Listing quality factors
    imageCount: listing.images?.length || 1,
    imageQuality: listing.qualityScore || 70,
    descriptionLength: listing.description?.length || 0,
    keywordCount: listing.keywords?.length || 0,

    // Condition factor
    conditionMultiplier: getConditionMultiplier(listing.condition),
  };

  // Simple ML-based prediction (can be replaced with trained model later)
  let predictedPrice = features.medianSoldPrice;

  // Adjust based on condition
  predictedPrice *= features.conditionMultiplier;

  // Adjust based on listing quality
  const qualityFactor = (features.imageQuality / 100) * 1.1; // Up to 10% premium for great images
  predictedPrice *= qualityFactor;

  // Market demand adjustment
  if (features.sellThroughRate > 0.7) {
    predictedPrice *= 1.05; // High demand, can price higher
  } else if (features.sellThroughRate < 0.3) {
    predictedPrice *= 0.95; // Low demand, price competitively
  }

  // Calculate confidence based on data quality
  const confidence = Math.min(
    (features.soldCount / 20) * 100, // More sold items = more confidence
    100
  );

  return {
    recommendedPrice: Math.round(predictedPrice * 100) / 100,
    priceRange: {
      min: Math.round(predictedPrice * 0.85 * 100) / 100,
      max: Math.round(predictedPrice * 1.15 * 100) / 100,
    },
    confidence: confidence,
    reasoning: [
      `Based on ${features.soldCount} sold listings`,
      `Median sold price: £${features.medianSoldPrice}`,
      `Sell-through rate: ${(features.sellThroughRate * 100).toFixed(0)}%`,
      features.sellThroughRate > 0.7
        ? 'High demand - can price premium'
        : 'Competitive pricing recommended',
      `Adjusted for ${listing.condition} condition`,
      `Image quality bonus: +${((qualityFactor - 1) * 100).toFixed(0)}%`,
    ],
    marketInsights: {
      demand:
        features.sellThroughRate > 0.7 ? 'HIGH' : features.sellThroughRate > 0.4 ? 'MEDIUM' : 'LOW',
      competition: features.unsoldCount > features.soldCount ? 'HIGH' : 'MODERATE',
      trend: 'STABLE', // Would require time-series data
      recommendedAction:
        features.sellThroughRate > 0.6 ? 'List now - high demand' : 'Consider waiting or bundling',
    },
  };
}

function getConditionMultiplier(condition) {
  const multipliers = {
    New: 1.0,
    'Like New': 0.9,
    Excellent: 0.85,
    'Very Good': 0.75,
    Good: 0.65,
    Fair: 0.5,
    Poor: 0.35,
  };
  return multipliers[condition] || 0.7;
}
```

#### 3. Update /api/generate Endpoint

```javascript
// Modify generate endpoint to include pricing intelligence
app.post('/api/generate', requireAuth, rateLimiters.generate, async (req, res) => {
  try {
    const { image, platform, hint } = req.body;

    // ... existing validation ...

    // Generate base listing with Gemini
    const geminiResult = await callGeminiAPI(image, platform, hint);

    // ENHANCEMENT: Get eBay pricing intelligence
    let pricingIntelligence = null;
    let predictedPrice = null;

    if (platform === 'ebay' || platform === 'all') {
      try {
        pricingIntelligence = await getEbayPricingIntelligence(
          geminiResult.title,
          geminiResult.category
        );

        if (pricingIntelligence) {
          predictedPrice = await predictOptimalPrice(geminiResult, pricingIntelligence);
        }
      } catch (error) {
        console.error('Pricing intelligence error:', error);
        // Continue without pricing data
      }
    }

    // Merge results
    const result = {
      ...geminiResult,
      pricing: {
        geminiSuggestion: geminiResult.price,
        ebayData: pricingIntelligence,
        prediction: predictedPrice,
        recommendedPrice: predictedPrice?.recommendedPrice || geminiResult.price,
      },
    };

    res.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate listing' });
  }
});
```

#### 4. Frontend UI for Pricing Intelligence

```javascript
// Add to displayResults in index.html
displayPricingIntelligence(pricing) {
    if (!pricing.prediction) {
        return '<p>Pricing data unavailable</p>';
    }

    const { prediction, ebayData } = pricing;

    return `
        <div class="pricing-intelligence">
            <h3>💰 Pricing Intelligence</h3>

            <div class="price-recommendation">
                <div class="recommended-price">
                    <span class="label">Recommended Price</span>
                    <span class="price">£${prediction.recommendedPrice}</span>
                    <span class="confidence">Confidence: ${prediction.confidence}%</span>
                </div>
                <div class="price-range">
                    <span>Range: £${prediction.priceRange.min} - £${prediction.priceRange.max}</span>
                </div>
            </div>

            <div class="market-insights">
                <div class="insight-item">
                    <span class="label">Demand:</span>
                    <span class="value ${prediction.marketInsights.demand.toLowerCase()}">
                        ${prediction.marketInsights.demand}
                    </span>
                </div>
                <div class="insight-item">
                    <span class="label">Competition:</span>
                    <span class="value">${prediction.marketInsights.competition}</span>
                </div>
                <div class="insight-item">
                    <span class="label">Sell-through Rate:</span>
                    <span class="value">
                        ${((ebayData.soldCount / (ebayData.soldCount + ebayData.unsoldCount)) * 100).toFixed(0)}%
                    </span>
                </div>
            </div>

            <div class="pricing-reasoning">
                <h4>Why this price?</h4>
                <ul>
                    ${prediction.reasoning.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>

            <div class="price-options">
                <h4>Alternative Pricing Strategies</h4>
                ${ebayData.pricePoints.map(pp => `
                    <div class="price-option">
                        <input type="radio" name="priceStrategy" value="${pp.price}">
                        <label>
                            <span class="price">£${pp.price}</span>
                            <span class="strategy">${pp.label}</span>
                            <span class="probability">${(pp.sellProbability * 100).toFixed(0)}% sell probability</span>
                        </label>
                    </div>
                `).join('')}
            </div>

            <div class="sold-examples">
                <h4>Recently Sold Similar Items</h4>
                ${ebayData.soldExamples.map(ex => `
                    <div class="sold-example">
                        <a href="${ex.url}" target="_blank">${ex.title}</a>
                        <span class="sold-price">£${ex.price}</span>
                        <span class="sold-date">${new Date(ex.endDate).toLocaleDateString()}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
},
```

### Database Schema Enhancement

```sql
-- Add pricing intelligence to listings table
ALTER TABLE listings ADD COLUMN ebay_pricing_data JSONB;
ALTER TABLE listings ADD COLUMN predicted_price DECIMAL;
ALTER TABLE listings ADD COLUMN price_confidence DECIMAL;

-- Example structure:
{
  "soldCount": 25,
  "unsoldCount": 10,
  "sellThroughRate": 0.71,
  "medianSoldPrice": 45.00,
  "recommendedPrice": 48.50,
  "priceRange": {"min": 41.25, "max": 55.75},
  "confidence": 90,
  "marketInsights": {
    "demand": "HIGH",
    "competition": "MODERATE"
  },
  "lastUpdated": "2025-11-11T10:30:00Z"
}
```

### Testing Checklist

- [ ] Test eBay API connection
- [ ] Verify sold vs unsold item separation
- [ ] Check price calculation accuracy
- [ ] Test with high-demand item (expect higher price)
- [ ] Test with low-demand item (expect competitive price)
- [ ] Test with insufficient data (graceful fallback)
- [ ] Verify UI displays all pricing elements
- [ ] Test price selection (alternative strategies)

### Success Metrics

- Pricing accuracy within 10% of actual sale price
- Confidence scores average 70%+
- Users select recommended price 60%+ of time
- Items priced with intelligence sell 20% faster (track over time)

---

## Feature 5: AI Damage Detection

**Priority:** HIGH (Unique differentiator - NO competitor has this)
**Complexity:** Medium
**Timeline:** 5-7 days
**Cost Impact:** Marginal (enhanced Gemini Vision prompts)

### Problem Statement

AI often misses product flaws (stains, tears, wear), leading to:

- Inaccurate condition ratings
- Customer complaints
- Returns
- Negative reviews

### Solution

Use computer vision to systematically inspect products for damage and defects across multiple images.

### Technical Implementation

#### 1. Damage Detection Prompt

```javascript
// Add to server.js
async function detectDamage(images) {
  const prompt = `
You are a professional product inspector analyzing images for defects and damage.

ANALYZE ALL ${images.length} IMAGE(S) SYSTEMATICALLY:

For EACH image, identify:
1. VISIBLE DEFECTS:
   - Stains (location, color, size)
   - Tears/holes (location, size)
   - Scratches (severity, location)
   - Discoloration/fading
   - Missing parts (buttons, zippers, etc.)
   - Structural damage (bent, broken, cracked)
   - Wear patterns (fraying, pilling, sole wear)

2. DEFECT SEVERITY:
   - CRITICAL: Makes item unusable or significantly impacts value
   - MAJOR: Clearly visible, impacts appearance/function
   - MINOR: Small, barely noticeable, doesn't affect function
   - NORMAL WEAR: Expected for used item

3. LOCATION:
   - Specific location on item (front, back, left sleeve, right toe, etc.)
   - Size estimate (cm or % of area)

4. RECOMMENDED CONDITION RATING:
   - New with tags
   - New without tags
   - Like New (no visible wear)
   - Excellent (minimal wear)
   - Very Good (light wear, no defects)
   - Good (obvious wear, minor defects)
   - Fair (significant wear, multiple defects)
   - Poor (major defects, functional issues)

Return JSON:
{
  "defects": [
    {
      "type": "stain|tear|scratch|discoloration|missing_part|structural|wear",
      "severity": "critical|major|minor|normal_wear",
      "location": "specific location",
      "description": "detailed description",
      "imageIndex": 0,
      "estimatedSize": "measurement or %",
      "impactOnValue": "percentage reduction estimate"
    }
  ],
  "overallCondition": "condition rating",
  "conditionJustification": "why this rating",
  "suggestedDisclosures": [
    "Bullet point disclosure for listing",
    "Another disclosure"
  ],
  "recommendedPhotos": [
    "Close-up of stain on front",
    "Detail shot of missing button"
  ],
  "честность_score": 0-100 (how honestly defects were disclosed)
}

BE THOROUGH. Better to over-report minor issues than miss major ones.
`;

  const response = await callGeminiVisionMultiImage(images, prompt);
  return JSON.parse(response);
}
```

#### 2. Multi-Image Analysis Function

```javascript
// Enhanced Gemini call for multiple images
async function callGeminiVisionMultiImage(images, prompt) {
  const imageParts = images.map((img) => ({
    inlineData: {
      data: img.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: 'image/jpeg',
    },
  }));

  const response = await geminiModel.generateContent([
    {
      text: prompt,
    },
    ...imageParts,
  ]);

  return response.response.text();
}
```

#### 3. Damage Visualization UI

```javascript
// Add to index.html app object
displayDamageAnalysis(damageData) {
    if (!damageData.defects || damageData.defects.length === 0) {
        return `
            <div class="damage-analysis clean">
                <h3>✅ No Defects Detected</h3>
                <p>AI analysis found no visible damage or defects.</p>
                <p class="condition-rating">Condition: ${damageData.overallCondition}</p>
            </div>
        `;
    }

    return `
        <div class="damage-analysis">
            <h3>🔍 Damage Detection Results</h3>

            <div class="condition-summary">
                <div class="condition-rating">
                    <span class="label">Recommended Condition:</span>
                    <span class="value">${damageData.overallCondition}</span>
                </div>
                <p class="justification">${damageData.conditionJustification}</p>
            </div>

            <div class="defects-list">
                <h4>Detected Defects (${damageData.defects.length})</h4>
                ${damageData.defects.map((defect, i) => `
                    <div class="defect-item severity-${defect.severity}">
                        <div class="defect-header">
                            <span class="defect-type">${this.formatDefectType(defect.type)}</span>
                            <span class="defect-severity ${defect.severity}">${defect.severity.toUpperCase()}</span>
                        </div>
                        <div class="defect-details">
                            <p><strong>Location:</strong> ${defect.location}</p>
                            <p><strong>Description:</strong> ${defect.description}</p>
                            ${defect.estimatedSize ? `<p><strong>Size:</strong> ${defect.estimatedSize}</p>` : ''}
                            ${defect.impactOnValue ? `<p><strong>Value Impact:</strong> -${defect.impactOnValue}</p>` : ''}
                        </div>
                        <div class="defect-image">
                            <img src="${this.state.images[defect.imageIndex].data}"
                                 onclick="app.showDefectDetail(${i})"
                                 alt="Image showing defect">
                            <span class="image-label">Image ${defect.imageIndex + 1}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="suggested-disclosures">
                <h4>📝 Recommended Disclosures for Listing</h4>
                <p>Copy these into your description to build buyer trust:</p>
                <ul>
                    ${damageData.suggestedDisclosures.map(d => `<li>${d}</li>`).join('')}
                </ul>
                <button class="btn btn-secondary" onclick="app.addDisclosuresToDescription()">
                    Add to Description
                </button>
            </div>

            ${damageData.recommendedPhotos.length > 0 ? `
                <div class="photo-recommendations">
                    <h4>📷 Missing Photos Recommended</h4>
                    <p>Consider adding these photos to build buyer confidence:</p>
                    <ul>
                        ${damageData.recommendedPhotos.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="honesty-score">
                <h4>Honesty Score</h4>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${damageData.honesty_score}%"></div>
                </div>
                <p>${damageData.honesty_score}/100 - ${this.getHonestyMessage(damageData.honesty_score)}</p>
            </div>
        </div>
    `;
},

formatDefectType(type) {
    const types = {
        'stain': '🔴 Stain',
        'tear': '⚠️ Tear/Hole',
        'scratch': '〰️ Scratch',
        'discoloration': '🎨 Discoloration',
        'missing_part': '❌ Missing Part',
        'structural': '🔧 Structural Damage',
        'wear': '👕 Normal Wear'
    };
    return types[type] || type;
},

getHonestyMessage(score) {
    if (score >= 90) return 'Excellent transparency - buyers will appreciate your honesty';
    if (score >= 70) return 'Good disclosure - consider adding more detail';
    if (score >= 50) return 'Fair - some defects may not be adequately disclosed';
    return 'Needs improvement - add more defect details to avoid returns';
},

addDisclosuresToDescription() {
    const disclosures = this.state.damageAnalysis.suggestedDisclosures;
    const currentDesc = document.getElementById('description').value;

    const updatedDesc = currentDesc + '\n\n**Condition Notes:**\n' +
                        disclosures.map(d => `• ${d}`).join('\n');

    document.getElementById('description').value = updatedDesc;
    this.showToast('Disclosures added to description', 'success');
},
```

#### 4. Update /api/generate to Include Damage Detection

```javascript
// After basic listing generation
let damageAnalysis = null;

if (images.length > 0) {
  try {
    damageAnalysis = await detectDamage(images);

    // Update condition based on damage detection
    if (damageAnalysis.overallCondition) {
      result.condition = damageAnalysis.overallCondition;
    }

    // Add defect disclosures to description
    if (damageAnalysis.suggestedDisclosures.length > 0) {
      result.description +=
        '\n\n**Condition Notes:**\n' +
        damageAnalysis.suggestedDisclosures.map((d) => `• ${d}`).join('\n');
    }
  } catch (error) {
    console.error('Damage detection error:', error);
    // Continue without damage analysis
  }
}

const result = {
  ...geminiResult,
  damageAnalysis: damageAnalysis,
};
```

### Database Schema

```sql
-- Add damage analysis to listings table
ALTER TABLE listings ADD COLUMN damage_analysis JSONB;

-- Example structure:
{
  "defects": [
    {
      "type": "stain",
      "severity": "minor",
      "location": "front right chest",
      "description": "Small coffee stain, 1cm diameter",
      "imageIndex": 0,
      "estimatedSize": "1cm",
      "impactOnValue": "5%"
    }
  ],
  "overallCondition": "Good",
  "conditionJustification": "Light wear typical for age, one minor stain",
  "suggestedDisclosures": ["Small coffee stain on front right chest"],
  "honestyScore": 85
}
```

### Testing Checklist

- [ ] Test with pristine item (no defects)
- [ ] Test with obvious stain
- [ ] Test with tear/hole
- [ ] Test with multiple defects across multiple images
- [ ] Test with normal wear vs damage
- [ ] Verify condition rating accuracy
- [ ] Test disclosure auto-generation
- [ ] Verify image index references correct photo

### Success Metrics

- Defect detection accuracy: 85%+ (vs manual inspection)
- Condition ratings within 1 grade of expert assessment
- Disclosure inclusion rate: 80%+ of listings with defects
- Reduced return rate due to inaccurate descriptions (track over time)
- User trust score improves (via reviews mentioning "accurate description")

---

## Feature 6: Barcode Scanner (Mobile-First)

**Priority:** HIGH
**Complexity:** Medium
**Timeline:** 5-7 days
**Cost Impact:** Varies ($0-$50/month depending on API choice)

### Problem Statement

Listing branded items (electronics, books, toys, beauty products) requires manual research for specs, even though UPC/EAN contains all product data.

### Solution

Mobile camera barcode scanner that instantly populates listing with product data from UPC databases.

### Technical Implementation

#### 1. Barcode Scanner Library (Frontend)

```javascript
// Add to index.html
// Use QuaggaJS for barcode scanning
<script src="https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js"></script>

// Add to app object
initBarcodeScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#barcodeScannerView'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Use rear camera
            },
        },
        decoder: {
            readers: [
                "ean_reader",     // EAN-13, EAN-8
                "upc_reader",     // UPC-A, UPC-E
                "code_128_reader",
                "code_39_reader"
            ]
        },
    }, (err) => {
        if (err) {
            console.error('Barcode scanner init error:', err);
            this.showToast('Camera access denied or unavailable');
            return;
        }
        Quagga.start();
    });

    Quagga.onDetected((data) => {
        const barcode = data.codeResult.code;
        this.processBarcodeResult(barcode);
        Quagga.stop(); // Stop scanning after successful read
    });
},

async processBarcodeResult(barcode) {
    this.showToast('Barcode detected! Looking up product...', 'info');

    try {
        const response = await fetch('/api/lookup-barcode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.state.user.token}`
            },
            body: JSON.stringify({ barcode })
        });

        const productData = await response.json();

        if (productData.found) {
            this.prefillListingFromBarcode(productData);
            this.showToast('Product found! Details pre-filled.', 'success');
        } else {
            this.showToast('Product not found in database. Manual entry required.');
        }
    } catch (error) {
        this.showToast('Barcode lookup failed: ' + error.message);
    }
},

prefillListingFromBarcode(productData) {
    // Pre-fill form fields
    document.getElementById('title').value = productData.title || '';
    document.getElementById('brand').value = productData.brand || '';
    document.getElementById('category').value = productData.category || '';
    document.getElementById('description').value = this.generateDescriptionFromProduct(productData);

    // Set pricing from product data
    if (productData.rrp) {
        this.state.generatedListing.rrp = productData.rrp;
        this.state.generatedListing.price = this.calculateUsedPrice(productData.rrp);
    }

    // Store product data for reference
    this.state.productData = productData;

    this.renderResults();
},

generateDescriptionFromProduct(product) {
    let desc = product.description || '';

    // Add specifications if available
    if (product.specifications) {
        desc += '\n\n**Specifications:**\n';
        Object.entries(product.specifications).forEach(([key, value]) => {
            desc += `• ${key}: ${value}\n`;
        });
    }

    // Add condition note
    desc += '\n\n**Condition:** Please inspect photos. Item sold as-is.';

    return desc;
},

calculateUsedPrice(rrp) {
    // Simple logic: Used items typically 40-70% of RRP
    const rrpNum = parseFloat(rrp.replace(/[^\d.]/g, ''));
    const usedMultiplier = 0.55; // 55% of RRP
    return `£${(rrpNum * usedMultiplier).toFixed(2)}`;
},
```

#### 2. Barcode Lookup Backend (server.js)

```javascript
// Multiple barcode API options

// OPTION 1: UPC Database (Free tier: 100 requests/day)
const upcDatabaseAPI = async (barcode) => {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
    headers: {
      user_key: process.env.UPC_DATABASE_API_KEY,
    },
  });

  const data = await response.json();

  if (data.items && data.items.length > 0) {
    const item = data.items[0];
    return {
      found: true,
      barcode: barcode,
      title: item.title,
      brand: item.brand,
      category: item.category,
      description: item.description,
      images: item.images || [],
      rrp: item.msrp || null,
      specifications: {
        EAN: item.ean,
        UPC: item.upc,
        Model: item.model || 'N/A',
        Size: item.size || 'N/A',
        Color: item.color || 'N/A',
      },
    };
  }

  return { found: false };
};

// OPTION 2: Barcode Spider (More reliable, paid)
const barcodeSpiderAPI = async (barcode) => {
  const response = await fetch(
    `https://api.barcodespider.com/v1/lookup?upc=${barcode}&token=${process.env.BARCODE_SPIDER_TOKEN}`
  );

  const data = await response.json();

  if (data.item_found) {
    return {
      found: true,
      barcode: barcode,
      title: data.item_attributes.title,
      brand: data.item_attributes.brand,
      category: data.item_attributes.category,
      description: data.item_attributes.description,
      images: [data.item_attributes.image],
      rrp: data.item_attributes.msrp,
      specifications: {
        UPC: barcode,
        ASIN: data.item_attributes.asin || 'N/A',
        Model: data.item_attributes.model || 'N/A',
      },
    };
  }

  return { found: false };
};

// OPTION 3: Open Food Facts (Free, for food/grocery items)
const openFoodFactsAPI = async (barcode) => {
  const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);

  const data = await response.json();

  if (data.status === 1) {
    const product = data.product;
    return {
      found: true,
      barcode: barcode,
      title: product.product_name,
      brand: product.brands,
      category: product.categories,
      description: `${product.product_name} - ${product.generic_name || ''}`,
      images: [product.image_url],
      rrp: null, // Not available
      specifications: {
        Ingredients: product.ingredients_text || 'N/A',
        Quantity: product.quantity || 'N/A',
      },
    };
  }

  return { found: false };
};

// Main lookup endpoint
app.post('/api/lookup-barcode', requireAuth, async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode required' });
    }

    // Try multiple sources in order
    let result = await upcDatabaseAPI(barcode);

    if (!result.found) {
      result = await barcodeSpiderAPI(barcode);
    }

    if (!result.found && barcode.length === 13) {
      // Try Open Food Facts for groceries
      result = await openFoodFactsAPI(barcode);
    }

    res.json(result);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: 'Barcode lookup failed', found: false });
  }
});
```

#### 3. Barcode Scanner UI (Mobile View)

```html
<!-- Add to index.html -->
<div id="barcodeScannerModal" class="modal hidden">
  <div class="modal-content scanner-modal">
    <div class="scanner-header">
      <h3>Scan Product Barcode</h3>
      <button class="btn-close" onclick="app.closeBarcodeScanner()">×</button>
    </div>

    <div id="barcodeScannerView" class="scanner-viewport"></div>

    <div class="scanner-instructions">
      <p>Position barcode within the frame</p>
      <p class="help-text">Works with UPC, EAN, Code128, Code39</p>
    </div>

    <div class="scanner-actions">
      <button class="btn btn-secondary" onclick="app.manualBarcodeEntry()">Enter Manually</button>
      <button class="btn btn-primary" onclick="app.closeBarcodeScanner()">Cancel</button>
    </div>
  </div>
</div>

<!-- Add button to main listing form -->
<button class="btn btn-secondary" onclick="app.showBarcodeScanner()">📷 Scan Barcode</button>
```

#### 4. Manual Barcode Entry (Fallback)

```javascript
manualBarcodeEntry() {
    const barcode = prompt('Enter barcode number (UPC or EAN):');
    if (barcode && barcode.length >= 8) {
        this.closeBarcodeScanner();
        this.processBarcodeResult(barcode);
    } else {
        this.showToast('Invalid barcode format');
    }
},
```

### API Cost Comparison

| Service                | Free Tier | Paid Plan             | Database Size       | Notes             |
| ---------------------- | --------- | --------------------- | ------------------- | ----------------- |
| **UPC Database**       | 100/day   | $20/month (10K)       | 1B+ items           | Best free option  |
| **Barcode Spider**     | None      | $15/month (5K)        | 500M+ items         | Most reliable     |
| **Open Food Facts**    | Unlimited | Free (open source)    | 2M+ food items      | Food/grocery only |
| **Amazon Product API** | Free      | Free (with Associate) | All Amazon products | Requires approval |

**Recommendation:** Start with UPC Database free tier (100/day = 3,000/month). Upgrade to Barcode Spider ($15/month) if demand exceeds free tier.

### Testing Checklist

- [ ] Test camera permissions (allow/deny)
- [ ] Scan EAN-13 barcode (European products)
- [ ] Scan UPC-A barcode (US products)
- [ ] Scan Code128 barcode
- [ ] Test manual entry fallback
- [ ] Test with unknown barcode (graceful failure)
- [ ] Test with food item (Open Food Facts)
- [ ] Test with electronics (UPC Database)
- [ ] Verify pre-fill accuracy
- [ ] Test on multiple mobile devices (iOS, Android)

### Success Metrics

- Barcode recognition success rate: 90%+
- Product match rate: 70%+ (depends on database coverage)
- Time to list branded item: Reduced from 5-10 min to <2 min
- User adoption: 40%+ of listings for branded items use barcode scanner

---

## Mobile-First Design Plan

See separate document: [MOBILE_FIRST_DESIGN_PLAN.md](./MOBILE_FIRST_DESIGN_PLAN.md)

---

## Summary & Next Steps

### Priority Order (Recommended)

1. **Week 1:** Batch upload with auto-resize (saves costs immediately)
2. **Week 1:** Enhanced SEO prompts (quick win, $0 cost)
3. **Week 1:** Image quality scoring (quick win, uses existing API)
4. **Week 2:** eBay pricing intelligence (critical for accuracy)
5. **Week 2:** Predictive pricing engine (combines with eBay data)
6. **Week 3:** AI damage detection (unique differentiator)
7. **Week 3-4:** Barcode scanner (high value for branded items)

### Resource Requirements

- **Development Time:** 3-4 weeks full-time
- **API Costs:** $15-50/month (eBay free, barcode $15/month, image quality included)
- **Testing Time:** 1 week for all features
- **Documentation:** Update API docs, user guides

### Risk Mitigation

- Start with free API tiers where available
- Build graceful fallbacks for all AI features
- Extensive mobile testing (70%+ traffic is mobile)
- A/B test pricing recommendations before full rollout

### Success Tracking

- Monitor API costs daily
- Track user adoption of each feature
- Measure listing quality improvements (SEO scores, image quality)
- Measure business outcomes (time to list, sell-through rate, pricing accuracy)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Author:** QuickList AI Development Team
