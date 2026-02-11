const notConfiguredError = () => new Error('eBay integration not configured');

module.exports = {
  async getAuthorizationUrl() {
    throw notConfiguredError();
  },
  async verifyState() {
    return false;
  },
  async getAccessToken() {
    throw notConfiguredError();
  },
  async getUserInfo() {
    return { userId: null };
  },
  async storeTokens() {
    return true;
  },
  async getConnectionStatus() {
    return { connected: false };
  },
  async disconnect() {
    return true;
  },
  async getValidToken() {
    throw notConfiguredError();
  },
};
