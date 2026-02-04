/**
 * PWA Features for QuickList AI
 * This file contains all PWA-specific functionality
 */

// Extend the app object with PWA features
if (typeof app !== 'undefined') {
  Object.assign(app, {
    // PWA: Register Service Worker
    async registerServiceWorker() {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
          });
          console.log('Service Worker registered:', registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                this.showToast('Update available! Refresh to get the latest version.', 'info');
              }
            });
          });
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      }
    },

    // PWA: Setup install prompt
    setupPWAInstall() {
      let deferredPrompt = null;
      const installButton = document.getElementById('installPWA');

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install button
        if (installButton && !this.isStandalone()) {
          installButton.classList.add('show');
        }
      });

      if (installButton) {
        installButton.addEventListener('click', async () => {
          if (!deferredPrompt) {
            this.showToast('App is already installed or not available for installation', 'info');
            return;
          }

          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;

          if (outcome === 'accepted') {
            console.log('PWA installed');
            installButton.classList.remove('show');
            this.showToast('App installed successfully!', 'success');
          }
          deferredPrompt = null;
        });
      }

      // Check if running as PWA
      window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (installButton) {
          installButton.classList.remove('show');
        }
      });
    },

    // Check if running in standalone mode
    isStandalone() {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')
      );
    },

    // PWA: Setup offline detection
    setupOfflineDetection() {
      const offlineIndicator = document.getElementById('offlineIndicator');

      const updateOnlineStatus = () => {
        if (!navigator.onLine) {
          offlineIndicator?.classList.add('show');
          this.handleOfflineMode();
        } else {
          offlineIndicator?.classList.remove('show');
          this.handleOnlineMode();
        }
      };

      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      // Check initial status
      updateOnlineStatus();
    },

    // Handle offline mode
    async handleOfflineMode() {
      console.log('App is offline');

      // Queue any pending operations
      if (this.state.currentListing && !this.state.currentListing.saved) {
        await this.saveDraftOffline(this.state.currentListing);
        this.showToast('Draft saved offline. Will sync when online.', 'info');
      }
    },

    // Handle online mode
    async handleOnlineMode() {
      console.log('App is online');

      // Sync any queued operations
      await this.syncQueuedRequests();
    },

    // Save draft offline using IndexedDB
    async saveDraftOffline(listing) {
      try {
        const db = await this.openIndexedDB();
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');

        await store.put({
          ...listing,
          id: listing.id || Date.now(),
          timestamp: Date.now(),
          synced: false,
        });

        return true;
      } catch (error) {
        console.error('Failed to save draft offline:', error);
        return false;
      }
    },

    // Sync queued requests when back online
    async syncQueuedRequests() {
      try {
        const db = await this.openIndexedDB();
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const getAllRequest = store.getAll();

        return new Promise((resolve) => {
          getAllRequest.onsuccess = async () => {
            const drafts = getAllRequest.result;
            let syncedCount = 0;

            for (const draft of drafts) {
              if (!draft.synced) {
                try {
                  await this.saveListing(draft);

                  // Mark as synced
                  const updateTx = db.transaction('drafts', 'readwrite');
                  const updateStore = updateTx.objectStore('drafts');
                  draft.synced = true;
                  updateStore.put(draft);

                  syncedCount++;
                } catch (error) {
                  console.error('Failed to sync draft:', error);
                }
              }
            }

            if (syncedCount > 0) {
              this.showToast(`Synced ${syncedCount} draft(s)`, 'success');
            }
            resolve(syncedCount);
          };
        });
      } catch (error) {
        console.error('Failed to sync queued requests:', error);
      }
    },

    // Open IndexedDB
    openIndexedDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('quicklist-offline', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('drafts')) {
            const draftsStore = db.createObjectStore('drafts', { keyPath: 'id' });
            draftsStore.createIndex('timestamp', 'timestamp', { unique: false });
            draftsStore.createIndex('synced', 'synced', { unique: false });
          }

          if (!db.objectStoreNames.contains('queued-listings')) {
            db.createObjectStore('queued-listings', { keyPath: 'id' });
          }
        };
      });
    },

    // PWA: Setup pull-to-refresh
    setupPullToRefresh() {
      if (!this.isMobile()) return;

      let startY = 0;
      let currentY = 0;
      let pulling = false;

      const refreshIndicator = document.getElementById('pullToRefresh');
      const mainContent = document.getElementById('appView');

      if (!mainContent) return;

      mainContent.addEventListener('touchstart', (e) => {
        if (mainContent.scrollTop === 0) {
          startY = e.touches[0].clientY;
          pulling = true;
        }
      });

      mainContent.addEventListener('touchmove', (e) => {
        if (!pulling) return;

        currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        if (diff > 0 && diff < 100) {
          refreshIndicator?.classList.add('pulling');
          e.preventDefault();
        }
      });

      mainContent.addEventListener('touchend', async () => {
        if (!pulling) return;

        const diff = currentY - startY;

        if (diff > 80) {
          refreshIndicator?.classList.add('refreshing');
          await this.refreshData();
          refreshIndicator?.classList.remove('refreshing');
        }

        refreshIndicator?.classList.remove('pulling');
        pulling = false;
      });
    },

    // Refresh data
    async refreshData() {
      try {
        // Refresh based on current view
        if (this.state.currentAppView === 'savedItems') {
          await this.loadSavedItems();
        } else if (this.state.currentAppView === 'dashboard') {
          await this.loadDashboardMetrics(true);
        } else if (this.state.currentAppView === 'messages') {
          await this.loadMessages(true);
        }

        this.showToast('Updated', 'success');
      } catch (error) {
        console.error('Failed to refresh:', error);
        this.showToast('Failed to refresh', 'error');
      }
    },

    // Phase 3: Native share integration
    async shareListing(listing = null) {
      const currentListing = listing || this.state.currentListing;
      if (!currentListing) {
        this.showToast('No listing to share', 'error');
        return;
      }

      const shareData = {
        title: currentListing.title,
        text: `${currentListing.title} - ${currentListing.price}\n${currentListing.description?.substring(0, 100)}...`,
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          console.log('Shared successfully');
          if (typeof this.setWizardPhase === 'function') {
            this.setWizardPhase('publish');
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            this.fallbackShare(shareData);
          }
        }
      } else {
        this.fallbackShare(shareData);
      }
    },

    // Fallback share (copy to clipboard)
    fallbackShare(data) {
      const text = `${data.title}\n${data.text}\n${data.url}`;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showToast('Copied to clipboard', 'success');
          if (typeof this.setWizardPhase === 'function') {
            this.setWizardPhase('publish');
          }
        })
        .catch(() => {
          this.showToast('Failed to copy', 'error');
        });
    },

    // Phase 3: Geolocation integration
    async getLocationForListing() {
      if (!navigator.geolocation) {
        return null;
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const location = await this.reverseGeocode(latitude, longitude);
            resolve(location);
          },
          (error) => {
            console.warn('Location access denied:', error);
            resolve(null);
          },
          {
            timeout: 10000,
            maximumAge: 300000, // Cache for 5 minutes
          }
        );
      });
    },

    // Reverse geocoding
    async reverseGeocode(lat, lon) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          {
            headers: {
              'User-Agent': 'QuickListAI/1.0',
            },
          }
        );
        const data = await response.json();
        return {
          city: data.address?.city || data.address?.town || data.address?.village,
          postcode: data.address?.postcode,
          country: data.address?.country,
          formatted: data.display_name,
        };
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return null;
      }
    },

    // Phase 3: Voice input integration
    startVoiceInput(targetFieldId) {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        this.showToast('Voice input not supported on this device', 'error');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';

      const targetElement = document.getElementById(targetFieldId);
      if (!targetElement) return;

      // Add visual indicator
      const voiceButton = targetElement.parentElement?.querySelector('.voice-input-button');
      if (voiceButton) {
        voiceButton.classList.add('listening');
        voiceButton.setAttribute('aria-pressed', 'true');
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');

        targetElement.value = transcript;
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.showToast('Voice input error: ' + event.error, 'error');
        if (voiceButton) {
          voiceButton.classList.remove('listening');
          voiceButton.setAttribute('aria-pressed', 'false');
        }
      };

      recognition.onend = () => {
        if (voiceButton) {
          voiceButton.classList.remove('listening');
          voiceButton.setAttribute('aria-pressed', 'false');
        }
      };

      recognition.start();
      this.showToast('Listening...', 'info');

      // Auto-stop after 30 seconds
      setTimeout(() => {
        recognition.stop();
      }, 30000);

      // Store recognition instance for manual stop
      this.currentRecognition = recognition;
    },

    // Stop voice input
    stopVoiceInput() {
      if (this.currentRecognition) {
        this.currentRecognition.stop();
        this.currentRecognition = null;
      }
    },

    // Phase 3: Push notifications
    async enablePushNotifications() {
      if (!('Notification' in window)) {
        this.showToast('Notifications not supported', 'error');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;

          // For now, just enable local notifications
          // Full push requires server-side implementation
          localStorage.setItem('notificationsEnabled', 'true');

          this.showToast('Notifications enabled', 'success');

          // Test notification
          new Notification('QuickList AI', {
            body: 'Notifications are now enabled!',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
          });
        } catch (error) {
          console.error('Failed to enable notifications:', error);
          this.showToast('Failed to enable notifications', 'error');
        }
      } else {
        this.showToast('Notification permission denied', 'error');
      }
    },

    // Phase 4: Onboarding
    checkOnboarding() {
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

      if (!hasSeenOnboarding && this.isMobile()) {
        // Wait for app to load
        setTimeout(() => {
          if (this.state.isAuthenticated) {
            this.showOnboarding();
          }
        }, 2000);
      }
    },

    // Show onboarding tutorial
    showOnboarding() {
      const steps = [
        {
          target: '.bottom-nav-tab[data-view="newItem"]',
          title: 'Welcome to QuickList AI!',
          description: 'Tap here to scan and create listings instantly',
          position: 'top',
        },
        {
          target: '#uploadSection',
          title: 'Camera-First Workflow',
          description: 'Take photos at thrift stores or at home',
          position: 'center',
        },
        {
          target: '.bottom-nav-tab[data-view="savedItems"]',
          title: 'Manage Your Listings',
          description: 'View, edit, and track all your listings',
          position: 'top',
        },
        {
          target: '.bottom-nav-tab[data-view="dashboard"]',
          title: 'Track Performance',
          description: 'Monitor your sales and statistics',
          position: 'top',
        },
      ];

      this.runTutorial(steps);
    },

    // Run tutorial steps
    runTutorial(steps) {
      let currentStep = 0;
      const overlay = document.getElementById('onboardingOverlay');

      const showStep = () => {
        if (currentStep >= steps.length) {
          this.completeTutorial();
          return;
        }

        const step = steps[currentStep];
        const target = document.querySelector(step.target);

        if (!target) {
          currentStep++;
          showStep();
          return;
        }

        // Show overlay
        overlay?.classList.add('active');

        // Highlight target
        target.classList.add('onboarding-highlight');

        // Create and position tooltip
        const tooltip = this.createTooltip(step);
        document.body.appendChild(tooltip);

        this.positionTooltip(tooltip, target, step.position);

        // Add next button handler
        tooltip.querySelector('.next-button').addEventListener('click', () => {
          target.classList.remove('onboarding-highlight');
          tooltip.remove();
          currentStep++;
          showStep();
        });
      };

      showStep();
    },

    // Create onboarding tooltip
    createTooltip(step) {
      const div = document.createElement('div');
      div.className = 'onboarding-tooltip';
      div.innerHTML = `
                <h4>${step.title}</h4>
                <p>${step.description}</p>
                <button class="next-button">Got it!</button>
            `;
      return div;
    },

    // Position tooltip
    positionTooltip(tooltip, target, position) {
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top, left;

      switch (position) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 20;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + 20;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'center':
          top = window.innerHeight / 2 - tooltipRect.height / 2;
          left = window.innerWidth / 2 - tooltipRect.width / 2;
          break;
        default:
          top = targetRect.top;
          left = targetRect.right + 20;
      }

      // Ensure tooltip stays within viewport
      top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
      left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    },

    // Complete tutorial
    completeTutorial() {
      const overlay = document.getElementById('onboardingOverlay');
      overlay?.classList.remove('active');

      // Mark as completed
      localStorage.setItem('hasSeenOnboarding', 'true');

      this.showToast('Tutorial completed! You are ready to start.', 'success');
    },

    // Enhanced image optimization for mobile
    async resizeImageForMobile(file) {
      const isMobile = window.innerWidth < 768;
      const maxDimension = isMobile ? 1200 : 2400;
      const quality = isMobile ? 0.85 : 0.92;

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let { width, height } = img;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
              } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                resolve(
                  new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  })
                );
              },
              'image/jpeg',
              quality
            );
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    // Lazy load images with IntersectionObserver
    setupLazyLoading() {
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.classList.remove('lazy');
                  observer.unobserve(img);
                }
              }
            });
          },
          {
            rootMargin: '50px',
          }
        );

        // Observe all lazy images
        document.querySelectorAll('img.lazy').forEach((img) => {
          imageObserver.observe(img);
        });
      }
    },

    // Debounce helper for performance
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Throttle helper for performance
    throttle(func, limit) {
      let inThrottle;
      return function (...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },
  });
}
