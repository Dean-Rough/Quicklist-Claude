/**
 * Listing Card Component
 *
 * Card-based UI for displaying listings with platform statuses
 * Features:
 * - Thumbnail image with platform badges
 * - Title, price, brand
 * - Platform status indicators
 * - Action buttons (Edit, Post)
 * - View/watcher counts
 */

class ListingCard {
  constructor(listing, options = {}) {
    this.listing = listing;
    this.options = {
      showActions: true,
      showPlatformStatuses: true,
      compact: false,
      ...options
    };
  }

  /**
   * Render the card element
   * @returns {HTMLElement}
   */
  async render() {
    // Fetch platform statuses if not included
    if (!this.listing.platform_statuses) {
      await this.fetchPlatformStatuses();
    }

    const card = document.createElement('div');
    card.className = `listing-card ${this.options.compact ? 'listing-card-compact' : ''}`;
    card.dataset.listingId = this.listing.id;

    card.innerHTML = `
      ${this.renderImage()}
      ${this.renderContent()}
    `;

    return card;
  }

  /**
   * Render card image section
   */
  renderImage() {
    const firstImage = this.getFirstImage();
    const platformBadges = this.renderPlatformBadges();

    return `
      <div class="card-image" style="background-image: url('${firstImage}')">
        ${platformBadges}
        ${this.renderImageCount()}
      </div>
    `;
  }

  /**
   * Get first image URL (with Cloudinary transformation)
   */
  getFirstImage() {
    if (!this.listing.images || this.listing.images.length === 0) {
      return '/assets/placeholder-image.png';
    }

    const firstImage = this.listing.images[0];

    // Use Cloudinary transformation if available
    if (firstImage.cloudinaryUrl || firstImage.cloudinary_url) {
      const url = firstImage.cloudinaryUrl || firstImage.cloudinary_url;
      return url.replace(
        '/upload/',
        '/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,e_improve,e_sharpen:100/'
      );
    }

    // Use thumbnail if available
    if (firstImage.thumbnailUrl || firstImage.thumbnail_url) {
      return firstImage.thumbnailUrl || firstImage.thumbnail_url;
    }

    // Fall back to regular URL
    return firstImage.url || firstImage.image_url || '/assets/placeholder-image.png';
  }

  /**
   * Render platform badges (for posted listings)
   */
  renderPlatformBadges() {
    const statuses = this.listing.platform_statuses || [];
    const posted = statuses.filter(s => s.status === 'posted');

    if (posted.length === 0) return '';

    return `
      <div class="platform-badges">
        ${posted.map(s => `
          <span class="badge badge-${s.platform}" title="${s.platform} - ${s.views || 0} views">
            ${this.getPlatformIcon(s.platform)}
          </span>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render image count indicator
   */
  renderImageCount() {
    const count = (this.listing.images || []).length;
    if (count <= 1) return '';

    return `
      <div class="image-count-badge">
        📷 ${count}
      </div>
    `;
  }

  /**
   * Render card content section
   */
  renderContent() {
    return `
      <div class="card-content">
        ${this.renderHeader()}
        ${this.renderMeta()}
        ${this.options.showPlatformStatuses ? this.renderPlatformStatuses() : ''}
        ${this.options.showActions ? this.renderActions() : ''}
      </div>
    `;
  }

  /**
   * Render card header (title)
   */
  renderHeader() {
    return `
      <h3 class="card-title" title="${this.escapeHtml(this.listing.title)}">
        ${this.escapeHtml(this.listing.title)}
      </h3>
    `;
  }

  /**
   * Render card metadata (price, brand, condition)
   */
  renderMeta() {
    const savings = this.listing.rrp && this.listing.rrp > this.listing.price
      ? Math.round(((this.listing.rrp - this.listing.price) / this.listing.rrp) * 100)
      : null;

    return `
      <div class="card-meta">
        <div class="card-price-group">
          <span class="card-price">£${this.listing.price}</span>
          ${this.listing.rrp ? `
            <span class="card-rrp">RRP £${this.listing.rrp}</span>
            ${savings ? `<span class="card-savings">-${savings}%</span>` : ''}
          ` : ''}
        </div>
        <div class="card-info">
          <span class="card-brand">${this.escapeHtml(this.listing.brand || 'Unknown')}</span>
          <span class="card-condition">${this.escapeHtml(this.listing.condition || 'Good')}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render platform statuses
   */
  renderPlatformStatuses() {
    const platforms = ['ebay', 'vinted', 'depop', 'facebook'];
    const statuses = this.listing.platform_statuses || [];

    return `
      <div class="card-platforms">
        ${platforms.map(platform => {
          const status = statuses.find(s => s.platform === platform);
          return this.renderPlatformStatus(platform, status);
        }).join('')}
      </div>
    `;
  }

  /**
   * Render individual platform status
   */
  renderPlatformStatus(platform, status) {
    const state = status?.status || 'draft';
    const icon = this.getPlatformIcon(platform);
    const label = this.getStatusLabel(state);
    const views = status?.view_count || status?.views || 0;
    const watchers = status?.watcher_count || status?.watchers || 0;

    return `
      <div class="platform-status platform-${platform} status-${state}"
           data-platform="${platform}"
           data-status="${state}">
        <span class="platform-icon">${icon}</span>
        <div class="platform-info">
          <span class="platform-name">${this.capitalize(platform)}</span>
          <span class="status-label status-label-${state}">${label}</span>
        </div>
        ${views > 0 || watchers > 0 ? `
          <div class="platform-stats">
            ${views > 0 ? `<span class="stat-views" title="Views">👁️ ${views}</span>` : ''}
            ${watchers > 0 ? `<span class="stat-watchers" title="Watchers">⭐ ${watchers}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render action buttons
   */
  renderActions() {
    const hasPosted = (this.listing.platform_statuses || []).some(s => s.status === 'posted');

    return `
      <div class="card-actions">
        <button class="btn-secondary btn-sm" data-action="edit" data-listing-id="${this.listing.id}">
          ✏️ Edit
        </button>
        ${hasPosted ? `
          <button class="btn-secondary btn-sm" data-action="view-posts" data-listing-id="${this.listing.id}">
            👁️ View Posts
          </button>
        ` : `
          <button class="btn-primary btn-sm" data-action="post" data-listing-id="${this.listing.id}">
            📤 Post to Platforms
          </button>
        `}
        <button class="btn-icon btn-sm" data-action="more" data-listing-id="${this.listing.id}">
          ⋯
        </button>
      </div>
    `;
  }

  /**
   * Fetch platform statuses from API
   */
  async fetchPlatformStatuses() {
    try {
      const response = await fetch(`/api/listings/${this.listing.id}/platform-status`, {
        headers: {
          'Authorization': `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        this.listing.platform_statuses = await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch platform statuses:', error);
      this.listing.platform_statuses = [];
    }
  }

  /**
   * Get platform icon emoji
   */
  getPlatformIcon(platform) {
    const icons = {
      ebay: '🏷️',
      vinted: '👕',
      depop: '✨',
      facebook: '👤'
    };
    return icons[platform] || '📱';
  }

  /**
   * Get status label text
   */
  getStatusLabel(status) {
    const labels = {
      draft: 'Not Posted',
      posted: 'Live',
      sold: 'Sold',
      delisted: 'Delisted'
    };
    return labels[status] || 'Unknown';
  }

  /**
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach event listeners to card
   */
  attachEventListeners(card) {
    // Edit button
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleEdit();
      });
    }

    // Post button
    const postBtn = card.querySelector('[data-action="post"]');
    if (postBtn) {
      postBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlePost();
      });
    }

    // View posts button
    const viewBtn = card.querySelector('[data-action="view-posts"]');
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleViewPosts();
      });
    }

    // More button
    const moreBtn = card.querySelector('[data-action="more"]');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleMore(e);
      });
    }

    // Card click (view details)
    card.addEventListener('click', () => {
      this.handleCardClick();
    });

    // Platform status clicks
    card.querySelectorAll('.platform-status').forEach(status => {
      status.addEventListener('click', (e) => {
        e.stopPropagation();
        const platform = status.dataset.platform;
        const state = status.dataset.status;
        this.handlePlatformClick(platform, state);
      });
    });
  }

  /**
   * Handle edit button click
   */
  handleEdit() {
    if (window.app && typeof window.app.editListing === 'function') {
      window.app.editListing(this.listing.id);
    } else {
      console.log('Edit listing:', this.listing.id);
    }
  }

  /**
   * Handle post button click
   */
  handlePost() {
    // eslint-disable-next-line no-undef
    const selector = new PlatformSelector(this.listing.id, this.listing);
    selector.show();
  }

  /**
   * Handle view posts button click
   */
  handleViewPosts() {
    const statuses = this.listing.platform_statuses || [];
    const posted = statuses.filter(s => s.status === 'posted' && s.platform_url);

    if (posted.length === 0) {
      this.showToast('No active posts found', 'info');
      return;
    }

    // Show modal with links
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Active Posts</h2>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="post-links">
            ${posted.map(p => `
              <a href="${p.platform_url}" target="_blank" class="post-link">
                <span class="post-link-icon">${this.getPlatformIcon(p.platform)}</span>
                <span class="post-link-platform">${this.capitalize(p.platform)}</span>
                <span class="post-link-stats">
                  ${p.view_count || p.views ? `👁️ ${p.view_count || p.views}` : ''}
                  ${p.watcher_count || p.watchers ? `⭐ ${p.watcher_count || p.watchers}` : ''}
                </span>
                <span class="post-link-arrow">→</span>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Handle more button click
   */
  handleMore(event) {
    // Show context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu active';
    menu.innerHTML = `
      <button data-action="duplicate">📋 Duplicate</button>
      <button data-action="share">📤 Share</button>
      <button data-action="archive">📦 Archive</button>
      <hr>
      <button data-action="delete" class="danger">🗑️ Delete</button>
    `;

    document.body.appendChild(menu);

    // Position menu near button
    const btn = event.target.closest('.btn-icon');
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    // Handle menu actions
    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleContextAction(action);
        menu.remove();
      });
    });

    // Close menu on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  }

  /**
   * Handle context menu actions
   */
  handleContextAction(action) {
    switch (action) {
      case 'duplicate':
        this.duplicateListing();
        break;
      case 'share':
        this.shareListing();
        break;
      case 'archive':
        this.archiveListing();
        break;
      case 'delete':
        this.deleteListing();
        break;
    }
  }

  /**
   * Handle card click (view details)
   */
  handleCardClick() {
    if (window.app && typeof window.app.viewListing === 'function') {
      window.app.viewListing(this.listing.id);
    } else {
      console.log('View listing:', this.listing.id);
    }
  }

  /**
   * Handle platform status click
   */
  handlePlatformClick(platform, status) {
    if (status === 'posted') {
      // Find platform URL and open it
      const platformStatus = (this.listing.platform_statuses || [])
        .find(s => s.platform === platform);

      if (platformStatus?.platform_url) {
        window.open(platformStatus.platform_url, '_blank');
      }
    } else if (status === 'draft') {
      // Open platform selector with this platform pre-selected
      // eslint-disable-next-line no-undef
      const selector = new PlatformSelector(this.listing.id, this.listing);
      selector.selectedPlatforms.add(platform);
      selector.show();
    }
  }

  /**
   * Duplicate listing
   */
  async duplicateListing() {
    if (window.app && typeof window.app.duplicateListing === 'function') {
      await window.app.duplicateListing(this.listing.id);
    }
    this.showToast('Listing duplicated', 'success');
  }

  /**
   * Share listing
   */
  async shareListing() {
    const text = `${this.listing.title} - £${this.listing.price}`;
    const url = `${window.location.origin}/listing/${this.listing.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: this.listing.title, text, url });
      } catch (_error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy link
      // eslint-disable-next-line no-undef
      const clipboard = new SmartClipboard();
      await clipboard.copy(url, 'share');
      this.showToast('Link copied to clipboard', 'success');
    }
  }

  /**
   * Archive listing
   */
  async archiveListing() {
    if (confirm('Archive this listing?')) {
      // API call to archive
      this.showToast('Listing archived', 'success');
    }
  }

  /**
   * Delete listing
   */
  async deleteListing() {
    if (confirm('Delete this listing? This cannot be undone.')) {
      // API call to delete
      this.showToast('Listing deleted', 'success');

      // Remove card from DOM
      const card = document.querySelector(`[data-listing-id="${this.listing.id}"]`);
      if (card) {
        card.style.animation = 'card-remove 0.3s ease';
        setTimeout(() => card.remove(), 300);
      }
    }
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

// ============================================================================
// LISTING GRID COMPONENT
// ============================================================================

/**
 * Grid of listing cards
 */
class ListingGrid {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.listings = [];
    this.options = {
      emptyMessage: 'No listings yet',
      showLoadMore: false,
      ...options
    };
  }

  /**
   * Load listings from API
   */
  async load() {
    try {
      const response = await fetch('/api/listings-with-platforms', {
        headers: {
          'Authorization': `Bearer ${window.app?.authToken || localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }

      this.listings = await response.json();
      this.render();
    } catch (error) {
      console.error('Failed to load listings:', error);
      this.showError('Failed to load listings');
    }
  }

  /**
   * Render grid
   */
  async render() {
    if (this.listings.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>${this.options.emptyMessage}</p>
          <button class="btn-primary" onclick="window.app?.navigate('new')">
            Create Your First Listing
          </button>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '<div class="listing-grid"></div>';
    const grid = this.container.querySelector('.listing-grid');

    for (const listing of this.listings) {
      const card = new ListingCard(listing, this.options);
      const cardElement = await card.render();
      card.attachEventListeners(cardElement);
      grid.appendChild(cardElement);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>${message}</p>
        <button class="btn-secondary" onclick="location.reload()">
          Retry
        </button>
      </div>
    `;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ListingCard = ListingCard;
  window.ListingGrid = ListingGrid;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ListingCard, ListingGrid };
}
