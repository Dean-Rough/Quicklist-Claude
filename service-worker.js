/**
 * Service Worker for QuickList AI PWA
 * Provides offline support, caching, and background sync
 */

// Cache configuration
const CACHE_VERSION = 'v2'; // Bumped for Phase 1 multi-platform release
const STATIC_CACHE = 'quicklist-static-v2';
const DYNAMIC_CACHE = 'quicklist-dynamic-v2';
const IMAGE_CACHE = 'quicklist-images-v2';

// Cache these files on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/utils/clipboard.js',
  '/components/PlatformSelector.js',
  '/components/ListingCard.js',
  '/components/BottomNav.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        // Cache each asset individually to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[ServiceWorker] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Delete old version caches
            return cacheName.startsWith('quicklist-') &&
                   !cacheName.endsWith(CACHE_VERSION);
          })
          .map(cacheName => {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Ignore non-http(s) schemes (browser extensions, data URLs, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // For cross-origin requests, let the browser handle them (don't cache/intercept)
  // BUT allow localhost API calls (different port = different origin in dev)
  const isLocalAPI = url.hostname === 'localhost' && url.port === '3000';
  const isClerkImage = url.hostname === 'img.clerk.com';

  if (url.origin !== self.location.origin && !isLocalAPI && !isClerkImage) {
    event.respondWith(fetch(request));
    return;
  }

  // API calls - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Images - cache first, network fallback
  if (request.destination === 'image' ||
      url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Static assets - cache first
  if (STATIC_ASSETS.includes(url.pathname) ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Everything else - network first
  event.respondWith(networkFirstStrategy(request));
});

// Cache-first strategy
async function cacheFirstStrategy(request, cacheName = DYNAMIC_CACHE) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Return from cache but update in background
      fetchAndCache(request, cache);
      return cachedResponse;
    }

    // Not in cache, fetch from network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Cache first failed:', error);
    // Return offline page if available
    const offlineResponse = await caches.match('/offline.html');
    return offlineResponse || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network-first strategy
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network request failed, trying cache:', error);

    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // API calls - return error JSON
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'Offline - request queued for sync',
          offline: true
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return offline page
    const offlineResponse = await caches.match('/offline.html');
    return offlineResponse || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Background fetch and cache update
function fetchAndCache(request, cache) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response);
      }
    })
    .catch(() => {
      // Silent fail - we already returned from cache
    });
}

// Background sync for offline uploads
self.addEventListener('sync', async (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);

  if (event.tag === 'sync-listings') {
    event.waitUntil(syncQueuedListings());
  } else if (event.tag.startsWith('sync-listing-')) {
    const listingId = event.tag.replace('sync-listing-', '');
    event.waitUntil(syncListing(listingId));
  }
});

// Sync queued listings
async function syncQueuedListings() {
  try {
    // Get queued listings from IndexedDB
    const db = await openDB();
    const tx = db.transaction('queued-listings', 'readonly');
    const store = tx.objectStore('queued-listings');
    const listings = await store.getAll();

    console.log(`[ServiceWorker] Syncing ${listings.length} queued listings`);

    // Upload each listing
    for (const listing of listings) {
      try {
        const response = await fetch('/api/listings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': listing.auth
          },
          body: JSON.stringify(listing.data)
        });

        if (response.ok) {
          // Remove from queue
          const deleteTx = db.transaction('queued-listings', 'readwrite');
          const deleteStore = deleteTx.objectStore('queued-listings');
          await deleteStore.delete(listing.id);

          // Notify client
          await notifyClients('listing-synced', {
            listingId: listing.id,
            success: true
          });
        }
      } catch (error) {
        console.error(`[ServiceWorker] Failed to sync listing ${listing.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Sync individual listing
async function syncListing(listingId) {
  try {
    const db = await openDB();
    const tx = db.transaction('queued-listings', 'readonly');
    const store = tx.objectStore('queued-listings');
    const listing = await store.get(listingId);

    if (!listing) {
      console.log(`[ServiceWorker] Listing ${listingId} not found in queue`);
      return;
    }

    const response = await fetch('/api/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': listing.auth
      },
      body: JSON.stringify(listing.data)
    });

    if (response.ok) {
      // Remove from queue
      const deleteTx = db.transaction('queued-listings', 'readwrite');
      const deleteStore = deleteTx.objectStore('queued-listings');
      await deleteStore.delete(listingId);

      // Notify client
      await notifyClients('listing-synced', {
        listingId,
        success: true
      });
    }
  } catch (error) {
    console.error(`[ServiceWorker] Failed to sync listing ${listingId}:`, error);

    // Notify client of failure
    await notifyClients('listing-synced', {
      listingId,
      success: false,
      error: error.message
    });
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');

  let data = {
    title: 'QuickList AI',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click');

  event.notification.close();

  // Handle action clicks
  if (event.action) {
    handleNotificationAction(event.action, event.notification.data);
    return;
  }

  // Default click - open app
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes('quicklist') && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          const url = event.notification.data?.url || '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification actions
function handleNotificationAction(action, data) {
  switch (action) {
    case 'view':
      clients.openWindow(data.url || '/');
      break;
    case 'dismiss':
      // Just close, already done
      break;
    default:
      console.log('[ServiceWorker] Unknown action:', action);
  }
}

// Message handling
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'QUEUE_LISTING') {
    queueListing(event.data.listing);
  }
});

// Queue listing for offline sync
async function queueListing(listing) {
  try {
    const db = await openDB();
    const tx = db.transaction('queued-listings', 'readwrite');
    const store = tx.objectStore('queued-listings');

    await store.add({
      id: Date.now().toString(),
      data: listing.data,
      auth: listing.auth,
      timestamp: Date.now()
    });

    // Register for background sync
    await self.registration.sync.register('sync-listings');

    // Notify client
    await notifyClients('listing-queued', { success: true });
  } catch (error) {
    console.error('[ServiceWorker] Failed to queue listing:', error);
    await notifyClients('listing-queued', {
      success: false,
      error: error.message
    });
  }
}

// Notify all clients
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type,
      ...data
    });
  });
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('quicklist-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('queued-listings')) {
        db.createObjectStore('queued-listings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('drafts')) {
        const draftsStore = db.createObjectStore('drafts', { keyPath: 'id', autoIncrement: true });
        draftsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Cache versioning strategy
self.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_CACHE_VERSION') {
    // Update cache version and reinstall
    CACHE_VERSION = event.data.version;
    self.skipWaiting();
  }
});

console.log('[ServiceWorker] Loaded');
