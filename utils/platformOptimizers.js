/**
 * Platform Optimizers
 *
 * Generates platform-specific variations of listings for:
 * - eBay (professional, detailed)
 * - Vinted (size conversions, savings emphasis)
 * - Depop (casual tone, heavy hashtags)
 * - Facebook Marketplace (local focus, emoji sections)
 */

const db = require('../db'); // Assume database connection module exists

/**
 * Main function: Generate all platform variations for a listing
 */
async function generateAllPlatformVariations(listing, listingId) {
  const variations = {
    ebay: await optimizeForEbay(listing),
    vinted: await optimizeForVinted(listing),
    depop: await optimizeForDepop(listing),
    facebook: await optimizeForFacebook(listing)
  };

  // Cache optimizations in database
  for (const [platform, optimization] of Object.entries(variations)) {
    await cacheOptimization(listingId, platform, optimization);
  }

  return variations;
}

/**
 * eBay Optimizer
 * Professional format with item specifics
 */
async function optimizeForEbay(listing) {
  const title = listing.title.substring(0, 80); // eBay 80 char limit

  const description = buildEbayDescription(listing);

  const itemSpecifics = {
    Brand: listing.brand,
    Condition: mapConditionToEbay(listing.condition),
    Type: listing.category,
    Size: listing.size || 'N/A',
    Color: listing.color || 'See Description',
    Material: listing.material || 'See Description'
  };

  const categoryId = await suggestEbayCategory(listing);

  const pricing = {
    startPrice: listing.price,
    buyItNowPrice: listing.price,
    currency: 'GBP'
  };

  const shipping = {
    shippingType: 'Flat',
    domesticShippingCost: 3.99,
    dispatchTimeMax: 2,
    internationalShipping: false
  };

  // eBay doesn't use clipboard text (uses direct API)
  const clipboardText = null;

  return {
    platform: 'ebay',
    title,
    description,
    clipboardText,
    itemSpecifics,
    categoryId,
    pricing,
    shipping,
    keywords: listing.keywords || [],
    metadata: {
      format: 'professional',
      apiIntegration: true
    }
  };
}

/**
 * Vinted Optimizer
 * Size conversions (UK/EU/US), savings emphasis
 */
async function optimizeForVinted(listing) {
  const savings = listing.rrp
    ? Math.round(((listing.rrp - listing.price) / listing.rrp) * 100)
    : null;

  const sizeInfo = await convertSizes(listing.size, listing.category);

  // Add emoji to title
  const title = `${listing.title} 🔥`.substring(0, 100);

  // Build size line
  const sizeLine = sizeInfo.uk
    ? `Size: ${sizeInfo.uk} UK / ${sizeInfo.eu} EU / ${sizeInfo.us} US`
    : '';

  // Build price line with savings
  const priceLine = savings
    ? `£${listing.price} (RRP £${listing.rrp} - save ${savings}%!)`
    : `£${listing.price}`;

  // Build hashtags
  const hashtags = [...(listing.keywords || []), listing.brand, listing.category]
    .filter(Boolean)
    .map(k => '#' + k.toLowerCase().replace(/\s+/g, ''))
    .join(' ');

  const description = `
${listing.title}

${sizeLine}
${priceLine}

${listing.description}

${hashtags}
  `.trim();

  // Clipboard format (what user will paste into Vinted)
  const clipboardText = description;

  const itemSpecifics = {
    sizeConversions: sizeInfo,
    savingsPercent: savings,
    brand: listing.brand,
    condition: listing.condition
  };

  return {
    platform: 'vinted',
    title,
    description,
    clipboardText,
    itemSpecifics,
    keywords: listing.keywords || [],
    hashtags: extractHashtags(hashtags),
    metadata: {
      format: 'size_focused',
      savingsHighlighted: savings !== null,
      emojiUsed: true
    }
  };
}

/**
 * Depop Optimizer
 * Casual tone, uppercase title, heavy hashtags
 */
async function optimizeForDepop(listing) {
  // Uppercase title for Depop style
  const title = listing.title.toUpperCase().substring(0, 100);

  // Convert description to casual tone
  const casualDescription = listing.description
    .toLowerCase()
    .replace(/excellent condition/gi, 'amazing condition!!')
    .replace(/very good condition/gi, 'great condition!')
    .replace(/good condition/gi, 'good condition!')
    .replace(/\./g, '!');

  // Generate Depop-specific hashtags
  const additionalHashtags = await generateDepopHashtags(listing);

  // Combine all hashtags
  const allHashtags = [
    ...(listing.keywords || []),
    ...additionalHashtags,
    listing.brand,
    listing.category,
    listing.condition.toLowerCase()
  ]
    .filter(Boolean)
    .map(k => '#' + k.toLowerCase().replace(/\s+/g, ''))
    .join(' ');

  const description = `
${casualDescription} 😍

condition: ${listing.condition.toLowerCase()}
${listing.size ? `size ${listing.size}` : ''}

price: £${listing.price}${listing.rrp ? ` (rrp £${listing.rrp})` : ''}
grab a bargain! 💫

${allHashtags}
  `.trim();

  // Clipboard format
  const clipboardText = `${title} ✨

${description}`;

  const itemSpecifics = {
    tone: 'casual',
    hashtagCount: allHashtags.split('#').length - 1,
    emojiCount: (description.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length
  };

  return {
    platform: 'depop',
    title,
    description,
    clipboardText,
    itemSpecifics,
    keywords: listing.keywords || [],
    hashtags: extractHashtags(allHashtags),
    metadata: {
      format: 'casual',
      uppercaseTitle: true,
      heavyHashtags: true
    }
  };
}

/**
 * Facebook Marketplace Optimizer
 * Local focus, emoji sections
 */
async function optimizeForFacebook(listing) {
  const title = listing.title.substring(0, 100);

  const description = `
${listing.title}

💰 Price: £${listing.price}${listing.rrp ? ` (retail £${listing.rrp})` : ''}
📦 Condition: ${listing.condition}
🏷️ Brand: ${listing.brand}

${listing.description}

${listing.size ? `📏 Size: ${listing.size}` : ''}
${listing.color ? `🎨 Color: ${listing.color}` : ''}
${listing.material ? `🧵 Material: ${listing.material}` : ''}

📍 Can meet locally or post. Message for details!

${(listing.keywords || []).map(k => '#' + k.toLowerCase().replace(/\s+/g, '')).join(' ')}
  `.trim();

  // Clipboard format
  const clipboardText = description;

  const itemSpecifics = {
    localPickup: true,
    postingOption: true,
    emojiSections: true
  };

  return {
    platform: 'facebook',
    title,
    description,
    clipboardText,
    itemSpecifics,
    keywords: listing.keywords || [],
    hashtags: extractHashtags((listing.keywords || []).join(' ')),
    metadata: {
      format: 'local_focused',
      emojiSections: true,
      flexibleDelivery: true
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build eBay description with item specifics
 */
function buildEbayDescription(listing) {
  const sections = [
    listing.description,
    '',
    'ITEM SPECIFICS:',
    `• Brand: ${listing.brand}`,
    `• Condition: ${listing.condition}`,
    `• Category: ${listing.category}`
  ];

  if (listing.size) sections.push(`• Size: ${listing.size}`);
  if (listing.color) sections.push(`• Color: ${listing.color}`);
  if (listing.material) sections.push(`• Material: ${listing.material}`);

  if (listing.keywords && listing.keywords.length > 0) {
    sections.push('');
    sections.push((listing.keywords || []).map(k => '#' + k).join(' '));
  }

  return sections.join('\n');
}

/**
 * Map QuickList condition to eBay condition ID
 */
function mapConditionToEbay(condition) {
  const mapping = {
    'New': 'New with tags',
    'Like New': 'New without tags',
    'Excellent': 'Pre-owned',
    'Very Good': 'Pre-owned',
    'Good': 'Pre-owned',
    'Fair': 'Pre-owned',
    'Poor': 'For parts or not working'
  };
  return mapping[condition] || 'Pre-owned';
}

/**
 * Suggest eBay category ID based on listing category
 */
async function suggestEbayCategory(listing) {
  // Simplified mapping - in production, use eBay's Category API
  const categoryMapping = {
    'sneakers': 15709, // Men's Shoes > Athletic Shoes
    'trainers': 15709,
    'shoes': 11450, // Clothing, Shoes & Accessories
    'clothing': 11450,
    'apparel': 11450,
    'electronics': 293, // Consumer Electronics
    'tech': 293,
    'home': 11700, // Home & Garden
    'furniture': 11700,
    'toys': 220, // Toys & Hobbies
    'books': 267, // Books, Movies & Music
    'collectibles': 1 // Collectibles
  };

  const category = listing.category.toLowerCase();

  // Find first matching keyword
  for (const [keyword, categoryId] of Object.entries(categoryMapping)) {
    if (category.includes(keyword)) {
      return categoryId;
    }
  }

  // Default to Clothing category
  return 11450;
}

/**
 * Convert sizes between UK/EU/US systems
 */
async function convertSizes(size, category) {
  if (!size) return { uk: null, eu: null, us: null };

  const categoryLower = (category || '').toLowerCase();

  // Check if clothing/shoes category
  const isShoes = ['shoe', 'sneaker', 'trainer', 'boot', 'sandal'].some(keyword =>
    categoryLower.includes(keyword)
  );

  const isClothing = ['clothing', 'apparel', 'shirt', 'dress', 'jacket', 'pants', 'jeans'].some(keyword =>
    categoryLower.includes(keyword)
  );

  if (!isShoes && !isClothing) {
    return { uk: size, eu: null, us: null };
  }

  // Shoe size conversions (UK men's)
  if (isShoes) {
    const shoeChart = {
      '5': { uk: '5', eu: '38', us: '6' },
      '5.5': { uk: '5.5', eu: '38.5', us: '6.5' },
      '6': { uk: '6', eu: '39', us: '7' },
      '6.5': { uk: '6.5', eu: '40', us: '7.5' },
      '7': { uk: '7', eu: '40.5', us: '8' },
      '7.5': { uk: '7.5', eu: '41.5', us: '8.5' },
      '8': { uk: '8', eu: '42', us: '9' },
      '8.5': { uk: '8.5', eu: '42.5', us: '9.5' },
      '9': { uk: '9', eu: '43', us: '10' },
      '9.5': { uk: '9.5', eu: '44', us: '10.5' },
      '10': { uk: '10', eu: '44.5', us: '11' },
      '10.5': { uk: '10.5', eu: '45', us: '11.5' },
      '11': { uk: '11', eu: '46', us: '12' },
      '11.5': { uk: '11.5', eu: '46.5', us: '12.5' },
      '12': { uk: '12', eu: '47', us: '13' },
      '13': { uk: '13', eu: '48', us: '14' }
    };

    // Normalize size (remove UK/EU/US prefixes)
    const normalizedSize = size.replace(/\s*(uk|eu|us)\s*/gi, '').trim();

    return shoeChart[normalizedSize] || { uk: size, eu: null, us: null };
  }

  // Clothing size conversions
  if (isClothing) {
    const clothingChart = {
      'XS': { uk: 'XS (6)', eu: '34', us: '2' },
      'S': { uk: 'S (8-10)', eu: '36-38', us: '4-6' },
      'M': { uk: 'M (12-14)', eu: '40-42', us: '8-10' },
      'L': { uk: 'L (16-18)', eu: '44-46', us: '12-14' },
      'XL': { uk: 'XL (20-22)', eu: '48-50', us: '16-18' },
      'XXL': { uk: 'XXL (24-26)', eu: '52-54', us: '20-22' }
    };

    const sizeUpper = size.toUpperCase();
    return clothingChart[sizeUpper] || { uk: size, eu: null, us: null };
  }

  return { uk: size, eu: null, us: null };
}

/**
 * Generate Depop-specific trending hashtags
 */
async function generateDepopHashtags(listing) {
  const trendingTags = [
    'vintage',
    'y2k',
    'aesthetic',
    'streetwear',
    'rare',
    'limited',
    'grunge',
    'retro',
    'authentic',
    'sustainable',
    'thrifted',
    'unique'
  ];

  const description = listing.description.toLowerCase();
  const category = (listing.category || '').toLowerCase();
  const keywords = (listing.keywords || []).map(k => k.toLowerCase());

  const matchedTags = trendingTags.filter(tag => {
    return description.includes(tag) ||
           category.includes(tag) ||
           keywords.some(k => k.includes(tag));
  });

  // Add 2-3 trending tags even if not explicitly mentioned (based on category)
  const categoryTags = getCategoryTrendingTags(category);

  return [...new Set([...matchedTags, ...categoryTags])].slice(0, 5);
}

/**
 * Get trending tags for specific categories
 */
function getCategoryTrendingTags(category) {
  const categoryTagMap = {
    'sneaker': ['streetwear', 'kicks', 'authentic'],
    'shoe': ['footwear', 'style'],
    'clothing': ['fashion', 'style', 'outfit'],
    'jacket': ['outerwear', 'cozy'],
    'dress': ['date', 'party', 'formal'],
    'vintage': ['retro', 'thrifted', 'unique'],
    'designer': ['luxury', 'authentic', 'rare']
  };

  for (const [keyword, tags] of Object.entries(categoryTagMap)) {
    if (category.includes(keyword)) {
      return tags;
    }
  }

  return ['style', 'fashion'];
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text) {
  const matches = text.match(/#[\w]+/g);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

/**
 * Cache optimization in database
 */
async function cacheOptimization(listingId, platform, optimization) {
  try {
    const query = `
      INSERT INTO platform_optimizations (
        listing_id,
        platform,
        optimized_title,
        optimized_description,
        clipboard_text,
        item_specifics,
        keywords,
        hashtags,
        optimization_version,
        needs_regeneration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '1.0', false)
      ON CONFLICT (listing_id, platform)
      DO UPDATE SET
        optimized_title = EXCLUDED.optimized_title,
        optimized_description = EXCLUDED.optimized_description,
        clipboard_text = EXCLUDED.clipboard_text,
        item_specifics = EXCLUDED.item_specifics,
        keywords = EXCLUDED.keywords,
        hashtags = EXCLUDED.hashtags,
        optimization_version = EXCLUDED.optimization_version,
        needs_regeneration = false,
        updated_at = NOW()
    `;

    await db.query(query, [
      listingId,
      platform,
      optimization.title,
      optimization.description,
      optimization.clipboardText,
      JSON.stringify(optimization.itemSpecifics),
      optimization.keywords,
      optimization.hashtags
    ]);
  } catch (error) {
    console.error('Failed to cache optimization:', error);
    // Don't throw - optimization caching is not critical
  }
}

/**
 * Get cached optimization from database
 */
async function getCachedOptimization(listingId, platform) {
  try {
    const query = `
      SELECT * FROM platform_optimizations
      WHERE listing_id = $1
        AND platform = $2
        AND needs_regeneration = false
    `;

    const result = await db.query(query, [listingId, platform]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      platform: row.platform,
      title: row.optimized_title,
      description: row.optimized_description,
      clipboardText: row.clipboard_text,
      itemSpecifics: row.item_specifics,
      keywords: row.keywords,
      hashtags: row.hashtags,
      metadata: {
        cached: true,
        version: row.optimization_version,
        cachedAt: row.updated_at
      }
    };
  } catch (error) {
    console.error('Failed to get cached optimization:', error);
    return null;
  }
}

/**
 * Invalidate cached optimizations (when listing is edited)
 */
async function invalidateOptimizations(listingId) {
  try {
    const query = `
      UPDATE platform_optimizations
      SET needs_regeneration = true,
          updated_at = NOW()
      WHERE listing_id = $1
    `;

    await db.query(query, [listingId]);
  } catch (error) {
    console.error('Failed to invalidate optimizations:', error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  generateAllPlatformVariations,
  optimizeForEbay,
  optimizeForVinted,
  optimizeForDepop,
  optimizeForFacebook,

  // Caching functions
  getCachedOptimization,
  invalidateOptimizations,

  // Helper functions (exported for testing)
  mapConditionToEbay,
  suggestEbayCategory,
  convertSizes,
  generateDepopHashtags,
  extractHashtags
};
