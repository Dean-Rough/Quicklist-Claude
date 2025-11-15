/**
 * QuickList AI Chrome Extension - Background Service Worker
 * Handles extension lifecycle, messaging, and API communication
 */

// Extension state
const state = {
  authToken: null,
  currentUser: null,
  listings: [],
  lastSync: null,
};

// Configuration
const API_BASE = 'https://quicklist.it.com';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[QuickList] Extension installed', details);

  if (details.reason === 'install') {
    // First install - open welcome page
    chrome.tabs.create({
      url: `${API_BASE}/?welcome=extension`,
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('[QuickList] Extension updated to', chrome.runtime.getManifest().version);
  }

  // Set default storage
  chrome.storage.sync.get(['auth_token'], (result) => {
    if (result.auth_token) {
      state.authToken = result.auth_token;
      syncListings();
    }
  });
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[QuickList] Extension clicked on tab', tab.url);

  // Open popup (default behavior, but we can customize)
  // If we wanted to open a specific page instead:
  // chrome.tabs.create({ url: API_BASE });
});

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[QuickList] Message received', message);

  switch (message.action) {
    case 'open_popup':
      // Open extension popup programmatically (if possible)
      chrome.action.openPopup();
      sendResponse({ success: true });
      break;

    case 'autofill_complete':
      console.log('[QuickList] Auto-fill completed on', message.platform);
      // Update badge
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 3000);
      sendResponse({ success: true });
      break;

    case 'autofill_error':
      console.error('[QuickList] Auto-fill error on', message.platform, message.error);
      // Update badge
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 5000);
      sendResponse({ success: false, error: message.error });
      break;

    case 'get_auth_token':
      sendResponse({ token: state.authToken });
      break;

    case 'set_auth_token':
      state.authToken = message.token;
      chrome.storage.sync.set({ auth_token: message.token });
      syncListings();
      sendResponse({ success: true });
      break;

    case 'sync_listings':
      syncListings().then(() => {
        sendResponse({ success: true, listings: state.listings });
      });
      return true; // Keep channel open for async response

    case 'clear_auth':
      state.authToken = null;
      state.currentUser = null;
      state.listings = [];
      chrome.storage.sync.remove('auth_token');
      sendResponse({ success: true });
      break;

    default:
      console.warn('[QuickList] Unknown message action', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false;
});

/**
 * Sync listings from API
 */
async function syncListings() {
  if (!state.authToken) {
    console.log('[QuickList] No auth token, skipping sync');
    return;
  }

  try {
    console.log('[QuickList] Syncing listings from API');

    const response = await fetch(`${API_BASE}/api/listings?page=1&limit=50`, {
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    state.listings = data.listings || [];
    state.lastSync = new Date();

    console.log('[QuickList] Synced', state.listings.length, 'listings');

    // Store in local storage for offline access
    chrome.storage.local.set({
      listings: state.listings,
      lastSync: state.lastSync.toISOString(),
    });

    // Update badge with listing count
    if (state.listings.length > 0) {
      chrome.action.setBadgeText({ text: state.listings.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
  } catch (error) {
    console.error('[QuickList] Failed to sync listings', error);
  }
}

/**
 * Periodic sync
 */
setInterval(() => {
  if (state.authToken) {
    syncListings();
  }
}, SYNC_INTERVAL);

/**
 * Handle tab updates - detect marketplace pages
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isMarketplace = detectMarketplace(tab.url);

    if (isMarketplace) {
      console.log('[QuickList] Marketplace detected', isMarketplace, tab.url);

      // Update badge to indicate QuickList is ready
      chrome.action.setBadgeText({ text: '⚡', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId: tabId });
    } else {
      // Clear badge on non-marketplace pages
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

/**
 * Detect marketplace from URL
 */
function detectMarketplace(url) {
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
 * Handle extension uninstall
 */
chrome.runtime.setUninstallURL(`${API_BASE}/?uninstall=extension`, () => {
  console.log('[QuickList] Uninstall URL set');
});

/**
 * Keep service worker alive (Chrome's service workers can go inactive)
 */
chrome.runtime.onConnect.addListener((port) => {
  console.log('[QuickList] Port connected', port.name);
});

console.log('[QuickList] Background service worker initialized');
