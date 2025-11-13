/**
 * eBay OAuth 2.0 Authentication
 *
 * Handles eBay user authorization and token management
 * Implements OAuth 2.0 Authorization Code grant flow
 *
 * References:
 * - https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
 * - https://developer.ebay.com/api-docs/static/oauth-tokens.html
 */

const axios = require('axios');
const crypto = require('crypto');
const pool = require('../db');

class EbayAuth {
  constructor() {
    this.clientId = process.env.EBAY_APP_ID;
    this.clientSecret = process.env.EBAY_CERT_ID;
    this.redirectUri = process.env.EBAY_REDIRECT_URI || 'https://quicklist.it.com/auth/ebay/callback';
    this.ruName = process.env.EBAY_RU_NAME; // RuName (Redirect URL Name) from eBay App settings

    // Use sandbox or production based on environment
    this.isSandbox = process.env.EBAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';

    this.baseUrl = this.isSandbox
      ? 'https://auth.sandbox.ebay.com/oauth2'
      : 'https://auth.ebay.com/oauth2';

    // eBay scopes we need
    this.scopes = [
      'https://api.ebay.com/oauth/api_scope', // Basic API access
      'https://api.ebay.com/oauth/api_scope/sell.inventory', // Inventory management
      'https://api.ebay.com/oauth/api_scope/sell.marketing', // Marketing/promotions
      'https://api.ebay.com/oauth/api_scope/sell.account', // Account management
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment', // Order fulfillment
      'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly' // Analytics
    ];
  }

  /**
   * Step 1: Generate authorization URL for user consent
   * @param {number} userId - User ID to track the authorization
   * @returns {string} Authorization URL to redirect user to
   */
  async getAuthorizationUrl(userId) {
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in database with expiration (10 minutes)
    await this.saveState(userId, state);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state,
      scope: this.scopes.join(' ')
    });

    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  /**
   * Step 2: Exchange authorization code for access token
   * @param {string} code - Authorization code from eBay callback
   * @returns {Object} Token data with accessToken, refreshToken, expiresIn
   */
  async getAccessToken(code) {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };
    } catch (error) {
      console.error('eBay token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  /**
   * Step 3: Refresh expired access token
   * @param {string} refreshToken - Refresh token from database
   * @returns {Object} New token data with accessToken, expiresIn
   */
  async refreshAccessToken(refreshToken) {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: this.scopes.join(' ')
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('eBay token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get a valid access token for a user (auto-refresh if needed)
   * @param {number} userId - User ID
   * @returns {string} Valid access token
   */
  async getValidToken(userId) {
    try {
      const result = await pool.query(`
        SELECT access_token, refresh_token, expires_at
        FROM ebay_tokens
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error('eBay not connected. Please authorize first.');
      }

      const token = result.rows[0];

      // Check if expired (with 5-minute buffer)
      const expiresAt = new Date(token.expires_at);
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minutes

      if (expiresAt.getTime() < now.getTime() + bufferMs) {
        console.log('eBay token expired, refreshing...');

        // Refresh token
        const newTokens = await this.refreshAccessToken(token.refresh_token);

        // Calculate new expiry time
        const newExpiresAt = new Date(now.getTime() + (newTokens.expiresIn * 1000));

        // Update database
        await pool.query(`
          UPDATE ebay_tokens
          SET access_token = $1,
              expires_at = $2,
              updated_at = NOW(),
              last_used_at = NOW()
          WHERE user_id = $3
        `, [newTokens.accessToken, newExpiresAt, userId]);

        console.log('eBay token refreshed successfully');
        return newTokens.accessToken;
      }

      // Update last used timestamp
      await pool.query(`
        UPDATE ebay_tokens
        SET last_used_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      return token.access_token;
    } catch (error) {
      console.error('Error getting valid eBay token:', error);
      throw error;
    }
  }

  /**
   * Store tokens in database
   * @param {number} userId - User ID
   * @param {Object} tokens - Token data from OAuth flow
   * @param {string} ebayUserId - eBay user ID (optional)
   */
  async storeTokens(userId, tokens, ebayUserId = null) {
    const expiresAt = new Date(Date.now() + (tokens.expiresIn * 1000));

    try {
      await pool.query(`
        INSERT INTO ebay_tokens (
          user_id,
          access_token,
          refresh_token,
          token_type,
          expires_at,
          ebay_user_id,
          scope
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_type = EXCLUDED.token_type,
          expires_at = EXCLUDED.expires_at,
          ebay_user_id = COALESCE(EXCLUDED.ebay_user_id, ebay_tokens.ebay_user_id),
          scope = EXCLUDED.scope,
          updated_at = NOW()
      `, [
        userId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.tokenType || 'Bearer',
        expiresAt,
        ebayUserId,
        this.scopes.join(' ')
      ]);

      console.log('eBay tokens stored successfully for user:', userId);
    } catch (error) {
      console.error('Error storing eBay tokens:', error);
      throw new Error('Failed to store eBay tokens');
    }
  }

  /**
   * Check if user has connected eBay account
   * @param {number} userId - User ID
   * @returns {Object} Connection status and details
   */
  async getConnectionStatus(userId) {
    try {
      const result = await pool.query(`
        SELECT
          expires_at,
          ebay_user_id,
          last_used_at,
          created_at
        FROM ebay_tokens
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return {
          connected: false,
          expired: null,
          expiresAt: null,
          ebayUserId: null,
          lastUsed: null,
          connectedSince: null
        };
      }

      const token = result.rows[0];
      const expiresAt = new Date(token.expires_at);
      const isExpired = expiresAt < new Date();

      return {
        connected: true,
        expired: isExpired,
        expiresAt: expiresAt.toISOString(),
        ebayUserId: token.ebay_user_id,
        lastUsed: token.last_used_at ? new Date(token.last_used_at).toISOString() : null,
        connectedSince: new Date(token.created_at).toISOString()
      };
    } catch (error) {
      console.error('Error checking eBay connection status:', error);
      throw error;
    }
  }

  /**
   * Disconnect eBay account
   * @param {number} userId - User ID
   */
  async disconnect(userId) {
    try {
      await pool.query(`
        DELETE FROM ebay_tokens
        WHERE user_id = $1
      `, [userId]);

      console.log('eBay account disconnected for user:', userId);
    } catch (error) {
      console.error('Error disconnecting eBay account:', error);
      throw error;
    }
  }

  /**
   * Save OAuth state for CSRF protection
   * @param {number} userId - User ID
   * @param {string} state - Random state string
   */
  async saveState(userId, state) {
    const expiresAt = new Date(Date.now() + (10 * 60 * 1000)); // 10 minutes

    try {
      // Store in database (could also use Redis for better performance)
      await pool.query(`
        INSERT INTO oauth_states (user_id, state, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
        SET state = EXCLUDED.state,
            expires_at = EXCLUDED.expires_at,
            created_at = NOW()
      `, [userId, state, expiresAt]);
    } catch (error) {
      // If table doesn't exist, create it
      if (error.code === '42P01') {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS oauth_states (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            state VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Retry insert
        await pool.query(`
          INSERT INTO oauth_states (user_id, state, expires_at)
          VALUES ($1, $2, $3)
        `, [userId, state, expiresAt]);
      } else {
        throw error;
      }
    }
  }

  /**
   * Verify OAuth state matches (CSRF protection)
   * @param {number} userId - User ID
   * @param {string} state - State from callback
   * @returns {boolean} True if valid
   */
  async verifyState(userId, state) {
    try {
      const result = await pool.query(`
        SELECT state, expires_at
        FROM oauth_states
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const stored = result.rows[0];

      // Check expiration
      if (new Date(stored.expires_at) < new Date()) {
        console.warn('OAuth state expired');
        return false;
      }

      // Check state matches
      if (stored.state !== state) {
        console.warn('OAuth state mismatch');
        return false;
      }

      // Delete used state
      await pool.query(`
        DELETE FROM oauth_states
        WHERE user_id = $1
      `, [userId]);

      return true;
    } catch (error) {
      console.error('Error verifying OAuth state:', error);
      return false;
    }
  }

  /**
   * Get user information from eBay
   * @param {string} accessToken - Valid access token
   * @returns {Object} User information
   */
  async getUserInfo(accessToken) {
    const apiUrl = this.isSandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    try {
      const response = await axios.get(
        `${apiUrl}/commerce/identity/v1/user/`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        userId: response.data.userId,
        username: response.data.username,
        email: response.data.email
      };
    } catch (error) {
      console.error('Error fetching eBay user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch eBay user information');
    }
  }
}

// Export singleton instance
module.exports = new EbayAuth();
