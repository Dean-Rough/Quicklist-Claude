class EbayInventory {
  constructor(_accessToken, _isSandbox) {
    this.accessToken = _accessToken;
    this.isSandbox = _isSandbox;
  }

  async createAndPublishListing() {
    throw new Error('eBay inventory not configured');
  }

  async getItemAnalytics() {
    return { viewCount: 0, watcherCount: 0 };
  }
}

module.exports = EbayInventory;
