/**
 * Smart Clipboard Utility
 *
 * Cross-browser clipboard functionality with fallbacks
 * Supports:
 * - Modern Clipboard API (Chrome, Firefox, Safari 13.1+)
 * - Legacy execCommand fallback (older browsers)
 * - iOS Safari workarounds
 * - Android Chrome workarounds
 */

class SmartClipboard {
  constructor() {
    this.supportsClipboardAPI = this.detectClipboardSupport();
  }

  /**
   * Detect if browser supports modern Clipboard API
   */
  detectClipboardSupport() {
    return !!(
      navigator.clipboard &&
      navigator.clipboard.writeText &&
      typeof navigator.clipboard.writeText === 'function'
    );
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @param {string} platform - Platform name for logging
   * @returns {Promise<boolean>} Success status
   */
  async copy(text, platform = 'unknown') {
    try {
      if (this.supportsClipboardAPI) {
        return await this.copyModern(text, platform);
      } else {
        return this.copyLegacy(text, platform);
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);

      // Try fallback method
      try {
        return this.copyLegacy(text, platform);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Copy using modern Clipboard API
   */
  async copyModern(text, platform) {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`✓ Copied ${text.length} chars for ${platform} using Clipboard API`);
      return true;
    } catch (error) {
      // Handle permission denied or other errors
      if (error.name === 'NotAllowedError') {
        console.warn('Clipboard permission denied, trying fallback');
        throw error; // Let main copy() method try fallback
      }
      throw error;
    }
  }

  /**
   * Copy using legacy execCommand (fallback)
   */
  copyLegacy(text, platform) {
    try {
      const textarea = document.createElement('textarea');

      // Style to make invisible but functional
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';

      // iOS-specific fixes
      textarea.contentEditable = true;
      textarea.readOnly = false;

      document.body.appendChild(textarea);

      // Select text - iOS requires specific selection method
      if (this.isIOS()) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.focus();
        textarea.select();
      }

      // Copy command
      const success = document.execCommand('copy');

      // Cleanup
      document.body.removeChild(textarea);

      if (success) {
        console.log(`✓ Copied ${text.length} chars for ${platform} using execCommand`);
        return true;
      } else {
        console.error('execCommand copy returned false');
        return false;
      }
    } catch (error) {
      console.error('Legacy copy failed:', error);
      return false;
    }
  }

  /**
   * Read text from clipboard
   * @returns {Promise<string|null>} Clipboard text or null
   */
  async read() {
    if (!this.supportsClipboardAPI) {
      console.warn('Clipboard read not supported in this browser');
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (error) {
      console.error('Cannot read clipboard:', error);
      return null;
    }
  }

  /**
   * Check if clipboard API is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.supportsClipboardAPI || document.queryCommandSupported('copy');
  }

  /**
   * Detect iOS device
   */
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  /**
   * Detect Android device
   */
  isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  /**
   * Get browser info
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browser = 'Chrome';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Edg')) {
      browser = 'Edge';
    }

    return {
      browser,
      isIOS: this.isIOS(),
      isAndroid: this.isAndroid(),
      supportsClipboardAPI: this.supportsClipboardAPI,
      userAgent: ua,
    };
  }

  /**
   * Test clipboard functionality
   * @returns {Promise<Object>} Test results
   */
  async test() {
    const testText = 'QuickList AI Test';
    const results = {
      browserInfo: this.getBrowserInfo(),
      clipboardAPISupported: this.supportsClipboardAPI,
      copySuccess: false,
      readSuccess: false,
      error: null,
    };

    try {
      // Test copy
      results.copySuccess = await this.copy(testText, 'test');

      // Test read (may fail due to permissions)
      try {
        const readText = await this.read();
        results.readSuccess = readText === testText;
      } catch (readError) {
        results.readSuccess = false;
        results.readError = readError.message;
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }
}

// ============================================================================
// PLATFORM-SPECIFIC FORMATTERS
// ============================================================================

/**
 * Format listing for specific platform clipboard
 */
class PlatformClipboardFormatter {
  /**
   * Format for Vinted
   */
  static formatVinted(listing) {
    const sizeInfo = listing.size || '';
    const savings = listing.rrp
      ? Math.round(((listing.rrp - listing.price) / listing.rrp) * 100)
      : null;

    const parts = [
      listing.title + ' 🔥',
      '',
      sizeInfo ? `Size: ${sizeInfo}` : '',
      savings ? `£${listing.price} (RRP £${listing.rrp} - save ${savings}%!)` : `£${listing.price}`,
      '',
      listing.description,
      '',
      (listing.keywords || []).map((k) => '#' + k.toLowerCase()).join(' '),
    ];

    return parts.filter((p) => p !== '').join('\n');
  }

  /**
   * Format for Depop
   */
  static formatDepop(listing) {
    const casualDesc = listing.description
      .toLowerCase()
      .replace(/excellent condition/gi, 'amazing condition!!')
      .replace(/very good condition/gi, 'great condition!')
      .replace(/good condition/gi, 'good condition!')
      .replace(/\./g, '!');

    const hashtags = [...(listing.keywords || []), listing.brand, listing.category]
      .filter(Boolean)
      .map((k) => '#' + k.toLowerCase().replace(/\s+/g, ''))
      .join(' ');

    const parts = [
      listing.title.toUpperCase() + ' ✨',
      '',
      casualDesc + ' 😍',
      '',
      `condition: ${listing.condition.toLowerCase()}`,
      listing.size ? `size ${listing.size}` : '',
      '',
      `price: £${listing.price}${listing.rrp ? ` (rrp £${listing.rrp})` : ''}`,
      'grab a bargain! 💫',
      '',
      hashtags,
    ];

    return parts.filter((p) => p !== '').join('\n');
  }

  /**
   * Format for Facebook Marketplace
   */
  static formatFacebook(listing) {
    const parts = [
      listing.title,
      '',
      `💰 Price: £${listing.price}${listing.rrp ? ` (retail £${listing.rrp})` : ''}`,
      `📦 Condition: ${listing.condition}`,
      `🏷️ Brand: ${listing.brand}`,
      '',
      listing.description,
      '',
      listing.size ? `📏 Size: ${listing.size}` : '',
      listing.color ? `🎨 Color: ${listing.color}` : '',
      listing.material ? `🧵 Material: ${listing.material}` : '',
      '',
      '📍 Can meet locally or post. Message for details!',
      '',
      (listing.keywords || []).map((k) => '#' + k.toLowerCase()).join(' '),
    ];

    return parts.filter((p) => p !== '').join('\n');
  }

  /**
   * Format for eBay (though eBay uses API, this is backup)
   */
  static formatEbay(listing) {
    const parts = [
      listing.title,
      '',
      listing.description,
      '',
      'ITEM SPECIFICS:',
      `• Brand: ${listing.brand}`,
      `• Condition: ${listing.condition}`,
      `• Category: ${listing.category}`,
      listing.size ? `• Size: ${listing.size}` : '',
      listing.color ? `• Color: ${listing.color}` : '',
      listing.material ? `• Material: ${listing.material}` : '',
      '',
      (listing.keywords || []).map((k) => '#' + k).join(' '),
    ];

    return parts.filter((p) => p !== '').join('\n');
  }

  /**
   * Auto-format based on platform
   */
  static format(listing, platform) {
    switch (platform.toLowerCase()) {
      case 'vinted':
        return this.formatVinted(listing);
      case 'depop':
        return this.formatDepop(listing);
      case 'facebook':
        return this.formatFacebook(listing);
      case 'ebay':
        return this.formatEbay(listing);
      default:
        return listing.description;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export for browser
if (typeof window !== 'undefined') {
  window.SmartClipboard = SmartClipboard;
  window.PlatformClipboardFormatter = PlatformClipboardFormatter;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SmartClipboard,
    PlatformClipboardFormatter,
  };
}
