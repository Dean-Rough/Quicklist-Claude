/**
 * Platform Selector Modal Component
 *
 * Allows users to select which platforms to post their listing to
 * Shows after listing generation (not before)
 * Supports:
 * - eBay (Direct API posting)
 * - Vinted (Smart Clipboard)
 * - Depop (Smart Clipboard)
 * - Facebook Marketplace (Smart Clipboard)
 */

class PlatformSelector {
  constructor(listingId, listing) {
    this.listingId = listingId;
    this.listing = listing;
    this.selectedPlatforms = new Set();
    this.variations = null;
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate unique session ID for analytics tracking
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Show the platform selector modal
   */
  async show() {
    try {
      // Show loading state
      this.showLoadingModal();

      // Fetch platform variations from API
      const response = await fetch(`/api/listings/${this.listingId}/platform-variations`, {
        headers: {
          Authorization: `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch platform variations');
      }

      this.variations = await response.json();

      // Show modal
      this.render();
    } catch (error) {
      console.error('Platform selector error:', error);
      this.showError(error.message);
    }
  }

  /**
   * Show loading modal while fetching variations
   */
  showLoadingModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'platformSelectorModal';
    modal.innerHTML = `
      <div class="modal platform-selector-modal">
        <div class="modal-body">
          <div class="loading-spinner"></div>
          <p class="loading-text">Optimizing for all platforms...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Render the platform selector modal
   */
  render() {
    // Remove loading modal
    const existingModal = document.getElementById('platformSelectorModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'platformSelectorModal';
    modal.innerHTML = `
      <div class="modal platform-selector-modal">
        <div class="modal-header">
          <h2>📱 Post to Platforms</h2>
          <button class="modal-close" data-action="close">✕</button>
        </div>

        <div class="modal-body">
          <p class="selector-hint">
            Select where you want to post this listing:
          </p>

          <div class="platform-options">
            ${this.renderPlatformOption('ebay')}
            ${this.renderPlatformOption('vinted')}
            ${this.renderPlatformOption('depop')}
            ${this.renderPlatformOption('facebook')}
          </div>

          <div class="platform-info-box">
            <div class="info-icon">ℹ️</div>
            <div class="info-text">
              <strong>eBay:</strong> Posts automatically via API<br>
              <strong>Others:</strong> Copy formatted text and paste in app
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" data-action="close">
            Cancel
          </button>
          <button class="btn-primary" id="postSelectedBtn" disabled>
            Post to Selected (0)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render individual platform option
   */
  renderPlatformOption(platform) {
    // const variation = this.variations[platform]; // Reserved for future use

    const platformData = {
      ebay: {
        icon: '🏷️',
        color: '#E53238',
        name: 'eBay',
        method: 'Direct API Post',
        description: 'Posts automatically',
      },
      vinted: {
        icon: '👕',
        color: '#09B1BA',
        name: 'Vinted',
        method: 'Copy & Open App',
        description: 'Paste in Vinted app',
      },
      depop: {
        icon: '✨',
        color: '#FF2E2E',
        name: 'Depop',
        method: 'Copy & Open App',
        description: 'Paste in Depop app',
      },
      facebook: {
        icon: '👤',
        color: '#1877F2',
        name: 'Facebook',
        method: 'Copy & Open App',
        description: 'Paste in Marketplace',
      },
    };

    const data = platformData[platform];

    return `
      <div class="platform-option" data-platform="${platform}">
        <div class="platform-icon" style="background-color: ${data.color}">
          <span>${data.icon}</span>
        </div>
        <div class="platform-info">
          <div class="platform-name">${data.name}</div>
          <div class="platform-method">${data.method}</div>
          <div class="platform-description">${data.description}</div>
        </div>
        <button class="platform-preview-btn" data-action="preview" data-platform="${platform}">
          👁️ Preview
        </button>
        <div class="platform-checkbox">
          <input type="checkbox" id="platform-${platform}" data-platform="${platform}">
          <label for="platform-${platform}"></label>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    const modal = document.getElementById('platformSelectorModal');

    // Close buttons
    modal.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    // Click outside modal to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    // Platform option clicks (toggle checkbox)
    modal.querySelectorAll('.platform-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        // Don't toggle if clicking preview button or checkbox itself
        if (e.target.closest('.platform-preview-btn') || e.target.closest('.platform-checkbox')) {
          return;
        }

        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        this.togglePlatform(option, checkbox.checked);
      });
    });

    // Checkbox changes
    modal.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const option = e.target.closest('.platform-option');
        this.togglePlatform(option, e.target.checked);
      });
    });

    // Preview buttons
    modal.querySelectorAll('[data-action="preview"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const platform = btn.dataset.platform;
        this.showPreview(platform);
      });
    });

    // Post button
    const postBtn = modal.querySelector('#postSelectedBtn');
    postBtn.addEventListener('click', () => this.postToSelected());
  }

  /**
   * Toggle platform selection
   */
  togglePlatform(option, isSelected) {
    const platform = option.dataset.platform;

    if (isSelected) {
      this.selectedPlatforms.add(platform);
      option.classList.add('selected');
    } else {
      this.selectedPlatforms.delete(platform);
      option.classList.remove('selected');
    }

    // Update post button
    const postBtn = document.querySelector('#postSelectedBtn');
    postBtn.disabled = this.selectedPlatforms.size === 0;
    postBtn.textContent = `Post to Selected (${this.selectedPlatforms.size})`;

    // Add visual feedback
    if (isSelected) {
      option.style.animation = 'platform-select 0.3s ease';
    }
  }

  /**
   * Show preview modal for platform
   */
  showPreview(platform) {
    const variation = this.variations[platform];
    const platformData = {
      ebay: { name: 'eBay', color: '#E53238', icon: '🏷️' },
      vinted: { name: 'Vinted', color: '#09B1BA', icon: '👕' },
      depop: { name: 'Depop', color: '#FF2E2E', icon: '✨' },
      facebook: { name: 'Facebook', color: '#1877F2', icon: '👤' },
    };

    const data = platformData[platform];
    const textToShow = variation.clipboardText || variation.description;

    const previewModal = document.createElement('div');
    previewModal.className = 'modal-overlay active';
    previewModal.id = 'platformPreviewModal';
    previewModal.innerHTML = `
      <div class="modal preview-modal">
        <div class="modal-header" style="background-color: ${data.color}; color: white;">
          <h2>${data.icon} ${data.name} Preview</h2>
          <button class="modal-close" style="color: white;">✕</button>
        </div>

        <div class="modal-body">
          <div class="preview-content">
            <h3 class="preview-title">${variation.title}</h3>
            <pre class="preview-description">${textToShow}</pre>
          </div>

          ${
            variation.itemSpecifics
              ? `
            <div class="preview-specifics">
              <h4>Platform-Specific Details:</h4>
              <pre>${JSON.stringify(variation.itemSpecifics, null, 2)}</pre>
            </div>
          `
              : ''
          }
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" data-action="close-preview">
            Close
          </button>
          <button class="btn-primary" data-action="select-from-preview">
            ${this.selectedPlatforms.has(platform) ? '✓ Selected' : 'Select This Platform'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(previewModal);

    // Event listeners
    previewModal.querySelector('[data-action="close-preview"]').addEventListener('click', () => {
      previewModal.remove();
    });

    previewModal.querySelector('.modal-close').addEventListener('click', () => {
      previewModal.remove();
    });

    previewModal
      .querySelector('[data-action="select-from-preview"]')
      .addEventListener('click', () => {
        // Toggle platform selection
        const mainModal = document.getElementById('platformSelectorModal');
        const checkbox = mainModal.querySelector(`input[data-platform="${platform}"]`);
        const option = checkbox.closest('.platform-option');

        checkbox.checked = !checkbox.checked;
        this.togglePlatform(option, checkbox.checked);

        previewModal.remove();
      });

    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        previewModal.remove();
      }
    });
  }

  /**
   * Post to all selected platforms
   */
  async postToSelected() {
    if (this.selectedPlatforms.size === 0) return;

    const platforms = Array.from(this.selectedPlatforms);
    const postBtn = document.querySelector('#postSelectedBtn');

    // Disable button and show loading
    postBtn.disabled = true;
    postBtn.innerHTML = '<span class="spinner-small"></span> Posting...';

    let successCount = 0;
    let errorCount = 0;

    for (const platform of platforms) {
      try {
        if (platform === 'ebay') {
          await this.postToEbay();
          successCount++;
        } else {
          await this.copyAndOpen(platform);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to post to ${platform}:`, error);
        errorCount++;
      }
    }

    // Show summary
    if (errorCount === 0) {
      this.showSuccess(`Posted to ${successCount} platform${successCount > 1 ? 's' : ''}!`);
    } else {
      this.showWarning(
        `Posted to ${successCount} platform${successCount > 1 ? 's' : ''}, ${errorCount} failed`
      );
    }

    // Close modal after delay
    setTimeout(() => {
      this.close();

      // Refresh listings if app is available
      if (window.app && typeof window.app.refreshListings === 'function') {
        window.app.refreshListings();
      }
    }, 1500);
  }

  /**
   * Post to eBay via Direct API
   */
  async postToEbay() {
    try {
      const response = await fetch('/api/ebay/post-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          listingId: this.listingId,
          variation: this.variations.ebay,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post to eBay');
      }

      const result = await response.json();

      // Update platform status
      await this.updatePlatformStatus('ebay', 'posted', result.itemId, result.url);

      // Track analytics
      await this.trackClipboardAction('ebay', 'post_confirmed', true);

      return result;
    } catch (error) {
      await this.trackClipboardAction('ebay', 'error', false, error.message);
      throw error;
    }
  }

  /**
   * Copy formatted text and open platform app/website
   */
  async copyAndOpen(platform) {
    const variation = this.variations[platform];
    const textToCopy = variation.clipboardText;

    // Copy to clipboard
    // eslint-disable-next-line no-undef
    const clipboard = new SmartClipboard();
    const copySuccess = await clipboard.copy(textToCopy, platform);

    if (!copySuccess) {
      throw new Error('Failed to copy to clipboard');
    }

    // Track copy action
    await this.trackClipboardAction(platform, 'copy', true);

    // Show instructions modal
    this.showCopyInstructions(platform);
  }

  /**
   * Show copy instructions modal
   */
  showCopyInstructions(platform) {
    const urls = {
      vinted: 'https://www.vinted.co.uk/items/new',
      depop: 'https://www.depop.com/sell/',
      facebook: 'https://www.facebook.com/marketplace/create/item',
    };

    const platformData = {
      vinted: { name: 'Vinted', color: '#09B1BA', icon: '👕' },
      depop: { name: 'Depop', color: '#FF2E2E', icon: '✨' },
      facebook: { name: 'Facebook Marketplace', color: '#1877F2', icon: '👤' },
    };

    const data = platformData[platform];
    const url = urls[platform];

    const instructionModal = document.createElement('div');
    instructionModal.className = 'modal-overlay active';
    instructionModal.id = 'copyInstructionsModal';
    instructionModal.innerHTML = `
      <div class="modal instruction-modal">
        <div class="modal-header" style="background-color: ${data.color}; color: white;">
          <h2>✓ Copied to Clipboard!</h2>
        </div>

        <div class="modal-body">
          <div class="success-icon">📋✓</div>

          <div class="instruction-content">
            <div class="instruction-step">
              <span class="step-number">1</span>
              <span class="step-text">Tap "Open ${data.name}" below</span>
            </div>
            <div class="instruction-step">
              <span class="step-number">2</span>
              <span class="step-text">Start creating a new listing</span>
            </div>
            <div class="instruction-step">
              <span class="step-number">3</span>
              <span class="step-text"><strong>Long-press</strong> the description field</span>
            </div>
            <div class="instruction-step">
              <span class="step-number">4</span>
              <span class="step-text">Tap "Paste" - your listing fills in!</span>
            </div>
            <div class="instruction-step">
              <span class="step-number">5</span>
              <span class="step-text">Add photos and submit</span>
            </div>
          </div>

          <div class="tip-box">
            💡 <strong>Tip:</strong> Your listing text is already copied. Just long-press and paste!
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" data-action="close-instructions">
            Cancel
          </button>
          <button class="btn-primary" data-action="open-platform" style="background-color: ${data.color}">
            ${data.icon} Open ${data.name}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(instructionModal);

    // Event listeners
    instructionModal
      .querySelector('[data-action="close-instructions"]')
      .addEventListener('click', () => {
        instructionModal.remove();
      });

    instructionModal
      .querySelector('[data-action="open-platform"]')
      .addEventListener('click', async () => {
        // Open platform URL
        window.open(url, '_blank');

        // Track action
        await this.trackClipboardAction(platform, 'open_platform', true);

        // Update status to draft (user will post manually)
        await this.updatePlatformStatus(platform, 'draft', null, url);

        instructionModal.remove();
      });

    instructionModal.addEventListener('click', (e) => {
      if (e.target === instructionModal) {
        instructionModal.remove();
      }
    });
  }

  /**
   * Update platform status in database
   */
  async updatePlatformStatus(platform, status, platformListingId = null, platformUrl = null) {
    try {
      await fetch(`/api/listings/${this.listingId}/platform-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          platform,
          status,
          platformListingId,
          platformUrl,
        }),
      });
    } catch (error) {
      console.error('Failed to update platform status:', error);
    }
  }

  /**
   * Track clipboard action in analytics
   */
  async trackClipboardAction(platform, action, success, errorMessage = null) {
    try {
      await fetch('/api/analytics/clipboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          listingId: this.listingId,
          platform,
          action,
          success,
          errorMessage,
          sessionId: this.sessionId,
        }),
      });
    } catch (error) {
      console.error('Failed to track clipboard action:', error);
    }
  }

  /**
   * Close modal
   */
  close() {
    const modal = document.getElementById('platformSelectorModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show warning message
   */
  showWarning(message) {
    this.showToast(message, 'warning');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, 'error');
    this.close();
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(message, type);
    } else {
      alert(message);
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PlatformSelector = PlatformSelector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlatformSelector;
}
