/**
 * Bottom Navigation Component
 *
 * Mobile-first navigation bar for QuickList AI
 * Tabs: Home | New Listing | My Listings | Profile
 *
 * Features:
 * - Touch-optimized 60px height
 * - Active state highlighting
 * - Smooth transitions
 * - Icon + label design
 * - Fixed bottom positioning
 */

class BottomNav {
  constructor() {
    this.currentTab = this.detectCurrentTab();
    this.container = null;
    this.init();
  }

  /**
   * Detect current tab based on URL
   */
  detectCurrentTab() {
    const path = window.location.pathname;

    if (path === '/' || path === '/index.html') {
      return 'home';
    } else if (path.includes('upload') || path.includes('new')) {
      return 'new';
    } else if (path.includes('listing')) {
      return 'listings';
    } else if (path.includes('profile') || path.includes('settings')) {
      return 'profile';
    }

    return 'home';
  }

  /**
   * Initialize bottom nav
   */
  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render bottom navigation
   */
  render() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'bottom-nav';
    this.container.innerHTML = this.getTemplate();

    // Append to body
    document.body.appendChild(this.container);

    // Add padding to body to account for fixed bottom nav
    document.body.style.paddingBottom = '76px'; // 60px nav + 16px gap
  }

  /**
   * Get HTML template
   */
  getTemplate() {
    const tabs = [
      {
        id: 'home',
        icon: '🏠',
        label: 'Home',
        path: '/',
      },
      {
        id: 'new',
        icon: '➕',
        label: 'New Listing',
        path: '/index.html#upload', // Will be updated once we have dedicated upload page
      },
      {
        id: 'listings',
        icon: '📦',
        label: 'My Listings',
        path: '/index.html#listings',
      },
      {
        id: 'profile',
        icon: '👤',
        label: 'Profile',
        path: '/index.html#profile',
      },
    ];

    return `
      <nav class="bottom-nav-container">
        ${tabs
          .map(
            (tab) => `
          <button
            class="bottom-nav-tab ${tab.id === this.currentTab ? 'active' : ''}"
            data-tab="${tab.id}"
            data-path="${tab.path}"
            aria-label="${tab.label}"
          >
            <span class="tab-icon">${tab.icon}</span>
            <span class="tab-label">${tab.label}</span>
          </button>
        `
          )
          .join('')}
      </nav>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const tabs = this.container.querySelectorAll('.bottom-nav-tab');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleTabClick(tab);
      });
    });
  }

  /**
   * Handle tab click
   */
  handleTabClick(tab) {
    const tabId = tab.dataset.tab;
    const tabPath = tab.dataset.path;

    // Update active state
    this.setActiveTab(tabId);

    // Emit custom event for app to handle
    const event = new CustomEvent('bottom-nav-change', {
      detail: { tab: tabId, path: tabPath },
    });
    window.dispatchEvent(event);

    // Navigate based on tab
    this.navigate(tabId, tabPath);
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId) {
    // Remove active from all tabs
    const tabs = this.container.querySelectorAll('.bottom-nav-tab');
    tabs.forEach((t) => t.classList.remove('active'));

    // Add active to clicked tab
    const activeTab = this.container.querySelector(`.bottom-nav-tab[data-tab="${tabId}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    this.currentTab = tabId;
  }

  /**
   * Navigate to tab
   */
  navigate(tabId, tabPath) {
    switch (tabId) {
      case 'home':
        // Show home view
        this.showView('home');
        break;

      case 'new':
        // Trigger upload modal or navigate to upload page
        if (window.app && window.app.showUploadModal) {
          window.app.showUploadModal();
        } else {
          // Fallback: scroll to upload section
          const uploadSection = document.getElementById('upload');
          if (uploadSection) {
            uploadSection.scrollIntoView({ behavior: 'smooth' });
          }
        }
        break;

      case 'listings':
        // Show listings view
        this.showView('listings');
        break;

      case 'profile':
        // Show profile view
        this.showView('profile');
        break;

      default:
        console.warn(`Unknown tab: ${tabId}`);
    }

    // Update URL hash (without page reload)
    window.history.pushState({}, '', `${tabPath}`);
  }

  /**
   * Show specific view
   */
  showView(viewName) {
    // Hide all sections
    const sections = document.querySelectorAll('.main-section');
    sections.forEach((section) => {
      section.style.display = 'none';
    });

    // Show target section
    const targetSection = document.getElementById(viewName);
    if (targetSection) {
      targetSection.style.display = 'block';
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Emit view change event
    const event = new CustomEvent('view-change', {
      detail: { view: viewName },
    });
    window.dispatchEvent(event);
  }

  /**
   * Update badge count (e.g., unread notifications)
   */
  updateBadge(tabId, count) {
    const tab = this.container.querySelector(`.bottom-nav-tab[data-tab="${tabId}"]`);
    if (!tab) return;

    // Remove existing badge
    const existingBadge = tab.querySelector('.tab-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add new badge if count > 0
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'tab-badge';
      badge.textContent = count > 99 ? '99+' : count;
      tab.appendChild(badge);
    }
  }

  /**
   * Destroy bottom nav
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      document.body.style.paddingBottom = '';
    }
  }
}

// ============================================================================
// AUTO-INITIALIZE
// ============================================================================

// Initialize on DOM ready (mobile devices)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Only show on mobile devices
    if (window.innerWidth <= 768) {
      window.bottomNav = new BottomNav();
    }
  });
} else {
  // DOM already loaded
  if (window.innerWidth <= 768) {
    window.bottomNav = new BottomNav();
  }
}

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const isMobile = window.innerWidth <= 768;

    if (isMobile && !window.bottomNav) {
      // Show bottom nav on mobile
      window.bottomNav = new BottomNav();
    } else if (!isMobile && window.bottomNav) {
      // Hide bottom nav on desktop
      window.bottomNav.destroy();
      window.bottomNav = null;
    }
  }, 250);
});

// Export for use in other components
if (typeof window !== 'undefined') {
  window.BottomNav = BottomNav;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BottomNav;
}
