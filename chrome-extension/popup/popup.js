/**
 * QuickList AI Chrome Extension - Popup Script
 * Manages the extension popup UI and listing selection
 */

const API_BASE = 'https://quicklist.it.com';

// State
let currentListings = [];
let authToken = null;
let currentTab = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Check authentication
  await checkAuth();

  // Detect if on a marketplace
  const platform = detectPlatform(tab.url);
  if (platform) {
    showDetectionView(platform);
  } else {
    await loadListings();
  }

  // Attach event listeners
  attachEventListeners();
});

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  try {
    const result = await chrome.storage.sync.get(['auth_token']);
    authToken = result.auth_token;

    if (!authToken) {
      showSignInView();
      updateStatus('Not signed in', 'error');
      return false;
    }

    // Verify token with API
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      showSignInView();
      updateStatus('Session expired', 'error');
      return false;
    }

    updateStatus('Connected', 'connected');
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    showSignInView();
    updateStatus('Error', 'error');
    return false;
  }
}

/**
 * Load user's listings
 */
async function loadListings() {
  if (!authToken) {
    showSignInView();
    return;
  }

  showView('mainView');
  showElement('loadingState');
  hideElement('emptyState');
  hideElement('listingsContainer');

  try {
    const response = await fetch(`${API_BASE}/api/listings?page=1&limit=50`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load listings');
    }

    const data = await response.json();
    currentListings = data.listings || [];

    hideElement('loadingState');

    if (currentListings.length === 0) {
      showElement('emptyState');
    } else {
      showElement('listingsContainer');
      renderListings(currentListings);
    }
  } catch (error) {
    console.error('Failed to load listings:', error);
    hideElement('loadingState');
    showElement('emptyState');
    document.querySelector('#emptyState h2').textContent = 'Error Loading Listings';
    document.querySelector('#emptyState p').textContent =
      'Please try again or check your connection.';
  }
}

/**
 * Render listings in the popup
 */
function renderListings(listings) {
  const container = document.getElementById('listingsContainer');
  container.innerHTML = '';

  listings.forEach((listing) => {
    const card = createListingCard(listing);
    container.appendChild(card);
  });
}

/**
 * Create listing card element
 */
function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'listing-card';
  card.dataset.listingId = listing.id;

  const imageUrl =
    listing.images?.[0]?.cloudinaryUrl ||
    listing.images?.[0]?.url ||
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23f3f4f6"/%3E%3C/svg%3E';

  const platforms = (listing.platform_statuses || [])
    .filter((ps) => ps.status !== 'draft')
    .map((ps) => ps.platform);

  card.innerHTML = `
    <div class="listing-card-header">
      <img src="${imageUrl}" class="listing-image" alt="${listing.title}">
      <div class="listing-info">
        <div class="listing-title">${listing.title}</div>
        <div class="listing-meta">£${listing.price} • ${listing.condition}</div>
      </div>
    </div>
    ${
      platforms.length > 0
        ? `
      <div class="listing-platforms">
        ${platforms.map((p) => `<span class="platform-badge ${p}">${p}</span>`).join('')}
      </div>
    `
        : ''
    }
  `;

  card.addEventListener('click', () => handleListingSelect(listing));

  return card;
}

/**
 * Handle listing selection
 */
async function handleListingSelect(listing) {
  const platform = detectPlatform(currentTab.url);

  if (!platform) {
    alert('Please navigate to a marketplace listing form first.');
    return;
  }

  try {
    // Send listing data directly to content script
    // Content scripts handle platform-specific formatting
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'autofill',
      platform: platform,
      listing: listing,
    });

    // Close popup
    window.close();
  } catch (error) {
    console.error('Auto-fill failed:', error);
    alert('Failed to auto-fill listing. Please try again.');
  }
}

/**
 * Detect marketplace platform from URL
 */
function detectPlatform(url) {
  if (!url) return null;

  if (url.includes('ebay.co.uk') || url.includes('ebay.com')) {
    return 'ebay';
  } else if (url.includes('vinted.co.uk') || url.includes('vinted.com')) {
    return 'vinted';
  } else if (url.includes('depop.com')) {
    return 'depop';
  } else if (url.includes('facebook.com/marketplace')) {
    return 'facebook';
  }

  return null;
}

/**
 * Show detection view when on marketplace
 */
function showDetectionView(platform) {
  showView('detectionView');

  const platformNames = {
    ebay: 'eBay',
    vinted: 'Vinted',
    depop: 'Depop',
    facebook: 'Facebook Marketplace',
  };

  document.getElementById('detectedPlatform').textContent = `${platformNames[platform]} Detected`;
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Sign in button
  document.getElementById('signInBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE}/?action=signin` });
  });

  // Create listing button
  document.getElementById('createListingBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE}/?action=new` });
  });

  // Select listing button (detection view)
  document.getElementById('selectListingBtn')?.addEventListener('click', async () => {
    await loadListings();
  });

  // Open QuickList button
  document.getElementById('openQuickListBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: API_BASE });
  });

  // Settings button
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE}/?view=profile` });
  });

  // Search input
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = currentListings.filter(
      (listing) =>
        listing.title.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
    );
    renderListings(filtered);
  });
}

/**
 * View management
 */
function showView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.add('hidden');
  });
  document.getElementById(viewId)?.classList.remove('hidden');
}

function showSignInView() {
  showView('signInView');
}

function showElement(elementId) {
  document.getElementById(elementId)?.classList.remove('hidden');
}

function hideElement(elementId) {
  document.getElementById(elementId)?.classList.add('hidden');
}

/**
 * Update connection status
 */
function updateStatus(text, state) {
  const statusEl = document.getElementById('status');
  const statusText = statusEl.querySelector('.status-text');

  statusText.textContent = text;
  statusEl.className = 'status ' + state;
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofill_complete') {
    updateStatus('Auto-fill complete!', 'connected');
    setTimeout(() => window.close(), 1500);
  } else if (message.action === 'autofill_error') {
    updateStatus('Auto-fill failed', 'error');
    alert(message.error || 'Auto-fill failed. Please try manually.');
  }
});
