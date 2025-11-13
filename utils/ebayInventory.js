/**
 * eBay Inventory API Integration
 *
 * Implements eBay's Inventory API for creating and managing listings
 * Uses the modern "Inventory" flow instead of legacy Trading API
 *
 * Flow:
 * 1. Create Inventory Item (product details + stock)
 * 2. Create Offer (pricing + policies)
 * 3. Publish Offer (make live on eBay)
 *
 * References:
 * - https://developer.ebay.com/api-docs/sell/inventory/overview.html
 * - https://developer.ebay.com/api-docs/sell/inventory/resources/methods
 */

const axios = require('axios');

class EbayInventory {
  constructor(accessToken, isSandbox = false) {
    this.accessToken = accessToken;
    this.isSandbox = isSandbox;

    this.baseUrl = isSandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    // eBay marketplace (UK)
    this.marketplaceId = 'EBAY_GB';
    this.siteId = '3'; // UK site
  }

  /**
   * Step 1: Create Inventory Item
   * @param {Object} listing - Listing data from QuickList
   * @param {string} sku - Unique SKU for this item
   * @returns {Promise<string>} SKU of created item
   */
  async createInventoryItem(listing, sku) {
    const inventoryItem = {
      availability: {
        shipToLocationAvailability: {
          quantity: 1 // Single item
        }
      },
      condition: this.mapCondition(listing.condition),
      product: {
        title: listing.title.substring(0, 80), // eBay 80 char limit
        description: this.buildDescription(listing),
        aspects: this.buildAspects(listing),
        imageUrls: this.getImageUrls(listing.images),
        ean: listing.ean || undefined,
        upc: listing.upc || undefined
      }
    };

    try {
      await axios.put(
        `${this.baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        inventoryItem,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'en-GB'
          }
        }
      );

      console.log('✓ eBay inventory item created:', sku);
      return sku;
    } catch (error) {
      console.error('eBay inventory item creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create inventory item: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Step 2: Create Offer
   * @param {string} sku - SKU of inventory item
   * @param {Object} listing - Listing data
   * @returns {Promise<string>} Offer ID
   */
  async createOffer(sku, listing) {
    const offer = {
      sku: sku,
      marketplaceId: this.marketplaceId,
      format: 'FIXED_PRICE', // Buy It Now
      availableQuantity: 1,
      categoryId: await this.suggestCategoryId(listing),
      listingDescription: this.buildDescription(listing),

      // Fulfillment, payment, return policies
      listingPolicies: {
        fulfillmentPolicyId: await this.getOrCreateFulfillmentPolicy(),
        paymentPolicyId: await this.getOrCreatePaymentPolicy(),
        returnPolicyId: await this.getOrCreateReturnPolicy()
      },

      // Pricing
      pricingSummary: {
        price: {
          value: listing.price.toString(),
          currency: 'GBP'
        }
      },

      // Tax (UK has automatic tax)
      tax: {
        applyTax: false
      },

      // Optional: Store category
      storeCategoryNames: listing.category ? [listing.category] : undefined
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/sell/inventory/v1/offer`,
        offer,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'en-GB'
          }
        }
      );

      const offerId = response.data.offerId;
      console.log('✓ eBay offer created:', offerId);
      return offerId;
    } catch (error) {
      console.error('eBay offer creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create offer: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Step 3: Publish Offer (make live)
   * @param {string} offerId - Offer ID
   * @returns {Promise<Object>} Listing details with eBay item ID
   */
  async publishOffer(offerId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const listingId = response.data.listingId;
      const itemId = listingId; // listingId is the eBay item ID

      const url = `https://www.ebay.co.uk/itm/${listingId}`;

      console.log('✓ eBay listing published:', listingId);

      return {
        listingId,
        itemId,
        url,
        offerId
      };
    } catch (error) {
      console.error('eBay offer publish error:', error.response?.data || error.message);
      throw new Error(`Failed to publish offer: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Complete flow: Create item, offer, and publish
   * @param {Object} listing - Complete listing data
   * @returns {Promise<Object>} Published listing details
   */
  async createAndPublishListing(listing) {
    try {
      // Generate unique SKU
      const sku = `QL-${listing.id}-${Date.now()}`;

      // Step 1: Create inventory item
      await this.createInventoryItem(listing, sku);

      // Step 2: Create offer
      const offerId = await this.createOffer(sku, listing);

      // Step 3: Publish
      const published = await this.publishOffer(offerId);

      return {
        success: true,
        ...published,
        sku
      };
    } catch (error) {
      console.error('eBay listing creation failed:', error);
      throw error;
    }
  }

  /**
   * Get item analytics (views, watchers, etc.)
   * @param {string} itemId - eBay item ID
   * @returns {Promise<Object>} Analytics data
   */
  async getItemAnalytics(itemId) {
    try {
      // Use Traffic Report API for views/impressions
      const response = await axios.get(
        `${this.baseUrl}/sell/analytics/v1/traffic_report`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          params: {
            filter: `listingIds:{${itemId}}`
          }
        }
      );

      const record = response.data.records?.[0];

      return {
        viewCount: record?.transaction?.viewCount || 0,
        watcherCount: record?.transaction?.watchCount || 0,
        clickThroughRate: record?.transaction?.clickThroughRate || 0,
        impressionCount: record?.transaction?.impressionCount || 0
      };
    } catch (error) {
      console.error('Failed to fetch eBay analytics:', error.response?.data || error.message);
      return {
        viewCount: 0,
        watcherCount: 0,
        clickThroughRate: 0,
        impressionCount: 0
      };
    }
  }

  /**
   * Update listing price
   * @param {string} offerId - Offer ID
   * @param {number} newPrice - New price
   */
  async updatePrice(offerId, newPrice) {
    try {
      await axios.put(
        `${this.baseUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/update_price`,
        {
          offers: [{
            offerId,
            price: {
              value: newPrice.toString(),
              currency: 'GBP'
            }
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✓ eBay price updated:', offerId, newPrice);
    } catch (error) {
      console.error('eBay price update error:', error.response?.data || error.message);
      throw new Error('Failed to update price');
    }
  }

  /**
   * End (delist) listing
   * @param {string} offerId - Offer ID
   */
  async endListing(offerId) {
    try {
      await axios.post(
        `${this.baseUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✓ eBay listing ended:', offerId);
    } catch (error) {
      console.error('eBay listing end error:', error.response?.data || error.message);
      throw new Error('Failed to end listing');
    }
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  /**
   * Map QuickList condition to eBay condition enum
   */
  mapCondition(condition) {
    const mapping = {
      'New': 'NEW_WITH_TAGS',
      'Like New': 'NEW_WITHOUT_TAGS',
      'Excellent': 'VERY_GOOD',
      'Very Good': 'GOOD',
      'Good': 'GOOD',
      'Fair': 'ACCEPTABLE',
      'Poor': 'FOR_PARTS_OR_NOT_WORKING'
    };
    return mapping[condition] || 'VERY_GOOD';
  }

  /**
   * Build eBay description from listing
   */
  buildDescription(listing) {
    const parts = [
      listing.description,
      '',
      'ITEM SPECIFICS:',
      `• Brand: ${listing.brand}`,
      `• Condition: ${listing.condition}`,
      `• Category: ${listing.category}`
    ];

    if (listing.size) parts.push(`• Size: ${listing.size}`);
    if (listing.color) parts.push(`• Color: ${listing.color}`);
    if (listing.material) parts.push(`• Material: ${listing.material}`);
    if (listing.rrp) parts.push(`• RRP: £${listing.rrp}`);

    if (listing.keywords && listing.keywords.length > 0) {
      parts.push('');
      parts.push(listing.keywords.map(k => '#' + k).join(' '));
    }

    return parts.join('\n');
  }

  /**
   * Build eBay aspects (item specifics)
   */
  buildAspects(listing) {
    const aspects = {};

    if (listing.brand) aspects.Brand = [listing.brand];
    if (listing.size) aspects.Size = [listing.size];
    if (listing.color) aspects.Colour = [listing.color]; // UK spelling
    if (listing.material) aspects.Material = [listing.material];
    if (listing.style) aspects.Style = [listing.style];

    // Add product type based on category
    if (listing.category) {
      aspects.Type = [listing.category];
    }

    return aspects;
  }

  /**
   * Get image URLs from listing
   */
  getImageUrls(images) {
    if (!images || images.length === 0) {
      return [];
    }

    // eBay allows max 12 images
    return images.slice(0, 12).map(img => {
      // Prefer Cloudinary URLs (already optimized)
      if (img.cloudinaryUrl || img.cloudinary_url) {
        return img.cloudinaryUrl || img.cloudinary_url;
      }
      return img.url || img.image_url;
    }).filter(Boolean);
  }

  /**
   * Suggest eBay category ID
   */
  async suggestCategoryId(listing) {
    // Simplified mapping - in production, use eBay's Category API
    const categoryMapping = {
      'sneakers': '15709',
      'trainers': '15709',
      'shoes': '11450',
      'clothing': '11450',
      'apparel': '11450',
      'jacket': '57988',
      'coat': '57988',
      'dress': '63861',
      'electronics': '293',
      'tech': '293',
      'phone': '9355',
      'laptop': '31530',
      'home': '11700',
      'furniture': '3197',
      'toys': '220',
      'books': '267',
      'collectibles': '1'
    };

    const category = (listing.category || '').toLowerCase();

    // Find first matching keyword
    for (const [keyword, categoryId] of Object.entries(categoryMapping)) {
      if (category.includes(keyword)) {
        return categoryId;
      }
    }

    // Default to Clothing, Shoes & Accessories
    return '11450';
  }

  /**
   * Get or create fulfillment policy (shipping)
   */
  async getOrCreateFulfillmentPolicy() {
    try {
      // Try to get existing policies
      const response = await axios.get(
        `${this.baseUrl}/sell/account/v1/fulfillment_policy`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          params: {
            marketplace_id: this.marketplaceId
          }
        }
      );

      if (response.data.fulfillmentPolicies && response.data.fulfillmentPolicies.length > 0) {
        return response.data.fulfillmentPolicies[0].fulfillmentPolicyId;
      }

      // Create default policy if none exists
      return await this.createDefaultFulfillmentPolicy();
    } catch (error) {
      console.error('Error fetching fulfillment policy:', error.response?.data || error.message);
      throw new Error('Failed to get fulfillment policy');
    }
  }

  /**
   * Create default fulfillment policy
   */
  async createDefaultFulfillmentPolicy() {
    const policy = {
      name: 'QuickList Standard Shipping',
      marketplaceId: this.marketplaceId,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      handlingTime: {
        value: 2,
        unit: 'DAY'
      },
      shippingOptions: [
        {
          optionType: 'DOMESTIC',
          costType: 'FLAT_RATE',
          shippingServices: [
            {
              serviceName: 'Royal Mail 2nd Class',
              sortOrder: 1,
              shippingCost: {
                value: '3.99',
                currency: 'GBP'
              }
            }
          ]
        }
      ]
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/sell/account/v1/fulfillment_policy`,
        policy,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.fulfillmentPolicyId;
    } catch (error) {
      console.error('Error creating fulfillment policy:', error.response?.data || error.message);
      throw new Error('Failed to create fulfillment policy');
    }
  }

  /**
   * Get or create payment policy
   */
  async getOrCreatePaymentPolicy() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/sell/account/v1/payment_policy`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          params: {
            marketplace_id: this.marketplaceId
          }
        }
      );

      if (response.data.paymentPolicies && response.data.paymentPolicies.length > 0) {
        return response.data.paymentPolicies[0].paymentPolicyId;
      }

      return await this.createDefaultPaymentPolicy();
    } catch (error) {
      console.error('Error fetching payment policy:', error.response?.data || error.message);
      throw new Error('Failed to get payment policy');
    }
  }

  /**
   * Create default payment policy
   */
  async createDefaultPaymentPolicy() {
    const policy = {
      name: 'QuickList Standard Payment',
      marketplaceId: this.marketplaceId,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      paymentMethods: [
        { paymentMethodType: 'PAYPAL' },
        { paymentMethodType: 'CREDIT_CARD' }
      ],
      immediatePay: false
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/sell/account/v1/payment_policy`,
        policy,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.paymentPolicyId;
    } catch (error) {
      console.error('Error creating payment policy:', error.response?.data || error.message);
      throw new Error('Failed to create payment policy');
    }
  }

  /**
   * Get or create return policy
   */
  async getOrCreateReturnPolicy() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/sell/account/v1/return_policy`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          params: {
            marketplace_id: this.marketplaceId
          }
        }
      );

      if (response.data.returnPolicies && response.data.returnPolicies.length > 0) {
        return response.data.returnPolicies[0].returnPolicyId;
      }

      return await this.createDefaultReturnPolicy();
    } catch (error) {
      console.error('Error fetching return policy:', error.response?.data || error.message);
      throw new Error('Failed to get return policy');
    }
  }

  /**
   * Create default return policy
   */
  async createDefaultReturnPolicy() {
    const policy = {
      name: 'QuickList Standard Returns',
      marketplaceId: this.marketplaceId,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      returnsAccepted: true,
      returnPeriod: {
        value: 30,
        unit: 'DAY'
      },
      refundMethod: 'MONEY_BACK',
      returnShippingCostPayer: 'BUYER'
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/sell/account/v1/return_policy`,
        policy,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.returnPolicyId;
    } catch (error) {
      console.error('Error creating return policy:', error.response?.data || error.message);
      throw new Error('Failed to create return policy');
    }
  }
}

module.exports = EbayInventory;
