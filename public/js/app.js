// QuickList AI Application
const app = {
  imageConfig: {
    // Smaller max dimension reduces vision token usage significantly.
    maxDimension: 1600,
    jpegQuality: 0.85,
  },
  // Auto-detect API URL based on current host
  apiUrl: (() => {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) {
      // In development, use the same port as the current page
      // The server runs on port 4577 and serves both frontend AND API
      return `${protocol}//${host}:${port}/api`;
    }
    // Production: use same origin or configured API URL
    const hasProcessEnv =
      typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL;
    return hasProcessEnv ? process.env.NEXT_PUBLIC_API_URL : '/api';
  })(),

  state: {
    isAuthenticated: false,
    currentView: 'home',
    currentAppView: 'newItem',
    wizardPhase: 'photos',
    dashboardMetrics: null,
    uploadedImages: [],
    currentListing: null,
    savedListings: [],
    filteredSavedListings: [],
    loadingSavedItems: false,
    selectedItemForDelete: null,
    selectedConfirmationItem: null,
    multipleItemsDetected: [],
    user: null,
    token: null,
    hasShownWelcomeToast: false,
    settings: {
      autoDownloadZip: false,
    },
    messages: [],
    messagesLoading: false,
    generationCancelled: false,
    generationAbortController: null,
    imageEnhancementEnabled: false,
    dashboardTips: [
      'Batch similar items to speed through photos',
      'Use voice input to capture condition notes hands-free',
      'Turn on auto-download to keep listings organized offline',
    ],
    progressTimeouts: [],
  },

  getPlatform() {
    // Check input selector first (before generation), then output selector (after generation)
    const inputSelect = document.getElementById('platformSelectInput');
    if (inputSelect && inputSelect.value) {
      return inputSelect.value;
    }
    const outputSelect = document.getElementById('platformSelect');
    if (outputSelect && outputSelect.value) {
      return outputSelect.value;
    }
    return 'vinted';
  },

  getItemHint() {
    const hintField = document.getElementById('itemHint');
    const hint = hintField ? hintField.value.trim() : '';
    const conditionInfo = document.getElementById('conditionInfo')?.value?.trim() || '';
    return [hint, conditionInfo].filter(Boolean).join(' — ');
  },

  setWizardPhase(phase = 'photos') {
    this.state.wizardPhase = phase;
    const steps = document.querySelectorAll('.wizard-step');
    const title = document.getElementById('wizardStepTitle');
    const phaseMap = {
      photos: { step: 1, title: 'Step 1 · Add Photos' },
      processing: { step: 2, title: 'Step 2 · Let AI work' },
      review: { step: 3, title: 'Step 3 · Review & edit' },
      publish: { step: 4, title: 'Step 4 · Publish everywhere' },
    };
    const current = phaseMap[phase] || phaseMap.photos;

    steps.forEach((step) => {
      step.classList.remove('active', 'completed');
      step.setAttribute('aria-selected', 'false');
      const stepNumber = parseInt(step.dataset.step, 10);
      if (stepNumber < current.step) {
        step.classList.add('completed');
      }
      if (stepNumber === current.step) {
        step.classList.add('active');
        step.setAttribute('aria-selected', 'true');
      }
    });

    if (title) {
      title.textContent = current.title;
    }
  },

  // Initialize app
  // Register service worker for PWA functionality
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered with scope:', registration.scope);
      } catch (error) {
        console.log('Service Worker registration failed:', error);
      }
    }
  },

  // Setup PWA install prompt
  setupPWAInstall() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      // Show install button or banner
      const installButton =
        document.getElementById('installPWA') || document.getElementById('pwaInstallButton');
      if (installButton) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            deferredPrompt = null;
          }
        });
      }
    });
  },

  // Setup offline detection
  setupOfflineDetection() {
    window.addEventListener('online', () => {
      const offlineBanner = document.getElementById('offlineBanner');
      if (offlineBanner) offlineBanner.style.display = 'none';
      console.log('Back online');
    });

    window.addEventListener('offline', () => {
      const offlineBanner = document.getElementById('offlineBanner');
      if (offlineBanner) {
        offlineBanner.style.display = 'block';
      } else {
        // Create offline banner if it doesn't exist
        const banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.style.cssText =
          'position: fixed; top: 0; left: 0; right: 0; background: #ff9800; color: white; padding: 10px; text-align: center; z-index: 10000;';
        banner.textContent = 'You are currently offline. Some features may be limited.';
        document.body.appendChild(banner);
      }
      console.log('Offline detected');
    });
  },

  // Setup pull-to-refresh
  setupPullToRefresh() {
    let startY = 0;
    let pulling = false;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;

      const y = e.touches[0].pageY;
      const diff = y - startY;

      if (diff > 100 && window.scrollY === 0) {
        // Show refresh indicator
        const refreshIndicator = document.getElementById('refreshIndicator');
        if (refreshIndicator) {
          refreshIndicator.style.display = 'block';
        }
      }
    });

    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;

      const refreshIndicator = document.getElementById('refreshIndicator');
      if (refreshIndicator && refreshIndicator.style.display === 'block') {
        refreshIndicator.style.display = 'none';
        // Refresh the current view
        if (this.state.currentAppView === 'savedItems') {
          this.loadSavedListings();
        }
      }
    });
  },

  // Check for first-time users
  checkOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding && !this.state.isAuthenticated) {
      // Could show onboarding tour here
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
  },

  async init() {
    // DON'T show any view yet - hide both views until auth check completes
    const appView = document.getElementById('appView');
    const appHeader = document.getElementById('appHeader');
    const marketingView = document.getElementById('marketingView');
    const marketingHeader = document.getElementById('marketingHeader');
    const marketingFooter = document.getElementById('marketingFooter');

    // Hide both views initially
    if (appView) appView.style.display = 'none';
    if (appHeader) appHeader.classList.add('hidden');
    if (marketingView) marketingView.style.display = 'none';
    if (marketingHeader) marketingHeader.classList.add('hidden');
    if (marketingFooter && marketingFooter.style) marketingFooter.style.display = 'none';

    // Show loading state
    document.body.classList.add('loading');

    this.loadSettings();
    this.loadToken();

    // Register Service Worker for PWA
    this.registerServiceWorker();

    // Setup PWA Install
    this.setupPWAInstall();

    // Setup offline detection
    this.setupOfflineDetection();

    // Setup pull-to-refresh
    this.setupPullToRefresh();

    // Check for onboarding
    this.checkOnboarding();

    // Setup Clerk event listeners BEFORE waiting for auth
    this.setupClerkListeners();

    // Wait for auth to be ready (Clerk or legacy)
    await new Promise((resolve) => {
      if (document.readyState === 'complete') {
        window.addEventListener('authReady', resolve, { once: true });
        // Timeout after 2 seconds if auth doesn't initialize
        setTimeout(resolve, 2000);
      } else {
        window.addEventListener('load', () => {
          window.addEventListener('authReady', resolve, { once: true });
          setTimeout(resolve, 2000);
        });
      }
    });

    // Check Clerk auth FIRST before showing any view
    await this.checkClerkAuth();

    // Fallback to legacy JWT auth if not authenticated
    if (!this.state.isAuthenticated) {
      await this.checkAuth();
    }

    this.attachEventListeners();
    this.setupFormValidation();

    // NOW show the correct view based on auth state
    this.updateUI();
    this.updateAuthButtons();
    this.updateMobileMenu();

    // Update personality dropdown based on user tier
    this.updatePersonalityDropdown();

    // Preload pricing configuration for checkout
    this.loadPricingConfig();

    // Remove loading state
    document.body.classList.remove('loading');

    // Initialize mobile features
    this.initMobileFeatures();
    this.setWizardPhase('photos');
  },

  // Load token from localStorage
  loadToken() {
    const token = localStorage.getItem('quicklist-token');
    if (token) {
      this.state.token = token;
    }
  },

  // Check if user is authenticated
  async checkAuth() {
    if (!this.state.token) return;

    try {
      const response = await fetch(`${this.apiUrl}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.state.user = data.user;
        this.state.isAuthenticated = true;
        await this.loadListingsFromDB();
      } else {
        // Token invalid, clear it
        localStorage.removeItem('quicklist-token');
        this.state.token = null;
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  },

  // Load listings from database
  async loadListingsFromDB() {
    this.state.loadingSavedItems = true;
    this.renderSavedItems(); // Show loading state

    try {
      const response = await fetch(`${this.apiUrl}/listings`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.state.savedListings = data.listings.map((listing) => ({
          ...listing,
          keywords: listing.keywords || [],
          sources:
            typeof listing.sources === 'string' ? JSON.parse(listing.sources) : listing.sources,
          images: (listing.images || []).map((img) => ({
            id: img.id,
            data: img.data,
            url: img.data,
            isBlurry: img.isBlurry,
            status: 'ready',
          })),
        }));
        // Initialize filtered list with all listings
        this.state.filteredSavedListings = [];
      }
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      this.state.loadingSavedItems = false;
      this.filterSavedItems(); // Use filterSavedItems to render (which calls renderSavedItems)
      this.loadDashboardMetrics(true);
      this.updateBottomNavBadges();
    }
  },

  async loadSavedItems() {
    return this.loadListingsFromDB();
  },

  // Event listeners
  attachEventListeners() {
    // Image uploader
    const uploader = document.getElementById('imageUploader');
    const input = document.getElementById('imageInput');

    uploader.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => this.handleImageUpload(e));

    // Drag and drop
    uploader.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploader.style.borderColor = 'var(--accent-indigo)';
    });

    uploader.addEventListener('dragleave', () => {
      uploader.style.borderColor = 'var(--border-color)';
    });

    uploader.addEventListener('drop', (e) => {
      e.preventDefault();
      uploader.style.borderColor = 'var(--border-color)';
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      this.processFiles(files);
    });

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', () => this.generateListing());

    // Platform selectors - sync input and output selectors
    const platformInputSelect = document.getElementById('platformSelectInput');
    const platformOutputSelect = document.getElementById('platformSelect');

    if (platformInputSelect) {
      platformInputSelect.addEventListener('change', () => {
        // Sync to output selector if it exists
        if (platformOutputSelect) {
          platformOutputSelect.value = platformInputSelect.value;
        }
      });
    }

    if (platformOutputSelect) {
      platformOutputSelect.addEventListener('change', () => {
        // Sync back to input selector
        if (platformInputSelect) {
          platformInputSelect.value = platformOutputSelect.value;
        }
        // Apply format to current listing
        if (this.state.currentListing) {
          this.applyPlatformFormat(platformOutputSelect.value);
        }
      });
    }

    // Settings
    document.getElementById('settingAutoDownload').addEventListener('change', (e) => {
      this.state.settings.autoDownloadZip = e.target.checked;
      this.saveSettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Ctrl+S for save even in inputs
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            if (this.state.currentListing) {
              this.saveListing();
              this.showToast('Saving...', 'info');
            }
          }
        }
        return;
      }

      // Global shortcuts (only when not in input fields)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'g':
          case 'G':
            e.preventDefault();
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn && !generateBtn.disabled) {
              this.generateListing();
            }
            break;
          case 's':
          case 'S':
            e.preventDefault();
            if (this.state.currentListing) {
              this.saveListing();
            }
            break;
          case 'n':
          case 'N':
            e.preventDefault();
            if (this.state.isAuthenticated) {
              this.navigateToApp('newItem');
              this.showInitialState();
            }
            break;
        }
      }

      // Escape key to close modals
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach((modal) => {
          const closeBtn = modal.querySelector('.modal-close');
          if (closeBtn) closeBtn.click();
        });
      }
    });
  },

  // Setup form validation
  setupFormValidation() {
    // Email validation for auth forms
    const authEmail = document.getElementById('authEmail');
    if (authEmail) {
      authEmail.addEventListener('blur', () => {
        const email = authEmail.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
          authEmail.style.borderColor = 'var(--error)';
        } else {
          authEmail.style.borderColor = '';
        }
      });
      authEmail.addEventListener('input', () => {
        if (authEmail.style.borderColor === 'var(--error)') {
          const email = authEmail.value.trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || emailRegex.test(email)) {
            authEmail.style.borderColor = '';
          }
        }
      });
    }

    // Password validation for auth forms
    const authPassword = document.getElementById('authPassword');
    if (authPassword) {
      authPassword.addEventListener('blur', () => {
        const password = authPassword.value;
        if (password && password.length < 6) {
          authPassword.style.borderColor = 'var(--error)';
        } else {
          authPassword.style.borderColor = '';
        }
      });
      authPassword.addEventListener('input', () => {
        if (authPassword.style.borderColor === 'var(--error)') {
          const password = authPassword.value;
          if (!password || password.length >= 6) {
            authPassword.style.borderColor = '';
          }
        }
      });
    }

    // Title validation (maxlength is already set, just add visual feedback)
    const outputTitle = document.getElementById('outputTitle');
    if (outputTitle) {
      outputTitle.addEventListener('input', () => {
        const maxLength = parseInt(outputTitle.getAttribute('maxlength') || '80');
        if (outputTitle.value.length >= maxLength) {
          outputTitle.style.borderColor = 'var(--warning)';
        } else {
          outputTitle.style.borderColor = '';
        }
      });
    }

    // Description validation
    const outputDescription = document.getElementById('outputDescription');
    if (outputDescription) {
      outputDescription.addEventListener('input', () => {
        const maxLength = parseInt(outputDescription.getAttribute('maxlength') || '5000');
        if (outputDescription.value.length >= maxLength) {
          outputDescription.style.borderColor = 'var(--warning)';
        } else {
          outputDescription.style.borderColor = '';
        }
      });
    }
  },

  // Handle image upload
  async handleImageUpload(event) {
    const files = Array.from(event.target.files);
    await this.processFiles(files);
  },

  // Real blur detection using Laplacian variance
  async detectBlur(imageFile) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Calculate Laplacian variance
          let variance = 0;
          let mean = 0;
          const data = imageData.data;
          const width = imageData.width;
          const height = imageData.height;

          // Convert to grayscale and calculate Laplacian
          const laplacian = [];
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              const idx = (y * width + x) * 4;
              const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
              const grayUp =
                (data[((y - 1) * width + x) * 4] +
                  data[((y - 1) * width + x) * 4 + 1] +
                  data[((y - 1) * width + x) * 4 + 2]) /
                3;
              const grayDown =
                (data[((y + 1) * width + x) * 4] +
                  data[((y + 1) * width + x) * 4 + 1] +
                  data[((y + 1) * width + x) * 4 + 2]) /
                3;
              const grayLeft =
                (data[(y * width + (x - 1)) * 4] +
                  data[(y * width + (x - 1)) * 4 + 1] +
                  data[(y * width + (x - 1)) * 4 + 2]) /
                3;
              const grayRight =
                (data[(y * width + (x + 1)) * 4] +
                  data[(y * width + (x + 1)) * 4 + 1] +
                  data[(y * width + (x + 1)) * 4 + 2]) /
                3;

              const laplacianValue = Math.abs(4 * gray - grayUp - grayDown - grayLeft - grayRight);
              laplacian.push(laplacianValue);
              mean += laplacianValue;
            }
          }

          mean /= laplacian.length;

          // Calculate variance
          for (let i = 0; i < laplacian.length; i++) {
            variance += Math.pow(laplacian[i] - mean, 2);
          }
          variance /= laplacian.length;

          // Threshold: values below 100 typically indicate blur
          resolve(variance < 100);
        } catch (error) {
          // If detection fails, assume not blurry
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(imageFile);
    });
  },

  // Resize image to optimize for Gemini API (2400px max dimension)
  async resizeImage(file, maxDimension) {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const targetDimension = maxDimension || this.imageConfig.maxDimension || 1600;
      const quality = this.imageConfig.jpegQuality || 0.85;

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        // Only resize if image exceeds maxDimension
        if (width <= targetDimension && height <= targetDimension) {
          // Image is already small enough, return original
          resolve(file);
          return;
        }

        if (width > height) {
          if (width > targetDimension) {
            height = Math.round((height * targetDimension) / width);
            width = targetDimension;
          }
        } else {
          if (height > targetDimension) {
            width = Math.round((width * targetDimension) / height);
            height = targetDimension;
          }
        }

        // Set canvas dimensions and draw
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
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
          quality // Quality setting
        );
      };

      img.onerror = () => resolve(file); // Return original on error
      img.src = URL.createObjectURL(file);
    });
  },

  // Process uploaded files
  async processFiles(files) {
    const totalFiles = files.length;
    let processedCount = 0;

    // Show batch progress if multiple files
    if (totalFiles > 1) {
      this.showToast(`Processing ${totalFiles} images...`, 'info');
    }

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showToast(`${file.name} is not an image file`);
        processedCount++;
        continue;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        this.showToast(`${file.name} is too large. Max 10MB.`);
        processedCount++;
        continue;
      }

      try {
        // Track original size
        const originalSize = file.size;

        // Resize image BEFORE processing
        const resizedFile = await this.resizeImage(file, this.imageConfig.maxDimension);
        const resizedSize = resizedFile.size;
        const sizeSaved = originalSize - resizedSize;
        const percentSaved = Math.round((sizeSaved / originalSize) * 100);

        const imageData = {
          id: Date.now() + Math.random(),
          file: resizedFile, // Use resized file
          url: URL.createObjectURL(resizedFile),
          status: 'checking',
          isBlurry: false,
          originalSize: originalSize,
          resizedSize: resizedSize,
          sizeSaved: sizeSaved,
        };

        this.state.uploadedImages.push(imageData);
        this.renderImageGrid();

        // Show resize feedback for significant reductions
        if (percentSaved > 20) {
          console.log(
            `Resized ${file.name}: ${Math.round(originalSize / 1024)}KB -> ${Math.round(resizedSize / 1024)}KB (${percentSaved}% saved)`
          );
        }

        // Real blur detection using Laplacian variance
        this.detectBlur(imageData.file)
          .then((isBlurry) => {
            imageData.status = 'ready';
            imageData.isBlurry = isBlurry;
            this.renderImageGrid();
            this.updateGenerateButton();

            // Check image quality and condition with AI (cached for faster generation)
            this.checkImageQuality(imageData).catch((err) => {
              console.error('Quality check error:', err);
              // Don't block on quality check failure
            });
          })
          .catch(() => {
            // If detection fails, assume not blurry
            imageData.status = 'ready';
            imageData.isBlurry = false;
            this.renderImageGrid();
            this.updateGenerateButton();
          });

        processedCount++;
      } catch (error) {
        console.error('Error processing image:', error);
        this.showToast(`Failed to process ${file.name}`);
        processedCount++;
      }
    }

    // Show completion message for batch uploads
    if (totalFiles > 1) {
      this.showToast(`Added ${processedCount} of ${totalFiles} images`, 'success');
    }

    this.updateGenerateButton();
  },

  // Render image grid
  renderImageGrid() {
    const grid = document.getElementById('imageGrid');

    grid.innerHTML = this.state.uploadedImages
      .map(
        (img) => `
                    <div class="image-thumbnail" style="position: relative;">
                        <img src="${img.url}" alt="Uploaded">
                        <button class="image-thumbnail-delete" onclick="app.deleteImage('${img.id}')" aria-label="Delete image">×</button>
                        ${
                          img.status === 'checking'
                            ? '<div class="image-thumbnail-status">Checking...</div>'
                            : img.isBlurry
                              ? '<div class="image-thumbnail-status warning"><span style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Blur Detected</div>'
                              : ''
                        }
                        ${
                          img.qualityScore !== undefined
                            ? `
                            <div style="position: absolute; bottom: 5px; right: 5px; background: ${
                              img.qualityScore >= 80
                                ? 'var(--success-color)'
                                : img.qualityScore >= 60
                                  ? 'var(--warning-color)'
                                  : 'var(--error-color)'
                            }; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${img.qualityScore}
                            </div>
                        `
                            : ''
                        }
                    </div>
                `
      )
      .join('');

    this.renderReviewImages();
  },

  // Delete image
  deleteImage(id) {
    // Find and revoke the object URL to prevent memory leak
    const imgToDelete = this.state.uploadedImages.find((img) => img.id === id);
    if (imgToDelete && imgToDelete.url && imgToDelete.url.startsWith('blob:')) {
      URL.revokeObjectURL(imgToDelete.url);
    }
    this.state.uploadedImages = this.state.uploadedImages.filter((img) => img.id !== id);
    this.renderImageGrid();
    this.updateGenerateButton();
  },

  // Clean up all object URLs (call when resetting state)
  cleanupImageUrls() {
    this.state.uploadedImages.forEach((img) => {
      if (img.url && img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
  },

  renderReviewImages(images = null) {
    const container = document.getElementById('reviewImages');
    const countEl = document.getElementById('reviewImageCount');
    if (!container) return;

    const sourceImages =
      Array.isArray(images) && images.length ? images : this.state.uploadedImages;

    if (!sourceImages || sourceImages.length === 0) {
      container.innerHTML =
        '<p style="color: var(--text-muted); font-size: 0.9rem;">No photos yet. Add a few shots to help AI understand your item.</p>';
      if (countEl) countEl.textContent = '0 photos';
      return;
    }

    container.innerHTML = sourceImages
      .map((img, index) => {
        const url = img.url || img.data || '';
        return `
                        <div class="review-image">
                            <img src="${url}" alt="Listing photo ${index + 1}">
                            <span>${index + 1}</span>
                        </div>
                    `;
      })
      .join('');

    if (countEl) {
      const total = sourceImages.length;
      countEl.textContent = `${total} photo${total === 1 ? '' : 's'}`;
    }
  },

  renderRecentDrafts() {
    const list = document.getElementById('recentDraftsList');
    if (!list) return;

    const draftJson = localStorage.getItem('quicklist-draft');
    if (!draftJson) {
      list.innerHTML = '<li style="color: var(--text-muted);">No drafts yet</li>';
      return;
    }

    try {
      const draft = JSON.parse(draftJson);
      const updated = draft.timestamp ? new Date(draft.timestamp) : null;
      const formattedDate = updated
        ? updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Recently';
      const locationInfo = draft.location ? ` · ${draft.location}` : '';
      list.innerHTML = `
                        <li>
                            <div>
                                <strong>${draft.platform ? draft.platform.toUpperCase() : 'Draft'}</strong>
                                <p style="color: var(--text-muted); font-size: 0.85rem;">${draft.imageCount || 0} photo${draft.imageCount === 1 ? '' : 's'} · ${formattedDate}${locationInfo}</p>
                            </div>
                            <button class="btn btn-secondary btn-small" type="button" onclick="app.resumeDraftFromWizard()">Resume</button>
                        </li>
                    `;
    } catch (error) {
      console.warn('Failed to render drafts:', error);
      list.innerHTML = '<li style="color: var(--text-muted);">No drafts yet</li>';
    }
  },

  resumeDraftFromWizard() {
    this.navigateToApp('newItem');
    const draft = this.loadDraft();
    if (draft) {
      this.showToast('Draft settings restored. Upload saved photos to continue.', 'info');
    } else {
      this.showToast('No draft available yet.', 'warning');
    }
    this.setWizardPhase('photos');
    this.renderRecentDrafts();
  },

  toggleVoiceInput(fieldId, button) {
    if (!button) return;

    const stop = () => {
      button.classList.remove('listening');
      button.setAttribute('aria-pressed', 'false');
      if (typeof this.stopVoiceInput === 'function') {
        this.stopVoiceInput();
      }
    };

    if (button.classList.contains('listening')) {
      stop();
      return;
    }

    document.querySelectorAll('.voice-input-button.listening').forEach((btn) => {
      btn.classList.remove('listening');
      btn.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('listening');
    button.setAttribute('aria-pressed', 'true');

    if (typeof this.startVoiceInput === 'function') {
      this.startVoiceInput(fieldId);
    } else {
      this.showToast('Voice input not supported on this device', 'error');
      stop();
    }
  },

  async useCurrentLocation() {
    const input = document.getElementById('itemLocation');
    const btn = document.getElementById('locationBtn');

    if (!input) return;
    if (!navigator.geolocation || typeof this.getLocationForListing !== 'function') {
      this.showToast('Location not supported', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Locating...';
    }

    try {
      const location = await this.getLocationForListing();
      if (location) {
        input.value =
          location.formatted || [location.city, location.country].filter(Boolean).join(', ');
        this.showToast('Location added', 'success');
      } else {
        this.showToast('Unable to fetch location', 'error');
      }
    } catch (error) {
      this.showToast('Location permission denied', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Use my location';
      }
    }
  },

  updateDamageSummary() {
    const summary = document.getElementById('damageSummary');
    if (!summary) return;

    const analysis = this.state.damageAnalysis;
    if (!analysis) {
      summary.style.display = 'none';
      summary.textContent = '';
      return;
    }

    const condition = analysis.overallCondition
      ? `<strong>${analysis.overallCondition}</strong>`
      : '';
    if (analysis.damageFound && analysis.damages?.length) {
      summary.innerHTML = `
                        ${condition ? condition + ' · ' : ''}⚠️ ${analysis.damages.length} issue${analysis.damages.length === 1 ? '' : 's'} detected.
                        <br>
                        <small style="color: var(--text-muted);">Tap Analyze again after re-taking close-ups.</small>
                    `;
    } else {
      summary.innerHTML = `${condition ? condition + ' · ' : ''}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>No visible damage detected`;
    }
    summary.style.display = 'block';
  },

  // Feature 3: Check image quality with AI
  async checkImageQuality(imageData) {
    try {
      // Convert file to base64
      const base64 = await this.fileToBase64(imageData.file);

      const response = await fetch(`${this.apiUrl}/api/analyze-image-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        throw new Error('Quality analysis failed');
      }

      const quality = await response.json();

      // Store quality data with image
      imageData.qualityScore = quality.overallScore;
      imageData.qualityData = quality;

      // Show warning if quality is poor
      if (quality.overallScore < 60 && !imageData.qualityWarningShown) {
        imageData.qualityWarningShown = true;
        this.showQualityWarning(imageData, quality);
      }

      // Update the image grid to show quality score
      this.renderImageGrid();

      return quality;
    } catch (error) {
      console.error('Quality check error:', error);
      // Don't block the upload process if quality check fails
      return null;
    }
  },

  // Show quality warning modal
  showQualityWarning(imageData, quality) {
    const modal = document.createElement('div');
    modal.className = 'modal quality-warning-modal';
    modal.style.display = 'block';
    modal.innerHTML = `
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h3>⚠️ Image Quality Issues Detected</h3>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="quality-score-display" style="text-align: center; margin: 20px 0;">
                                <h2 style="color: ${quality.overallScore >= 80 ? 'var(--success-color)' : quality.overallScore >= 60 ? 'var(--warning-color)' : 'var(--error-color)'}">
                                    Score: ${quality.overallScore}/100
                                </h2>
                            </div>

                            <img src="${imageData.url}" style="max-width: 100%; max-height: 300px; display: block; margin: 0 auto 20px;">

                            <div class="quality-breakdown" style="margin: 20px 0;">
                                <h4>Quality Breakdown:</h4>
                                ${this.renderQualityBar('Sharpness', quality.sharpness)}
                                ${this.renderQualityBar('Lighting', quality.lighting)}
                                ${this.renderQualityBar('Background', quality.background)}
                                ${this.renderQualityBar('Composition', quality.composition)}
                                ${this.renderQualityBar('Angle/View', quality.angle)}
                            </div>

                            ${
                              quality.criticalIssues && quality.criticalIssues.length > 0
                                ? `
                                <div class="critical-issues" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <h4 style="color: var(--error-color);">Critical Issues:</h4>
                                    <ul style="margin: 10px 0;">
                                        ${quality.criticalIssues.map((issue) => `<li>${issue}</li>`).join('')}
                                    </ul>
                                </div>
                            `
                                : ''
                            }

                            ${
                              quality.recommendations && quality.recommendations.length > 0
                                ? `
                                <div class="recommendations" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
                                    <h4>Recommendations to Improve:</h4>
                                    <ul style="margin: 10px 0;">
                                        ${quality.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
                                    </ul>
                                </div>
                            `
                                : ''
                            }
                        </div>
                        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="app.retakePhoto('${imageData.id}')">
                                Retake Photo
                            </button>
                            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                                Use Anyway
                            </button>
                        </div>
                    </div>
                `;

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  },

  // Render quality score bar
  renderQualityBar(label, score) {
    const percentage = (score || 0) * 10;
    const color =
      percentage >= 80
        ? 'var(--success-color)'
        : percentage >= 60
          ? 'var(--warning-color)'
          : 'var(--error-color)';
    return `
                    <div style="margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>${label}</span>
                            <span>${score || 0}/10</span>
                        </div>
                        <div style="background: var(--bg-secondary); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${percentage}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
  },

  // Retake photo (removes current and prompts for new)
  retakePhoto(imageId) {
    // Remove the current image
    this.deleteImage(imageId);

    // Close the modal
    const modal = document.querySelector('.quality-warning-modal');
    if (modal) modal.remove();

    // Trigger file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.click();
  },

  // Feature 6: AI Damage Detection
  async analyzeDamage() {
    // Check authentication first
    if (!this.state.isAuthenticated || !this.state.token) {
      this.showToast('Please sign in to use damage detection', 'warning');
      this.showAuthModal();
      return;
    }

    if (this.state.uploadedImages.length === 0) {
      this.showToast('Please upload images first');
      return;
    }

    const btn = document.getElementById('analyzeDamageBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    try {
      // Convert all images to base64
      const images = await Promise.all(
        this.state.uploadedImages.map((img) => this.fileToBase64(img.file))
      );

      const response = await fetch(`${this.apiUrl}/api/analyze-damage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        throw new Error('Damage analysis failed');
      }

      const damageData = await response.json();

      // Store damage analysis
      this.state.damageAnalysis = damageData;
      this.updateDamageSummary();

      // Show damage report modal
      this.showDamageReport(damageData);
    } catch (error) {
      console.error('Damage detection error:', error);
      this.showToast('Failed to analyze damage. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  // Show damage detection report modal
  showDamageReport(damageData) {
    const modal = document.createElement('div');
    modal.className = 'modal damage-modal';
    modal.style.display = 'block';

    const conditionClass = damageData.overallCondition.toLowerCase().replace(/ /g, '-');

    modal.innerHTML = `
                    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:8px"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>Damage Detection Report</h2>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                        </div>
                        <div class="damage-report">
                            <div class="damage-summary">
                                <h3>Overall Condition Assessment</h3>
                                <div class="damage-condition-badge condition-${conditionClass}">
                                    ${damageData.overallCondition}
                                </div>
                                ${
                                  damageData.conditionJustification
                                    ? `
                                    <p style="margin-top: 1rem; color: var(--text-secondary);">
                                        ${damageData.conditionJustification}
                                    </p>
                                `
                                    : ''
                                }
                            </div>

                            ${
                              damageData.damageFound
                                ? `
                                <div class="damage-items">
                                    <h3>${damageData.damages.length} Issue${damageData.damages.length !== 1 ? 's' : ''} Detected</h3>
                                    ${damageData.damages
                                      .map(
                                        (damage, i) => `
                                        <div class="damage-item severity-${damage.severity}">
                                            <div class="damage-header">
                                                <span class="damage-type">${this.formatDamageType(damage.type)}</span>
                                                <span class="damage-severity severity-${damage.severity}">
                                                    ${damage.severity.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div class="damage-details">
                                                <p><strong>Location:</strong> ${damage.location}</p>
                                                <p><strong>Description:</strong> ${damage.description}</p>
                                                ${
                                                  damage.estimatedSize
                                                    ? `
                                                    <p><strong>Size:</strong> ${damage.estimatedSize}</p>
                                                `
                                                    : ''
                                                }
                                                ${
                                                  damage.confidence !== undefined
                                                    ? `
                                                    <p><strong>Confidence:</strong> ${Math.round(damage.confidence * 100)}%</p>
                                                `
                                                    : ''
                                                }
                                            </div>
                                        </div>
                                    `
                                      )
                                      .join('')}
                                </div>
                            `
                                : `
                                <div style="background: var(--success-color); color: white; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>No visible damage or defects detected
                                </div>
                            `
                            }

                            <div class="damage-disclosure">
                                <h4>📝 Suggested Condition Disclosure</h4>
                                <div class="damage-disclosure-text">
                                    ${damageData.conditionDisclosure}
                                </div>
                                <button class="btn btn-secondary" style="margin-top: 0.5rem;" onclick="app.addDamageDisclosure()">
                                    Add to Description
                                </button>
                            </div>

                            ${
                              damageData.recommendations && damageData.recommendations.length > 0
                                ? `
                                <div class="damage-recommendations">
                                    <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>Photo Recommendations</h4>
                                    <ul>
                                        ${damageData.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
                                    </ul>
                                </div>
                            `
                                : ''
                            }

                            ${
                              damageData.honestyScore !== undefined
                                ? `
                                <div class="honesty-score">
                                    <h4>Transparency Score</h4>
                                    <div class="honesty-score-bar">
                                        <div class="honesty-score-fill" style="width: ${damageData.honestyScore}%"></div>
                                    </div>
                                    <p>${damageData.honestyScore}/100 - ${this.getHonestyMessage(damageData.honestyScore)}</p>
                                </div>
                            `
                                : ''
                            }

                            <div class="damage-actions">
                                <button class="btn btn-secondary" onclick="app.retakePhotosForDamage()">
                                    Take New Photos
                                </button>
                                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                `;

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  },

  // Format damage type for display
  formatDamageType(type) {
    const typeMap = {
      stain: '🔴 Stain',
      tear: '⚠️ Tear/Hole',
      scratch: '〰️ Scratch',
      discoloration: '🎨 Discoloration',
      missing_part:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>Missing Part',
      structural: '🔧 Structural Damage',
      wear: '👕 Normal Wear',
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  },

  // Get honesty message based on score
  getHonestyMessage(score) {
    if (score >= 90) return 'Excellent transparency - buyers will appreciate your honesty';
    if (score >= 70) return 'Good disclosure - consider adding more detail';
    if (score >= 50) return 'Fair - some defects may not be adequately disclosed';
    return 'Needs improvement - add more defect details to avoid returns';
  },

  // Add damage disclosure to description
  addDamageDisclosure() {
    if (!this.state.damageAnalysis || !this.state.damageAnalysis.conditionDisclosure) {
      return;
    }

    const descField = document.getElementById('outputDescription');
    if (descField) {
      const currentDesc = descField.value;
      const disclosure = this.state.damageAnalysis.conditionDisclosure;

      // Add disclosure as a separate section
      const updatedDesc =
        currentDesc + (currentDesc ? '\n\n' : '') + '**Condition Notes:**\n' + disclosure;

      descField.value = updatedDesc;

      // Update text area height
      descField.style.height = 'auto';
      descField.style.height = descField.scrollHeight + 'px';

      this.showToast('Damage disclosure added to description', 'success');

      // Close the modal
      const modal = document.querySelector('.damage-modal');
      if (modal) modal.remove();
    }
  },

  getOutputListingSnapshot() {
    return {
      title: document.getElementById('outputTitle')?.value || '',
      brand: document.getElementById('outputBrand')?.value || '',
      category: document.getElementById('outputCategory')?.value || '',
      description: document.getElementById('outputDescription')?.value || '',
      condition: document.getElementById('outputCondition')?.value || '',
      rrp: document.getElementById('outputRRP')?.value || '',
      price: document.getElementById('outputPrice')?.value || '',
      keywords: this.state.currentListing?.keywords || [],
      sources: this.state.currentListing?.sources || [],
      images: this.state.currentListing?.images || this.state.uploadedImages || [],
      location: this.state.currentListing?.location || '',
    };
  },

  formatListingForPlatform(listing, platform) {
    const cleanTitle = (listing.title || '').replace(/\s+/g, ' ').trim();
    const baseDescription = (listing.description || '').trim();
    const brandLine = listing.brand ? `Brand: ${listing.brand}` : '';
    const conditionLine = listing.condition ? `Condition: ${listing.condition}` : '';
    const categoryLine = listing.category ? `Category: ${listing.category}` : '';
    const priceLine = listing.price ? `Price: ${listing.price}` : '';

    const rawKeywords = Array.isArray(listing.keywords) ? listing.keywords : [];
    const hashtagKeywords = rawKeywords
      .map((kw) => kw.replace(/\s+/g, ''))
      .filter(Boolean)
      .slice(0, 15)
      .map((kw) => `#${kw}`);

    switch ((platform || 'vinted').toLowerCase()) {
      case 'ebay': {
        const specifics = [brandLine, conditionLine, categoryLine].filter(Boolean);
        const specificsBlock = specifics.length
          ? `\n\nITEM SPECIFICS:\n${specifics.map((line) => `• ${line}`).join('\n')}`
          : '';
        return {
          ...listing,
          title: cleanTitle.slice(0, 80),
          description: `${baseDescription}${specificsBlock}`.trim(),
        };
      }
      case 'depop': {
        const depopMeta = [
          listing.condition ? `condition: ${listing.condition.toLowerCase()}` : '',
          listing.price ? `price: ${listing.price}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          ...listing,
          title: cleanTitle.toUpperCase().slice(0, 100),
          description: [baseDescription, depopMeta, hashtagKeywords.join(' ')]
            .filter(Boolean)
            .join('\n\n'),
        };
      }
      case 'facebook': {
        const meta = [priceLine, conditionLine, brandLine].filter(Boolean).join('\n');
        return {
          ...listing,
          title: cleanTitle.slice(0, 100),
          description: [cleanTitle, meta, baseDescription, hashtagKeywords.join(' ')]
            .filter(Boolean)
            .join('\n\n'),
        };
      }
      case 'gumtree': {
        return {
          ...listing,
          title: cleanTitle.slice(0, 100),
          description: baseDescription,
        };
      }
      case 'vinted':
      default: {
        return {
          ...listing,
          title: cleanTitle.slice(0, 100),
          description: [baseDescription, hashtagKeywords.join(' ')].filter(Boolean).join('\n\n'),
        };
      }
    }
  },

  applyPlatformFormat(platform) {
    if (!this.state.currentListing) return;
    const snapshot = this.getOutputListingSnapshot();
    const formatted = this.formatListingForPlatform(snapshot, platform);
    this.state.currentListing = {
      ...this.state.currentListing,
      ...formatted,
      platform,
    };
    this.displayListing(
      formatted,
      this.state.currentListing.pricingIntelligence,
      this.state.currentListing.stockImageData
    );
  },

  // Retake photos for damage documentation
  retakePhotosForDamage() {
    const modal = document.querySelector('.damage-modal');
    if (modal) modal.remove();

    this.showToast('Please take close-up photos of any damaged areas', 'info');

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.click();
  },

  // Update generate button state
  updateGenerateButton() {
    const generateBtn = document.getElementById('generateBtn');
    const analyzeDamageBtn = document.getElementById('analyzeDamageBtn');
    const hasImages = this.state.uploadedImages.length > 0;
    const allReady = this.state.uploadedImages.every((img) => img.status !== 'checking');

    generateBtn.disabled = !hasImages || !allReady;

    // Show/hide damage analysis button
    if (hasImages && allReady && analyzeDamageBtn) {
      analyzeDamageBtn.style.display = 'block';
    } else if (analyzeDamageBtn) {
      analyzeDamageBtn.style.display = 'none';
    }
  },

  // Generate listing using Gemini API
  async generateListing() {
    // Check authentication first
    if (!this.state.isAuthenticated || !this.state.token) {
      this.showToast('Please sign in to generate listings', 'warning');
      this.showAuthModal();
      return;
    }

    const btn = document.getElementById('generateBtn');
    const initialState = document.getElementById('initialState');
    const loadingState = document.getElementById('loadingState');
    const resultState = document.getElementById('resultState');
    const cancelBtn = document.getElementById('cancelGenerationBtn');

    // Show loading state
    initialState.classList.add('hidden');
    resultState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';
    this.setWizardPhase('processing');

    // Show cancel button
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }

    // Track if generation was cancelled
    this.state.generationCancelled = false;
    this.state.generationAbortController = new AbortController();

    // Animate progress steps with realistic timing
    this.animateProgressSteps();

    try {
      // Get ALL uploaded images
      const platform = this.getPlatform();
      const hint = this.getItemHint();
      const location = document.getElementById('itemLocation')?.value || '';

      // Convert all images to base64
      const base64Images = await Promise.all(
        this.state.uploadedImages.map((img) => this.fileToBase64(img.file))
      );

      // Check if cancelled during image conversion
      if (this.state.generationCancelled) {
        this.showInitialState();
        return;
      }

      // Call Gemini API with all images
      const response = await this.callGeminiAPI(base64Images, platform, hint, location);

      // Check if cancelled during API call
      if (this.state.generationCancelled) {
        this.showInitialState();
        return;
      }

      const listing = response.listing;
      const pricingIntelligence = response.pricingIntelligence;
      const stockImageData = response.stockImageData || null;
      const requiresUserSelection = response.requiresUserSelection || false;

      // If confidence is low/medium and alternatives exist, show selection modal
      if (requiresUserSelection && listing.alternatives && listing.alternatives.length > 0) {
        this.state.productAlternatives = [listing, ...listing.alternatives];
        this.state.selectedProductIndex = 0; // Default to first (best match)
        this.showProductSelectionModal(listing, listing.alternatives);
        // Don't display yet - wait for user selection
        loadingState.classList.add('hidden');
        if (cancelBtn) {
          cancelBtn.style.display = 'none';
        }
        return;
      }

      // Store the listing
      this.state.currentListing = {
        ...listing,
        images: this.state.uploadedImages,
        platform: platform,
        id: Date.now(),
        location,
        pricingIntelligence: pricingIntelligence,
        stockImageData: stockImageData,
      };

      // Display results with pricing intelligence and stock image
      this.displayListing(listing, pricingIntelligence, stockImageData);

      // Auto-save listing to database
      await this.saveListing();

      // Show result state
      loadingState.classList.add('hidden');
      resultState.classList.remove('hidden');
      this.setWizardPhase('review');
      if (cancelBtn) {
        cancelBtn.style.display = 'none';
      }

      // Auto-download if enabled
      if (this.state.settings.autoDownloadZip) {
        setTimeout(() => this.downloadZip(), 500);
      }
    } catch (error) {
      console.error('Error generating listing:', error);

      // Don't show error if user cancelled
      if (this.state.generationCancelled) {
        this.showInitialState();
        return;
      }

      // Get user-friendly error message
      const errorMessage = this.getErrorMessage(error);

      // Show error state with retry and save draft options
      loadingState.classList.add('hidden');
      loadingState.innerHTML = `
                        <div style="text-align: center; padding: 2rem;">
                            <div style="width: 48px; height: 48px; display: inline-flex; margin-bottom: 1rem; color: var(--error);"><svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                            <h2 style="color: var(--error); margin-bottom: 1rem;">Generation Failed</h2>
                            <p style="color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 500;">
                                ${errorMessage.title}
                            </p>
                            <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem;">
                                ${errorMessage.details}
                            </p>
                            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                                <button class="btn btn-primary" onclick="app.generateListing()">
                                    <span style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Retry
                                </button>
                                <button class="btn btn-secondary" onclick="app.showInitialState()">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    `;
      loadingState.classList.remove('hidden');
      if (cancelBtn) {
        cancelBtn.style.display = 'none';
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Generate Listing';
      this.state.generationAbortController = null;
    }
  },

  // Cancel generation
  cancelGeneration() {
    if (this.state.generationAbortController) {
      this.state.generationCancelled = true;
      this.state.generationAbortController.abort();
    }
    this.showInitialState();
  },

  // Get user-friendly error message
  getErrorMessage(error) {
    const message = error.message || 'An unknown error occurred';

    // Network errors
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('network')
    ) {
      return {
        title: 'Network Error',
        details:
          'Unable to connect to the server. Please check your internet connection and try again.',
      };
    }

    // API errors
    if (message.includes('API request failed') || message.includes('Gemini API')) {
      if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
        return {
          title: 'API Rate Limit Exceeded',
          details: 'Too many requests. Please wait a moment and try again.',
        };
      }
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
        return {
          title: 'Authentication Error',
          details: 'Your session may have expired. Please sign in again.',
        };
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return {
          title: 'Request Timeout',
          details: 'The request took too long. The server may be busy. Please try again.',
        };
      }
      return {
        title: 'API Error',
        details: 'The AI service encountered an error. Please try again in a moment.',
      };
    }

    // Validation errors
    if (
      message.includes('image') &&
      (message.includes('required') || message.includes('invalid'))
    ) {
      return {
        title: 'Invalid Images',
        details: 'Please ensure you have uploaded at least one valid image.',
      };
    }

    // Generic error
    return {
      title: 'Generation Failed',
      details: message.length > 100 ? message.substring(0, 100) + '...' : message,
    };
  },

  // Show initial state (helper for error recovery)
  showInitialState() {
    const initialState = document.getElementById('initialState');
    const loadingState = document.getElementById('loadingState');
    const resultState = document.getElementById('resultState');
    const cancelBtn = document.getElementById('cancelGenerationBtn');

    loadingState.classList.add('hidden');
    resultState.classList.add('hidden');
    initialState.classList.remove('hidden');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    // Clear progress timeouts
    if (this.state.progressTimeouts) {
      this.state.progressTimeouts.forEach((timeout) => clearTimeout(timeout));
      this.state.progressTimeouts = [];
    }

    // Reset loading state HTML
    loadingState.innerHTML = `
                    <h2 class="mb-3">Generating your listing...</h2>
                    <div id="progressSteps" style="margin: 2rem 0; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="progress-step" data-step="1" style="display: flex; align-items: center; gap: 0.75rem; opacity: 0.5;">
                            <span class="progress-icon" style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span class="progress-text" style="color: var(--text-primary);">Analyzing images...</span>
                        </div>
                        <div class="progress-step" data-step="2" style="display: flex; align-items: center; gap: 0.75rem; opacity: 0.5;">
                            <span class="progress-icon" style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span class="progress-text" style="color: var(--text-primary);">Identifying product...</span>
                        </div>
                        <div class="progress-step" data-step="3" style="display: flex; align-items: center; gap: 0.75rem; opacity: 0.5;">
                            <span class="progress-icon" style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span class="progress-text" style="color: var(--text-primary);">Researching prices...</span>
                        </div>
                        <div class="progress-step" data-step="4" style="display: flex; align-items: center; gap: 0.75rem; opacity: 0.5;">
                            <span class="progress-icon" style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span class="progress-text" style="color: var(--text-primary);">Generating description...</span>
                        </div>
                        <div class="progress-step" data-step="5" style="display: flex; align-items: center; gap: 0.75rem; opacity: 0.5;">
                            <span class="progress-icon" style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                            <span class="progress-text" style="color: var(--text-primary);">Finalizing listing...</span>
                        </div>
                    </div>
                    <div style="margin-top: 2rem; display: flex; justify-content: center;">
                        <button id="cancelGenerationBtn" class="btn btn-secondary" onclick="app.cancelGeneration()" style="display: none;">
                            Cancel Generation
                        </button>
                    </div>
                    <div class="skeleton skeleton-text" style="width: 60%; margin-top: 1rem;"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                    <div class="skeleton skeleton-text" style="width: 70%;"></div>
                `;

    this.state.damageAnalysis = null;
    this.updateDamageSummary();
    this.renderReviewImages();
    this.setWizardPhase('photos');
  },

  // Save draft to localStorage
  saveDraft(platform, hint, location = '') {
    try {
      const draft = {
        platform: platform || this.getPlatform(),
        hint: hint || this.getItemHint(),
        location: location || document.getElementById('itemLocation')?.value || '',
        imageCount: this.state.uploadedImages.length,
        timestamp: Date.now(),
      };
      localStorage.setItem('quicklist-draft', JSON.stringify(draft));
      this.renderRecentDrafts();
    } catch (error) {
      console.warn('Failed to save draft:', error);
    }
  },

  // Auto-save edits (debounced)
  autoSaveTimeout: null,
  autoSaveEdits() {
    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Only auto-save if we have a current listing
    if (!this.state.currentListing) return;

    // Debounce: save after 2 seconds of inactivity
    this.autoSaveTimeout = setTimeout(() => {
      try {
        const edits = {
          title: document.getElementById('outputTitle')?.value || '',
          brand: document.getElementById('outputBrand')?.value || '',
          category: document.getElementById('outputCategory')?.value || '',
          description: document.getElementById('outputDescription')?.value || '',
          condition: document.getElementById('outputCondition')?.value || '',
          rrp: document.getElementById('outputRRP')?.value || '',
          price: document.getElementById('outputPrice')?.value || '',
          timestamp: Date.now(),
        };
        localStorage.setItem('quicklist-edits', JSON.stringify(edits));

        // Show subtle indicator (optional - can be removed if too noisy)
        const indicator = document.getElementById('autoSaveIndicator');
        if (indicator) {
          indicator.textContent = 'Saved';
          indicator.style.opacity = '1';
          setTimeout(() => {
            if (indicator) indicator.style.opacity = '0';
          }, 1000);
        }
      } catch (error) {
        console.warn('Failed to auto-save edits:', error);
      }
    }, 2000);
  },

  // Load saved edits
  loadSavedEdits() {
    try {
      const editsJson = localStorage.getItem('quicklist-edits');
      if (!editsJson) return;

      const edits = JSON.parse(editsJson);
      const editAge = Date.now() - edits.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Only load edits if they're less than 24 hours old
      if (editAge > maxAge) {
        localStorage.removeItem('quicklist-edits');
        return;
      }

      // Restore form fields if they exist and are empty
      const titleEl = document.getElementById('outputTitle');
      const brandEl = document.getElementById('outputBrand');
      const categoryEl = document.getElementById('outputCategory');
      const descEl = document.getElementById('outputDescription');
      const conditionEl = document.getElementById('outputCondition');
      const rrpEl = document.getElementById('outputRRP');
      const priceEl = document.getElementById('outputPrice');

      if (titleEl && !titleEl.value && edits.title) titleEl.value = edits.title;
      if (brandEl && !brandEl.value && edits.brand) brandEl.value = edits.brand;
      if (categoryEl && !categoryEl.value && edits.category) categoryEl.value = edits.category;
      if (descEl && !descEl.value && edits.description) descEl.value = edits.description;
      if (conditionEl && !conditionEl.value && edits.condition) conditionEl.value = edits.condition;
      if (rrpEl && !rrpEl.value && edits.rrp) rrpEl.value = edits.rrp;
      if (priceEl && !priceEl.value && edits.price) priceEl.value = edits.price;

      // Update character counts
      if (titleEl) this.updateCharCount('title');
      if (descEl) this.updateCharCount('description');
    } catch (error) {
      console.warn('Failed to load saved edits:', error);
    }
  },

  // Clear saved edits (called when listing is saved or cleared)
  clearSavedEdits() {
    try {
      localStorage.removeItem('quicklist-edits');
    } catch (error) {
      console.warn('Failed to clear saved edits:', error);
    }
  },

  // Save draft from error state
  saveDraftFromError() {
    const platform = this.getPlatform();
    const hint = this.getItemHint();
    const location = document.getElementById('itemLocation')?.value || '';
    this.saveDraft(platform, hint, location);
    this.showToast('Draft saved! Your images and settings have been saved.', 'success');
    this.showInitialState();
  },

  // Clear draft
  clearDraft() {
    try {
      localStorage.removeItem('quicklist-draft');
      this.renderRecentDrafts();
    } catch (error) {
      console.warn('Failed to clear draft:', error);
    }
  },

  // Load draft on page load (only when in app view)
  loadDraft() {
    try {
      // Only load draft if we're in the app view
      const appView = document.getElementById('appView');
      if (!appView || appView.classList.contains('hidden')) {
        return null;
      }

      const draftJson = localStorage.getItem('quicklist-draft');
      if (!draftJson) return null;

      const draft = JSON.parse(draftJson);
      const draftAge = Date.now() - draft.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      // Only load draft if it's less than 7 days old
      if (draftAge > maxAge) {
        localStorage.removeItem('quicklist-draft');
        return null;
      }

      // Restore platform and hint (only if elements exist)
      const platformSelect = document.getElementById('platformSelect');
      const itemHint = document.getElementById('itemHint');
      const itemLocation = document.getElementById('itemLocation');

      if (draft.platform && platformSelect) {
        platformSelect.value = draft.platform;
      }
      if (draft.hint && itemHint) {
        itemHint.value = draft.hint;
      } else if (draft.hint) {
        const itemModelFallback = document.getElementById('itemModel');
        if (itemModelFallback) {
          itemModelFallback.value = draft.hint;
        }
      }
      if (draft.location && itemLocation) {
        itemLocation.value = draft.location;
      }

      // Draft system disabled - listings auto-save on generation
      // No toast notification needed

      this.renderRecentDrafts();
      return draft;
    } catch (error) {
      console.warn('Failed to load draft:', error);
      return null;
    }
  },

  // Get selected listing personality
  getSelectedPersonality() {
    const select = document.getElementById('personalitySelect');
    return select ? select.value : 'standard';
  },

  // Update personality dropdown based on user subscription tier
  async updatePersonalityDropdown() {
    const select = document.getElementById('personalitySelect');
    if (!select) return;

    // Default to free tier
    let userTier = 'free';

    // Try to get user's subscription tier
    if (this.state.token) {
      try {
        const response = await fetch(`${this.apiUrl}/subscription/status`, {
          headers: {
            Authorization: `Bearer ${this.state.token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          userTier = data.subscription?.planType || 'free';
        }
      } catch (error) {
        console.warn('Failed to fetch subscription status for personality dropdown');
      }
    }

    // Tier hierarchy: free < starter < casual < pro < business/max
    const tierLevels = { free: 0, starter: 1, casual: 2, pro: 3, business: 4, max: 4 };
    const userLevel = tierLevels[userTier] || 0;

    // Enable/disable options based on tier
    const options = select.querySelectorAll('option');
    options.forEach((option) => {
      const requiredTier = option.dataset.tier || 'free';
      const requiredLevel = tierLevels[requiredTier] || 0;

      if (userLevel >= requiredLevel) {
        option.disabled = false;
        // Remove lock emoji from text if user has access
        option.textContent = option.textContent.replace(/^🔒\s*/, '');
      } else {
        option.disabled = true;
        // Add lock emoji if not already there
        if (!option.textContent.startsWith('🔒')) {
          option.textContent = '🔒 ' + option.textContent;
        }
      }
    });

    // Only add event listener once (check for flag)
    if (!select.dataset.listenerAttached) {
      select.addEventListener('change', () => this.updatePersonalityDescription());
      select.dataset.listenerAttached = 'true';
    }
    this.updatePersonalityDescription();

    // Also update image enhancement toggle
    this.updateImageEnhancementToggle(userTier);
  },

  // Update image enhancement toggle based on subscription tier
  updateImageEnhancementToggle(userTier = 'free') {
    const toggle = document.getElementById('imageEnhancement');
    const description = document.getElementById('enhancementDescription');
    if (!toggle) return;

    const tierLevels = { free: 0, starter: 1, casual: 2, pro: 3, business: 4, max: 4 };
    const userLevel = tierLevels[userTier] || 0;
    const requiredLevel = tierLevels['pro'] || 3; // Pro required for enhancement

    if (userLevel >= requiredLevel) {
      toggle.disabled = false;
      if (description) {
        description.textContent =
          'AI-powered image improvements, auto-tagging, OCR, and quality analysis';
      }
    } else {
      toggle.disabled = true;
      toggle.checked = false;
      if (description) {
        description.innerHTML =
          'Upgrade to <strong>Pro</strong> or <strong>Max</strong> for AI image enhancements';
      }
    }
  },

  // Handle image enhancement toggle
  toggleImageEnhancement(enabled) {
    this.state.imageEnhancementEnabled = enabled;
    console.log('Image enhancement:', enabled ? 'enabled' : 'disabled');
    // Could trigger re-analysis of uploaded images here if needed
  },

  // Update the personality description helper text
  updatePersonalityDescription() {
    const select = document.getElementById('personalitySelect');
    const description = document.getElementById('personalityDescription');
    if (!select || !description) return;

    const descriptions = {
      standard: 'Clear, balanced descriptions that work well on any marketplace',
      expert: 'Professional, fact-focused listings for serious buyers',
      punchy: 'Energetic, compelling copy that drives quick sales',
      luxe: 'Elegant, refined language for premium and designer items',
      streetwear: 'Hypebeast-style descriptions for sneakers and streetwear',
      delboy: 'Cheeky, market-trader charm with a wink and a nudge',
    };

    description.textContent = descriptions[select.value] || descriptions.standard;
  },

  // Call backend API for generation
  async callGeminiAPI(base64Images, platform, hint, location = '') {
    const personality = this.getSelectedPersonality();

    try {
      const response = await fetch(`${this.apiUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({
          images: base64Images, // Send all images
          platform,
          hint,
          location,
          personality, // Add personality to request
        }),
        signal: this.state.generationAbortController?.signal,
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          this.state.isAuthenticated = false;
          this.state.token = null;
          localStorage.removeItem('quicklist-token');
          throw new Error('Authentication failed. Please sign in again.');
        }

        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || `API request failed (${response.status})`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return {
        listing: data.listing,
        pricingIntelligence: data.pricingIntelligence,
      };
    } catch (error) {
      // Handle network errors
      if (error.name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
        throw new Error('Unable to connect to server. Please check your connection and try again.');
      }
      throw error;
    }
  },

  // Convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Animate progress steps with realistic timing
  animateProgressSteps() {
    const steps = document.querySelectorAll('.progress-step');
    if (steps.length === 0) return;

    // Clear any existing timeouts
    if (this.state.progressTimeouts) {
      this.state.progressTimeouts.forEach((timeout) => clearTimeout(timeout));
    }
    this.state.progressTimeouts = [];

    // Realistic timing: steps get progressively slower as they represent longer operations
    const timings = [500, 1500, 2500, 4000, 5500]; // Total ~14 seconds

    steps.forEach((step, index) => {
      // Reset step to initial state
      step.style.opacity = '0.5';
      step.querySelector('.progress-icon').innerHTML =
        '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

      // Animate step activation
      const timeout = setTimeout(
        () => {
          if (!this.state.generationCancelled) {
            step.style.opacity = '1';
            step.style.transition = 'opacity 0.3s ease-in-out';
            step.querySelector('.progress-icon').innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="var(--success)" stroke-width="2" fill="var(--success)"/><path d="M9 12L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          }
        },
        timings[index] || index * 1000
      );

      this.state.progressTimeouts.push(timeout);
    });
  },

  // Update character counts
  updateCharCounts() {
    const titleInput = document.getElementById('outputTitle');
    const descInput = document.getElementById('outputDescription');
    const titleCount = document.getElementById('titleCharCount');
    const descCount = document.getElementById('descCharCount');

    if (titleInput && titleCount) {
      titleCount.textContent = titleInput.value.length;
    }
    if (descInput && descCount) {
      descCount.textContent = descInput.value.length;
    }
  },

  // Display listing
  displayListing(listing, pricingIntelligence = null, stockImageData = null) {
    document.getElementById('outputTitle').value = listing.title || '';
    document.getElementById('outputBrand').value = listing.brand || '';
    document.getElementById('outputCategory').value = listing.category || '';
    const locationInput = document.getElementById('itemLocation');
    if (locationInput) {
      const locationValue = listing.location || this.state.currentListing?.location || '';
      if (locationValue) {
        locationInput.value = locationValue;
      }
    }

    // Handle description with optional damage analysis
    let description = listing.description || '';

    // If damage analysis exists and has a disclosure, append it
    if (
      this.state.damageAnalysis &&
      this.state.damageAnalysis.conditionDisclosure &&
      this.state.damageAnalysis.damageFound
    ) {
      // Check if damage disclosure is not already in description
      if (!description.includes('**Condition Notes:**')) {
        description += '\n\n**Condition Notes:**\n' + this.state.damageAnalysis.conditionDisclosure;
      }

      // Update condition field if damage analysis suggests a different condition
      if (this.state.damageAnalysis.overallCondition) {
        document.getElementById('outputCondition').value =
          this.state.damageAnalysis.overallCondition;
      } else {
        document.getElementById('outputCondition').value = listing.condition || '';
      }
    } else {
      document.getElementById('outputCondition').value = listing.condition || '';
    }

    document.getElementById('outputDescription').value = description;
    document.getElementById('outputRRP').value = listing.rrp || '';
    document.getElementById('outputPrice').value = listing.price || '';

    const reviewImages =
      listing.images && listing.images.length > 0 ? listing.images : this.state.uploadedImages;
    this.renderReviewImages(reviewImages);
    this.updateDamageSummary();

    // Load saved edits (will only restore if fields are empty)
    this.loadSavedEdits();

    // Update character counts
    this.updateCharCounts();

    // Display pricing intelligence if available
    if (pricingIntelligence) {
      this.displayPricingIntelligence(pricingIntelligence, listing);
    }

    // Add input listeners for live character count updates and auto-save
    const titleEl = document.getElementById('outputTitle');
    const descEl = document.getElementById('outputDescription');

    if (titleEl) {
      titleEl.addEventListener('input', () => {
        this.updateCharCounts();
        this.autoSaveEdits();
      });
    }

    if (descEl) {
      descEl.addEventListener('input', () => {
        this.updateCharCounts();
        this.autoSaveEdits();
      });
    }

    // Add auto-save listeners to all editable fields
    const fields = ['outputBrand', 'outputCategory', 'outputCondition', 'outputRRP', 'outputPrice'];
    fields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) {
        // Remove existing listeners by cloning (clean slate)
        const newField = field.cloneNode(true);
        field.parentNode.replaceChild(newField, field);
        // Add new listener
        document.getElementById(fieldId).addEventListener('input', () => this.autoSaveEdits());
      }
    });

    // Keywords
    const keywordsContainer = document.getElementById('keywordsTags');
    keywordsContainer.innerHTML = (listing.keywords || [])
      .map((kw) => `<span class="tag">${kw}</span>`)
      .join('');

    // Sources
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = (listing.sources || [])
      .map((src) => `<li><a href="${src.url}" target="_blank">${src.title || src.url}</a></li>`)
      .join('');

    // Show pricing intelligence if available and platform is eBay
    const pricingSection = document.getElementById('pricingIntelligenceSection');
    const pricingCard = document.getElementById('pricingIntelligenceCard');
    const platform = this.getPlatform();

    const platformSelect = document.getElementById('platformSelect');
    if (platformSelect && listing.platform) {
      platformSelect.value = listing.platform;
    }

    if (pricingIntelligence && platform === 'ebay') {
      pricingSection.style.display = 'block';

      let html = '';

      if (pricingIntelligence.avgSoldPrice) {
        html += `
                            <div class="pricing-stat">
                                <span class="pricing-stat-label">Average Sold Price</span>
                                <span class="pricing-stat-value">${pricingIntelligence.avgSoldPrice}</span>
                            </div>
                        `;
      }

      if (pricingIntelligence.priceRange) {
        html += `
                            <div class="pricing-stat">
                                <span class="pricing-stat-label">Price Range</span>
                                <span class="pricing-stat-value">${pricingIntelligence.priceRange.min} - ${pricingIntelligence.priceRange.max}</span>
                            </div>
                        `;
      }

      html += `
                        <div class="pricing-stat">
                            <span class="pricing-stat-label">Sold Listings Found</span>
                            <span class="pricing-stat-value">${pricingIntelligence.soldCount || 0}</span>
                        </div>
                        <div class="pricing-stat">
                            <span class="pricing-stat-label">Active Competitors</span>
                            <span class="pricing-stat-value">${pricingIntelligence.competitorCount || 0}</span>
                        </div>
                    `;

      if (pricingIntelligence.recommendations && pricingIntelligence.recommendations.length > 0) {
        html += '<div style="margin-top: 1rem;"><strong>Recommendations:</strong></div>';
        pricingIntelligence.recommendations.forEach((rec) => {
          const priceMatch = rec.match(/£(\d+)/);
          const price = priceMatch ? priceMatch[1] : null;

          html += `
                                <div class="pricing-recommendation" onclick="app.useRecommendedPrice('${price}')">
                                    <div class="pricing-recommendation-title">${rec}</div>
                                    ${price ? '<div class="pricing-recommendation-desc">Click to use this price</div>' : ''}
                                </div>
                            `;
        });
      }

      pricingCard.innerHTML = html;
    } else {
      pricingSection.style.display = 'none';
    }

    // Show Post to eBay button if platform is eBay
    const postBtn = document.getElementById('postToEbayBtn');
    if (platform === 'ebay') {
      postBtn.style.display = 'block';
    } else {
      postBtn.style.display = 'none';
    }

    // Display stock image if found
    this.displayStockImage(stockImageData || listing.stockImageData);
  },

  // Display stock image section
  displayStockImage(stockImageData) {
    // Find or create stock image section
    let stockImageSection = document.getElementById('stockImageSection');
    if (!stockImageSection) {
      const resultState = document.getElementById('resultState');
      if (resultState) {
        stockImageSection = document.createElement('div');
        stockImageSection.id = 'stockImageSection';
        stockImageSection.className = 'result-card';
        stockImageSection.style.marginTop = '1.5rem';
        resultState.appendChild(stockImageSection);
      } else {
        return;
      }
    }

    if (!stockImageData || !stockImageData.stockImageUrl) {
      stockImageSection.style.display = 'none';
      return;
    }

    stockImageSection.style.display = 'block';
    const confidenceBadge =
      stockImageData.confidence === 'HIGH'
        ? '<span style="background: var(--success); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">Verified</span>'
        : '';
    const sourceText = stockImageData.source ? ` from ${stockImageData.source}` : '';

    stockImageSection.innerHTML = `
                    <h3 style="margin-bottom: 1rem; display: flex; align-items: center;">
                        Official Stock Image Found${confidenceBadge}
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 1rem;">
                        <div>
                            <img src="${stockImageData.stockImageUrl}" 
                                 alt="Stock image" 
                                 style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);"
                                 onerror="this.style.display='none'; document.getElementById('stockImageError').style.display='block';">
                            <div id="stockImageError" style="display: none; padding: 2rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">
                                Image failed to load
                            </div>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">
                                <strong>Source:</strong> ${stockImageData.source || 'Unknown'}${sourceText}
                            </p>
                            <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">
                                <strong>Confidence:</strong> ${stockImageData.confidence || 'LOW'}
                            </p>
                            ${
                              stockImageData.alternatives && stockImageData.alternatives.length > 0
                                ? `
                                <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">
                                    <strong>Alternatives:</strong> ${stockImageData.alternatives.length} found
                                </p>
                            `
                                : ''
                            }
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                                <button class="btn btn-primary" onclick="app.openStockImage('${stockImageData.stockImageUrl}')">
                                    View Full Size
                                </button>
                                <button class="btn btn-secondary" onclick="app.downloadStockImage('${stockImageData.stockImageUrl}', '${(document.getElementById('outputTitle').value || 'product').replace(/[^a-z0-9]/gi, '_')}')">
                                    Download Image
                                </button>
                                ${
                                  stockImageData.alternatives &&
                                  stockImageData.alternatives.length > 0
                                    ? `
                                    <button class="btn btn-secondary" onclick="app.showStockImageAlternatives(${JSON.stringify(stockImageData.alternatives).replace(/"/g, '&quot;')})">
                                        View Alternatives
                                    </button>
                                `
                                    : ''
                                }
                            </div>
                        </div>
                    </div>
                `;
  },

  // Open stock image in new tab
  openStockImage(url) {
    window.open(url, '_blank');
  },

  // Download stock image
  async downloadStockImage(url, filename) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${filename}_stock.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      this.showToast('Stock image downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      this.showToast('Failed to download image', 'error');
    }
  },

  // Feature 4 & 5: Display pricing intelligence
  displayPricingIntelligence(pricingData, listing) {
    if (!pricingData) return;

    // Find or create pricing section
    let pricingSection = document.getElementById('pricingIntelligenceSection');
    if (!pricingSection) {
      const resultState = document.getElementById('resultState');
      if (resultState) {
        pricingSection = document.createElement('div');
        pricingSection.id = 'pricingIntelligenceSection';
        pricingSection.className = 'result-card';
        pricingSection.style.marginTop = '1.5rem';
        resultState.appendChild(pricingSection);
      } else {
        return;
      }
    }

    const hasValidData = pricingData.soldCount > 0;
    const predictedPrice = listing.pricingConfidence
      ? {
          recommendedPrice: parseFloat(listing.price.replace('£', '')),
          confidence: listing.pricingConfidence,
          reasoning: listing.pricingReasoning,
          marketInsights: listing.marketInsights,
        }
      : null;

    pricingSection.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:6px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>eBay Pricing Intelligence
                            ${hasValidData ? `<span style="font-size: 0.8rem; color: var(--text-muted);">(${pricingData.totalResults} listings analyzed)</span>` : ''}
                        </h3>
                    </div>

                    ${
                      hasValidData
                        ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Average Sold Price</div>
                                <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">
                                    £${pricingData.soldPrices.average.toFixed(2)}
                                </div>
                            </div>
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Median Sold Price</div>
                                <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">
                                    £${pricingData.soldPrices.median.toFixed(2)}
                                </div>
                            </div>
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Sell-Through Rate</div>
                                <div style="color: ${pricingData.sellThroughRate > 0.7 ? 'var(--success-color)' : pricingData.sellThroughRate > 0.4 ? 'var(--warning-color)' : 'var(--error-color)'}; font-size: 1.5rem; font-weight: 600;">
                                    ${(pricingData.sellThroughRate * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Price Range</div>
                                <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">
                                    £${pricingData.soldPrices.min.toFixed(0)}-${pricingData.soldPrices.max.toFixed(0)}
                                </div>
                            </div>
                        </div>

                        ${
                          predictedPrice
                            ? `
                            <div style="background: linear-gradient(135deg, var(--accent-indigo), var(--accent-purple)); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                                <h4 style="margin: 0 0 1rem 0; color: white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>AI-Optimized Pricing</h4>
                                <div style="display: flex; align-items: center; gap: 2rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="color: rgba(255,255,255,0.8); font-size: 0.85rem; margin-bottom: 0.25rem;">Recommended Price</div>
                                        <div style="color: white; font-size: 2rem; font-weight: 700;">
                                            £${predictedPrice.recommendedPrice.toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style="color: rgba(255,255,255,0.8); font-size: 0.85rem; margin-bottom: 0.25rem;">Confidence</div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <div style="background: rgba(255,255,255,0.2); height: 8px; width: 100px; border-radius: 4px; overflow: hidden;">
                                                <div style="background: white; height: 100%; width: ${predictedPrice.confidence}%; transition: width 0.3s;"></div>
                                            </div>
                                            <span style="color: white; font-weight: 600;">${predictedPrice.confidence}%</span>
                                        </div>
                                    </div>
                                </div>
                                ${
                                  predictedPrice.marketInsights
                                    ? `
                                    <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
                                        <span style="background: rgba(255,255,255,0.2); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">
                                            Demand: ${predictedPrice.marketInsights.demand}
                                        </span>
                                        <span style="background: rgba(255,255,255,0.2); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">
                                            Competition: ${predictedPrice.marketInsights.competition}
                                        </span>
                                        <span style="background: rgba(255,255,255,0.2); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">
                                            ${predictedPrice.marketInsights.recommendedAction}
                                        </span>
                                    </div>
                                `
                                    : ''
                                }
                            </div>
                        `
                            : ''
                        }

                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Pricing Strategy Options</h4>
                            <div style="display: grid; gap: 0.75rem;">
                                ${pricingData.pricePoints
                                  .map(
                                    (pp) => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; transition: background 0.2s;"
                                         onclick="document.getElementById('outputPrice').value = '£${pp.price.toFixed(2)}'; app.showToast('Price updated to £${pp.price.toFixed(2)}', 'success');">
                                        <div style="display: flex; align-items: center; gap: 1rem;">
                                            <div>
                                                <div style="color: var(--text-primary); font-weight: 600;">£${pp.price.toFixed(2)}</div>
                                                <div style="color: var(--text-muted); font-size: 0.85rem;">${pp.label}</div>
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="color: ${pp.sellProbability > 0.7 ? 'var(--success-color)' : pp.sellProbability > 0.5 ? 'var(--warning-color)' : 'var(--text-muted)'}; font-weight: 600;">
                                                ${(pp.sellProbability * 100).toFixed(0)}%
                                            </div>
                                            <div style="color: var(--text-muted); font-size: 0.75rem;">sell probability</div>
                                        </div>
                                    </div>
                                `
                                  )
                                  .join('')}
                            </div>
                        </div>

                        ${
                          pricingData.soldExamples && pricingData.soldExamples.length > 0
                            ? `
                            <div>
                                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recently Sold Similar Items</h4>
                                <div style="display: grid; gap: 0.5rem;">
                                    ${pricingData.soldExamples
                                      .slice(0, 3)
                                      .map(
                                        (ex) => `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                                            <a href="${ex.url}" target="_blank" style="color: var(--accent-indigo); text-decoration: none; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                ${ex.title}
                                            </a>
                                            <div style="display: flex; align-items: center; gap: 1rem; margin-left: 1rem;">
                                                <span style="color: var(--success-color); font-weight: 600;">£${ex.price}</span>
                                                <span style="color: var(--text-muted); font-size: 0.85rem;">${new Date(ex.endDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    `
                                      )
                                      .join('')}
                                </div>
                            </div>
                        `
                            : ''
                        }

                        ${
                          predictedPrice && predictedPrice.reasoning
                            ? `
                            <details style="margin-top: 1rem;">
                                <summary style="cursor: pointer; color: var(--accent-indigo); font-weight: 500;">
                                    How we calculated your price...
                                </summary>
                                <ul style="margin-top: 0.75rem; color: var(--text-muted); font-size: 0.9rem; padding-left: 1.5rem;">
                                    ${predictedPrice.reasoning.map((r) => `<li>${r}</li>`).join('')}
                                </ul>
                            </details>
                        `
                            : ''
                        }
                    `
                        : `
                        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <p>No pricing data available for this item</p>
                            <p style="font-size: 0.9rem; margin-top: 0.5rem;">Try a more generic title or select eBay as the platform</p>
                        </div>
                    `
                    }
                `;
  },

  // Show stock image alternatives
  showStockImageAlternatives(alternatives) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
                    <div class="modal-content" style="max-width: 900px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Alternative Stock Images</h2>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                            ${alternatives
                              .map(
                                (url, index) => `
                                <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                    <img src="${url}" alt="Alternative ${index + 1}" 
                                         style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;"
                                         onclick="window.open('${url}', '_blank')"
                                         onerror="this.parentElement.style.display='none'">
                                    <div style="padding: 0.5rem; text-align: center;">
                                        <button class="btn btn-secondary" style="width: 100%; font-size: 0.875rem;" 
                                                onclick="app.downloadStockImage('${url}', 'alternative_${index + 1}')">
                                            Download
                                        </button>
                                    </div>
                                </div>
                            `
                              )
                              .join('')}
                        </div>
                    </div>
                `;
    document.body.appendChild(modal);
  },

  // Use recommended price
  useRecommendedPrice(price) {
    if (price) {
      document.getElementById('outputPrice').value = `£${price}`;
      this.showToast('Price updated!');
    }
  },

  // Process batch
  // Batch processing removed - feature was non-functional with mock data
  // To implement properly, would need to:
  // 1. Process multiple images separately
  // 2. Generate listings for each
  // 3. Allow user to review/edit each before saving
  // This is a larger feature that should be planned separately

  // Show confirmation modal
  showConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    const grid = document.getElementById('confirmationGrid');

    grid.innerHTML = this.state.multipleItemsDetected
      .map(
        (item) => `
                    <div class="confirmation-item ${item.id === this.state.selectedConfirmationItem ? 'selected' : ''}"
                         onclick="app.selectConfirmationItem(${item.id})">
                        <img src="${item.image}" alt="${item.title}">
                        <div class="confirmation-item-title">${item.title}</div>
                        <div class="confirmation-item-price">${item.price}</div>
                    </div>
                `
      )
      .join('');

    modal.classList.add('active');
  },

  // Close confirmation modal
  closeConfirmationModal() {
    document.getElementById('confirmationModal').classList.remove('active');
  },

  // Select confirmation item
  selectConfirmationItem(id) {
    this.state.selectedConfirmationItem = id;
    this.showConfirmationModal(); // Re-render
  },

  // Confirm selection
  confirmSelection() {
    if (!this.state.selectedConfirmationItem) {
      this.showToast('Please select an item', 'warning');
      return;
    }
    this.closeConfirmationModal();
    this.generateListing();
  },

  // Show product selection modal (for uncertain matches)
  showProductSelectionModal(primaryMatch, alternatives) {
    const modal = document.getElementById('productSelectionModal');
    const grid = document.getElementById('productAlternativesGrid');

    const allOptions = [primaryMatch, ...alternatives];

    grid.innerHTML = allOptions
      .map(
        (option, index) => `
                    <div class="confirmation-item ${index === this.state.selectedProductIndex ? 'selected' : ''}"
                         onclick="app.selectProductAlternative(${index})"
                         style="border: 2px solid ${index === this.state.selectedProductIndex ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.2s;">
                        ${index === 0 ? '<div style="background: var(--primary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 0.5rem; display: inline-block;">Best Match</div>' : ''}
                        <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">${option.title || 'Unknown Product'}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${option.brand || 'Unknown Brand'}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${option.category || 'Unknown Category'}</div>
                        ${option.matchReason ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 0.5rem;">${option.matchReason}</div>` : ''}
                        ${option.price ? `<div style="font-weight: 600; color: var(--primary); margin-top: 0.5rem;">${option.price}</div>` : ''}
                    </div>
                `
      )
      .join('');

    modal.classList.add('active');
  },

  // Close product selection modal
  closeProductSelectionModal() {
    document.getElementById('productSelectionModal').classList.remove('active');
  },

  // Select product alternative
  selectProductAlternative(index) {
    this.state.selectedProductIndex = index;
    const primaryMatch = this.state.productAlternatives[0];
    const alternatives = this.state.productAlternatives.slice(1);
    this.showProductSelectionModal(primaryMatch, alternatives);
  },

  // Confirm product selection and display listing
  confirmProductSelection() {
    if (this.state.selectedProductIndex === undefined || !this.state.productAlternatives) {
      this.showToast('Please select a product', 'warning');
      return;
    }

    const selectedListing = this.state.productAlternatives[this.state.selectedProductIndex];
    const platform = this.getPlatform();

    // Store the selected listing
    this.state.currentListing = {
      ...selectedListing,
      images: this.state.uploadedImages,
      platform: platform,
      id: Date.now(),
      pricingIntelligence: null, // Will need to fetch if needed
    };

    // Close modal
    this.closeProductSelectionModal();

    // Display the selected listing (with stock image if available)
    const stockImageData = selectedListing.stockImageData || null;
    this.displayListing(selectedListing, null, stockImageData);

    // Show result state
    const resultState = document.getElementById('resultState');
    const loadingState = document.getElementById('loadingState');
    loadingState.classList.add('hidden');
    resultState.classList.remove('hidden');

    // Clear alternatives
    this.state.productAlternatives = null;
    this.state.selectedProductIndex = undefined;
  },

  // Copy field
  async copyField(fieldName) {
    const fieldMap = {
      title: 'outputTitle',
      brand: 'outputBrand',
      category: 'outputCategory',
      description: 'outputDescription',
      condition: 'outputCondition',
      rrp: 'outputRRP',
      price: 'outputPrice',
    };

    const element = document.getElementById(fieldMap[fieldName]);
    if (element) {
      try {
        await navigator.clipboard.writeText(element.value);
        this.showToast('Copied!');
      } catch (error) {
        // Fallback to old method for older browsers
        element.select();
        document.execCommand('copy');
        this.showToast('Copied!');
      }
    }
  },

  // Copy all
  async copyAll() {
    const title = document.getElementById('outputTitle').value;
    const brand = document.getElementById('outputBrand').value;
    const category = document.getElementById('outputCategory').value;
    const description = document.getElementById('outputDescription').value;
    const condition = document.getElementById('outputCondition').value;
    const rrp = document.getElementById('outputRRP').value;
    const price = document.getElementById('outputPrice').value;

    const allText = `
Title: ${title}
Brand: ${brand}
Category: ${category}
Condition: ${condition}
RRP: ${rrp}
Price: ${price}

Description:
${description}
                `.trim();

    try {
      await navigator.clipboard.writeText(allText);
      this.showToast('All fields copied!');
    } catch (error) {
      // Fallback to old method for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = allText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('All fields copied!');
    }
  },

  // Regenerate keywords
  async regenerateKeywords() {
    const container = document.getElementById('keywordsTags');
    container.innerHTML = '<span class="spinner"></span> Regenerating...';

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newKeywords = [
      '#fashion',
      '#vintage',
      '#preloved',
      '#sustainable',
      '#designer',
      '#bargain',
      '#quality',
      '#style',
      '#trendy',
      '#musthave',
    ];

    container.innerHTML = newKeywords.map((kw) => `<span class="tag">${kw}</span>`).join('');
  },

  // Select best image for hero (simple heuristic: first non-blurry image)
  selectBestImage() {
    const nonBlurry = this.state.uploadedImages.filter((img) => !img.isBlurry);
    return nonBlurry.length > 0 ? nonBlurry[0] : this.state.uploadedImages[0];
  },

  // Generate hero image with nanobanana or fallback
  async generateHeroImage(imageFile) {
    // Note: Add NANOBANANA_API_KEY to .env if using nanobanana service
    // For now, using fallback method
    return await this.createHeroImageFallback(imageFile);
  },

  // Fallback hero image creation
  async createHeroImageFallback(imageFile) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');

        // Create neutral studio background
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(0, 0, 1200, 1200);

        // Calculate image size to fit (80% of canvas)
        const maxSize = 960;
        let width = img.width;
        let height = img.height;
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;

        // Center image
        const x = (1200 - width) / 2;
        const y = (1200 - height) / 2;

        // Draw image with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(img, x, y, width, height);

        canvas.toBlob(resolve, 'image/jpeg', 0.95);
      };
      img.src = URL.createObjectURL(imageFile);
    });
  },

  // Fix blur in image using canvas sharpening
  async fixBlur(imageFile) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        // Apply unsharp mask for sharpening
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple sharpening kernel
        for (let i = 0; i < data.length; i += 4) {
          // Apply slight sharpening
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Increase contrast slightly
          data[i] = Math.min(255, r * 1.1);
          data[i + 1] = Math.min(255, g * 1.1);
          data[i + 2] = Math.min(255, b * 1.1);
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      };
      img.src = URL.createObjectURL(imageFile);
    });
  },

  // Auto-enhance image (brightness, contrast, color balance)
  async autoEnhanceImage(imageFile) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Calculate average brightness
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const avgBrightness = totalBrightness / (data.length / 4);
        const brightnessAdjust = 128 - avgBrightness; // Target brightness

        // Apply enhancements
        for (let i = 0; i < data.length; i += 4) {
          // Brightness adjustment
          data[i] = Math.min(255, Math.max(0, data[i] + brightnessAdjust * 0.3));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightnessAdjust * 0.3));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightnessAdjust * 0.3));

          // Contrast enhancement
          const factor = 1.1;
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      };
      img.src = URL.createObjectURL(imageFile);
    });
  },

  // Generate HTML replica of listing
  generateListingHTML() {
    // Safety check: ensure we're in the app view and form elements exist
    const titleEl = document.getElementById('outputTitle');
    const brandEl = document.getElementById('outputBrand');

    if (!titleEl || !brandEl) {
      console.warn('generateListingHTML called but form elements not found');
      return '<html><body><p>Listing data not available</p></body></html>';
    }

    const title = titleEl.value || '';
    const brand = brandEl.value || '';
    const category = document.getElementById('outputCategory')?.value || '';
    const description = document.getElementById('outputDescription')?.value || '';
    const condition = document.getElementById('outputCondition')?.value || '';
    const rrp = document.getElementById('outputRRP')?.value || '';
    const price = document.getElementById('outputPrice')?.value || '';
    const keywords = this.state.currentListing?.keywords || [];

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - QuickList AI</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 2rem;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: #1e293b;
            border-radius: 12px;
            padding: 2rem;
            border: 1px solid #334155;
        }
        h1 { color: #6366f1; margin-bottom: 1rem; font-size: 2rem; }
        .field {
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid #334155;
        }
        .field:last-child { border-bottom: none; }
        .field-label {
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 0.5rem;
            display: block;
        }
        .field-value {
            color: #f1f5f9;
            font-size: 1.1rem;
        }
        .field-value.textarea {
            white-space: pre-wrap;
            background: #0f172a;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #334155;
        }
        .copy-btn {
            background: #6366f1;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            margin-left: 0.5rem;
            transition: background 0.2s;
        }
        .copy-btn:hover { background: #4f46e5; }
        .copy-btn.copied { background: #10b981; }
        .keywords {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }
        .keyword-tag {
            background: rgba(99, 102, 241, 0.2);
            color: #6366f1;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
        
        <div class="field">
            <span class="field-label">Brand:</span>
            <span class="field-value">${brand.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="copy-btn" onclick="copyToClipboard('${brand.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">Category:</span>
            <span class="field-value">${category.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="copy-btn" onclick="copyToClipboard('${category.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">Condition:</span>
            <span class="field-value">${condition.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="copy-btn" onclick="copyToClipboard('${condition.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">RRP:</span>
            <span class="field-value">${rrp.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="copy-btn" onclick="copyToClipboard('${rrp.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">Price:</span>
            <span class="field-value">${price.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <button class="copy-btn" onclick="copyToClipboard('${price.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">Description:</span>
            <div class="field-value textarea">${description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            <button class="copy-btn" onclick="copyToClipboard('${description.replace(/'/g, "\\'").replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}')">Copy</button>
        </div>
        
        <div class="field">
            <span class="field-label">Keywords:</span>
            <div class="keywords">
                ${keywords.map((kw) => `<span class="keyword-tag">${kw.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`).join('')}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${keywords.join(', ').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;')}')">Copy All</button>
        </div>
    </div>
    
    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                event.target.textContent = 'Copied!';
                event.target.classList.add('copied');
                setTimeout(() => {
                    event.target.textContent = 'Copy';
                    event.target.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                event.target.textContent = 'Copied!';
                setTimeout(() => {
                    event.target.textContent = 'Copy';
                }, 2000);
            });
        }
    <\/script>
</body>
</html>`;
  },

  // Download ZIP
  async downloadZip() {
    const btn = document.getElementById('downloadBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing images...';

    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      const generateHero = document.getElementById('toggleHero').checked;
      const fixBlur = document.getElementById('toggleBlur').checked;
      const autoEnhance = document.getElementById('toggleEnhance').checked;

      // Add listing details as text file
      const listingText = `
Title: ${document.getElementById('outputTitle').value}
Brand: ${document.getElementById('outputBrand').value}
Category: ${document.getElementById('outputCategory').value}
Condition: ${document.getElementById('outputCondition').value}
RRP: ${document.getElementById('outputRRP').value}
Price: ${document.getElementById('outputPrice').value}
Location: ${document.getElementById('itemLocation')?.value || ''}

Description:
${document.getElementById('outputDescription').value}

Keywords:
${this.state.currentListing?.keywords?.join(', ')}
                    `.trim();

      zip.file('listing-details.txt', listingText);

      // Generate HTML replica
      zip.file('listing.html', this.generateListingHTML());

      // Process and add images
      btn.innerHTML = '<span class="spinner"></span> Processing images...';

      let bestImage = null;
      for (let i = 0; i < this.state.uploadedImages.length; i++) {
        const img = this.state.uploadedImages[i];
        let processedBlob = await fetch(img.url).then((r) => r.blob());

        // Fix blur if needed
        if (fixBlur && img.isBlurry) {
          processedBlob = await this.fixBlur(img.file);
        }

        // Auto-enhance if enabled
        if (autoEnhance) {
          processedBlob = await this.autoEnhanceImage(img.file);
        }

        imagesFolder.file(`image-${i + 1}.jpg`, processedBlob);

        // Track best image for hero
        if (!bestImage && !img.isBlurry) {
          bestImage = img.file;
        }
      }

      // Generate hero image if enabled
      if (generateHero) {
        btn.innerHTML = '<span class="spinner"></span> Generating hero image...';
        const heroImage = bestImage || this.state.uploadedImages[0].file;
        const heroBlob = await this.generateHeroImage(heroImage);
        zip.file('hero.jpg', heroBlob);
      }

      // Generate ZIP
      btn.innerHTML = '<span class="spinner"></span> Creating ZIP...';
      const content = await zip.generateAsync({ type: 'blob' });

      // Generate filename from first three words of title
      const title = document.getElementById('outputTitle').value || 'quicklist';
      const titleWords = title.trim().split(/\s+/).slice(0, 3);
      const filename =
        titleWords
          .map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase())
          .filter((word) => word.length > 0)
          .join('-') || 'quicklist';

      // Download
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast('ZIP downloaded successfully!');
      this.setWizardPhase('publish');
    } catch (error) {
      console.error('Error creating ZIP:', error);
      this.showToast('Error creating ZIP file: ' + error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span class="btn-text">Download</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-left: 4px"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  },

  // ============================================
  // EXPORT ACTIONS - Dropdown Menu Functions
  // ============================================

  toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const wasOpen = dropdown.classList.contains('show');
    
    // Close all dropdowns first
    this.closeDropdowns();
    
    // Toggle the clicked one
    if (!wasOpen) {
      dropdown.classList.add('show');
      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClick, { once: true });
      }, 0);
    }
  },

  handleOutsideClick: function(e) {
    if (!e.target.closest('.dropdown-container')) {
      window.app.closeDropdowns();
    }
  },

  closeDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  },

  // Download images only (no text files)
  async downloadImagesOnly() {
    const btn = document.getElementById('downloadBtn');
    btn.disabled = true;
    
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < this.state.uploadedImages.length; i++) {
        const img = this.state.uploadedImages[i];
        const blob = await fetch(img.url).then(r => r.blob());
        zip.file(`image-${i + 1}.jpg`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const title = document.getElementById('outputTitle').value || 'quicklist';
      const filename = title.trim().split(/\s+/).slice(0, 3).map(w => w.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(w => w).join('-') || 'quicklist';
      
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-images.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showToast('Images downloaded!');
    } catch (error) {
      this.showToast('Error downloading images: ' + error.message, 'error');
    }
    
    btn.disabled = false;
  },

  // Download text file only
  downloadTextOnly() {
    const listingText = this.getListingText();
    const blob = new Blob([listingText], { type: 'text/plain' });
    const title = document.getElementById('outputTitle').value || 'quicklist';
    const filename = title.trim().split(/\s+/).slice(0, 3).map(w => w.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(w => w).join('-') || 'quicklist';
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-listing.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('Text file downloaded!');
  },

  // Get formatted listing text
  getListingText() {
    return `
Title: ${document.getElementById('outputTitle').value || ''}
Brand: ${document.getElementById('outputBrand').value || ''}
Category: ${document.getElementById('outputCategory').value || ''}
Condition: ${document.getElementById('outputCondition').value || ''}
RRP: ${document.getElementById('outputRRP').value || ''}
Price: ${document.getElementById('outputPrice').value || ''}
Location: ${document.getElementById('itemLocation')?.value || ''}

Description:
${document.getElementById('outputDescription').value || ''}

Keywords:
${this.state.currentListing?.keywords?.join(', ') || ''}
    `.trim();
  },

  // Copy all listing details
  async copyAll() {
    const text = this.getListingText();
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Listing copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('Listing copied to clipboard!');
    }
  },

  // Copy individual field
  async copyField(field) {
    let text = '';
    switch (field) {
      case 'title':
        text = document.getElementById('outputTitle').value || '';
        break;
      case 'description':
        text = document.getElementById('outputDescription').value || '';
        break;
      case 'price':
        text = document.getElementById('outputPrice').value || '';
        break;
      case 'keywords':
        text = this.state.currentListing?.keywords?.join(', ') || '';
        break;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    }
  },

  // Native share (mobile share sheet)
  async shareNative() {
    const title = document.getElementById('outputTitle').value || 'My Listing';
    const text = this.getListingText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text
        });
        this.showToast('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.showToast('Share failed', 'error');
        }
      }
    } else {
      // Fallback: copy to clipboard
      await this.copyAll();
      this.showToast('Share not supported - copied to clipboard instead');
    }
  },

  // Email listing to user
  emailListing() {
    const title = document.getElementById('outputTitle').value || 'My Listing';
    const text = this.getListingText();
    const subject = encodeURIComponent(`Quicklist: ${title}`);
    const body = encodeURIComponent(text);
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    this.showToast('Opening email...');
  },

  // Open platform with pre-filled data
  openInPlatform(platform) {
    const title = document.getElementById('outputTitle').value || '';
    const description = document.getElementById('outputDescription').value || '';
    const price = document.getElementById('outputPrice').value || '';
    
    let url = '';
    switch (platform) {
      case 'ebay':
        // eBay sell page - they'll need to paste content
        url = 'https://www.ebay.co.uk/sl/sell';
        this.copyAll(); // Copy listing first
        this.showToast('Listing copied! Paste into eBay form.');
        break;
      case 'vinted':
        // Vinted sell page
        url = 'https://www.vinted.co.uk/items/new';
        this.copyAll();
        this.showToast('Listing copied! Paste into Vinted form.');
        break;
    }
    
    if (url) {
      window.open(url, '_blank');
    }
  },

  // Post listing to eBay
  async postToEbay() {
    if (!this.state.currentListing || !this.state.currentListing.id) {
      this.showToast('Please save the listing first');
      return;
    }

    const btn = document.getElementById('postToEbayBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Posting to eBay...';

    try {
      const response = await fetch(
        `${this.apiUrl}/listings/${this.state.currentListing.id}/post-to-ebay`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.state.token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Posting failed');
      }

      const data = await response.json();
      this.showToast('Successfully posted to eBay!');

      // Open eBay listing in new tab
      if (data.url) {
        window.open(data.url, '_blank');
      }

      // Update button
      btn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"></polyline></svg> Posted to eBay';
      btn.style.background = 'var(--success)';
      btn.disabled = true;
      this.setWizardPhase('publish');
    } catch (error) {
      console.error('Post to eBay error:', error);
      this.showToast(`Failed to post to eBay: ${error.message}`, 'error');
      btn.disabled = false;
      btn.innerHTML = 'Post to eBay';
    }
  },

  // Open Vinted and generate autofill script
  openVintedAutofill() {
    // Get all listing data
    const listingData = {
      title: document.getElementById('outputTitle').value,
      brand: document.getElementById('outputBrand').value,
      category: document.getElementById('outputCategory').value,
      description: document.getElementById('outputDescription').value,
      condition: document.getElementById('outputCondition').value,
      price: document.getElementById('outputPrice').value.replace('£', '').replace(',', ''),
      keywords: this.state.currentListing?.keywords || [],
      images: this.state.uploadedImages || [],
    };

    // Generate bookmarklet script with enhanced features
    const script = this.generateVintedBookmarklet(listingData);

    // Open Vinted in new tab
    window.open('https://www.vinted.co.uk/items/new', '_blank');

    // Show instructions modal
    this.showVintedAutofillInstructions(script, listingData.images.length);
    this.setWizardPhase('publish');
  },

  // Generate Vinted bookmarklet script - Enhanced version for Vinted's React form structure
  generateVintedBookmarklet(listingData) {
    // Escape data for JavaScript
    const escapeJS = (str) =>
      str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '');

    // Map condition to Vinted format
    const mapCondition = (condition) => {
      const cond = condition.toLowerCase();
      if (cond.includes('new with tags') || cond.includes('new')) return 'new_with_tags';
      if (cond.includes('like new') || cond.includes('excellent')) return 'new_without_tags';
      if (cond.includes('very good')) return 'very_good';
      if (cond.includes('good')) return 'good';
      if (cond.includes('satisfactory') || cond.includes('fair')) return 'satisfactory';
      return 'good';
    };

    // Extract size from title/category if present
    const extractSize = (title, category) => {
      const combined = (title + ' ' + category).toLowerCase();
      const sizePatterns = [
        /(?:size|sz)[:\s]*([0-9]+[a-z]?|[xsml]+|uk\s*[0-9]+|eu\s*[0-9]+)/i,
        /(uk|eu|us)\s*([0-9]+)/i,
        /([0-9]+)\s*(ml|fl\s*oz|oz)/i,
      ];
      for (const pattern of sizePatterns) {
        const match = combined.match(pattern);
        if (match) {
          // Return the original case from title/category
          const originalMatch = (title + ' ' + category).match(new RegExp(pattern.source, 'i'));
          if (originalMatch) return originalMatch[0].trim();
        }
      }
      return null;
    };

    // Parse Vinted category path (e.g., "Women > Clothing > Dresses")
    const parseCategoryPath = (categoryPath) => {
      if (!categoryPath) return null;
      const parts = categoryPath.split('>').map((p) => p.trim());
      return {
        main: parts[0] || null,
        sub: parts[1] || null,
        detail: parts[2] || null,
      };
    };

    // Pre-calculate values
    const conditionMapped = mapCondition(listingData.condition);
    const extractedSize = extractSize(listingData.title, listingData.category) || '';
    const categoryParts = parseCategoryPath(listingData.category);

    return `javascript:(function(){
                    const data = {
                        title: '${escapeJS(listingData.title)}',
                        brand: '${escapeJS(listingData.brand)}',
                        category: '${escapeJS(listingData.category)}',
                        categoryMain: '${categoryParts?.main ? escapeJS(categoryParts.main) : ''}',
                        categorySub: '${categoryParts?.sub ? escapeJS(categoryParts.sub) : ''}',
                        categoryDetail: '${categoryParts?.detail ? escapeJS(categoryParts.detail) : ''}',
                        description: '${escapeJS(listingData.description)}',
                        condition: '${escapeJS(listingData.condition)}',
                        price: '${listingData.price}',
                        conditionMapped: '${conditionMapped}',
                        size: '${escapeJS(extractedSize)}',
                        imageCount: ${listingData.images?.length || 0}
                    };
                    
                    let filledCount = 0;
                    const maxRetries = 10;
                    let retryCount = 0;
                    
                    // Show notification overlay
                    const showNotification = (message, type = 'info') => {
                        const notification = document.createElement('div');
                        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: ' + (type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6') + '; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-family: system-ui; font-size: 14px; max-width: 300px;';
                        notification.textContent = message;
                        document.body.appendChild(notification);
                        setTimeout(() => notification.remove(), 3000);
                    };
                    
                    // Helper to trigger React events properly
                    const setReactValue = (element, value) => {
                        if (!element) return false;
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                        
                        if (element.tagName === 'INPUT') {
                            nativeInputValueSetter.call(element, value);
                        } else if (element.tagName === 'TEXTAREA') {
                            nativeTextAreaValueSetter.call(element, value);
                        } else {
                            element.value = value;
                        }
                        
                        // Trigger React events
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                        element.dispatchEvent(inputEvent);
                        element.dispatchEvent(changeEvent);
                        
                        // Also try React's synthetic events
                        const reactInputEvent = new Event('input', { bubbles: true });
                        Object.defineProperty(reactInputEvent, 'target', { value: element, enumerable: true });
                        element.dispatchEvent(reactInputEvent);
                        
                        return true;
                    };
                    
                    // Fill field with retry logic
                    const fillField = (selectors, value, fieldName) => {
                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element && (!element.value || element.value.trim() === '')) {
                                if (setReactValue(element, value)) {
                                    filledCount++;
                                    console.log('✅ Filled ' + fieldName);
                                    return true;
                                }
                            }
                        }
                        return false;
                    };
                    
                    // Fill brand (Vinted uses searchable brand selector)
                    const fillBrand = () => {
                        // Try Vinted's brand input field
                        const brandSelectors = [
                            'input[data-testid*="brand"]',
                            'input[placeholder*="brand" i]',
                            'input[name*="brand" i]',
                            '[data-testid*="brand-search"] input',
                            'input[aria-label*="brand" i]'
                        ];
                        
                        for (const selector of brandSelectors) {
                            const brandInput = document.querySelector(selector);
                            if (brandInput) {
                                setReactValue(brandInput, data.brand);
                                
                                // Trigger input events to show suggestions
                                brandInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
                                brandInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
                                brandInput.dispatchEvent(new KeyboardEvent('input', { bubbles: true }));
                                
                                // Wait and try to select matching brand from dropdown
                                setTimeout(() => {
                                    const brandOptions = document.querySelectorAll('[role="option"], [data-testid*="brand-item"], .brand-option, [class*="brand-option"]');
                                    for (const option of brandOptions) {
                                        const optionText = (option.textContent || option.getAttribute('aria-label') || '').toLowerCase();
                                        const brandLower = data.brand.toLowerCase();
                                        if (optionText.includes(brandLower) || brandLower.includes(optionText)) {
                                            option.click();
                                            console.log('✅ Selected brand from dropdown');
                                            return;
                                        }
                                    }
                                    // If no exact match, try first result
                                    if (brandOptions.length > 0) {
                                        brandOptions[0].click();
                                        console.log('✅ Selected first brand option');
                                    }
                                }, 800);
                                
                                filledCount++;
                                console.log('✅ Filled brand');
                                return true;
                            }
                        }
                        return false;
                    };
                    
                    // Fill condition
                    const fillCondition = () => {
                        const conditionSelectors = [
                            'button[data-testid*="condition"]',
                            'select[name*="condition" i]',
                            '[data-testid*="condition"]',
                            'button[aria-label*="condition" i]'
                        ];
                        
                        for (const selector of conditionSelectors) {
                            const conditionElement = document.querySelector(selector);
                            if (conditionElement) {
                                // Try to find and click the matching condition option
                                const conditionText = data.conditionMapped.replace('_', ' ');
                                const conditionButtons = document.querySelectorAll('button[data-testid*="condition"], [role="button"][aria-label*="condition" i]');
                                
                                for (const btn of conditionButtons) {
                                    const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
                                    if (btnText.includes(conditionText) || btnText.includes(data.condition.toLowerCase())) {
                                        btn.click();
                                        filledCount++;
                                        console.log('✅ Filled condition');
                                        return true;
                                    }
                                }
                                
                                // Fallback: try select dropdown
                                if (conditionElement.tagName === 'SELECT') {
                                    const options = Array.from(conditionElement.options);
                                    for (const opt of options) {
                                        if (opt.text.toLowerCase().includes(data.condition.toLowerCase())) {
                                            conditionElement.value = opt.value;
                                            conditionElement.dispatchEvent(new Event('change', { bubbles: true }));
                                            filledCount++;
                                            console.log('✅ Filled condition');
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        return false;
                    };
                    
                    // Fill size if available
                    const fillSize = () => {
                        if (!data.size) return false;
                        
                        const sizeSelectors = [
                            'select[name*="size" i]',
                            'button[data-testid*="size"]',
                            '[data-testid*="size"]',
                            'input[name*="size" i]',
                            'button[aria-label*="size" i]',
                            '[role="button"][aria-label*="size" i]'
                        ];
                        
                        for (const selector of sizeSelectors) {
                            const sizeElement = document.querySelector(selector);
                            if (sizeElement) {
                                if (sizeElement.tagName === 'SELECT') {
                                    const options = Array.from(sizeElement.options);
                                    for (const opt of options) {
                                        const optText = (opt.text || opt.value || '').toLowerCase();
                                        const sizeLower = data.size.toLowerCase();
                                        if (optText.includes(sizeLower) || sizeLower.includes(optText)) {
                                            sizeElement.value = opt.value;
                                            sizeElement.dispatchEvent(new Event('change', { bubbles: true }));
                                            filledCount++;
                                            console.log('✅ Filled size');
                                            return true;
                                        }
                                    }
                                } else if (sizeElement.tagName === 'BUTTON') {
                                    // Click button to open size selector
                                    sizeElement.click();
                                    setTimeout(() => {
                                        const sizeOptions = document.querySelectorAll('[role="option"], [data-testid*="size-option"], button[aria-label*="size" i]');
                                        for (const opt of sizeOptions) {
                                            const optText = (opt.textContent || opt.getAttribute('aria-label') || '').toLowerCase();
                                            const sizeLower = data.size.toLowerCase();
                                            if (optText.includes(sizeLower) || sizeLower.includes(optText)) {
                                                opt.click();
                                                filledCount++;
                                                console.log('✅ Filled size');
                                                return;
                                            }
                                        }
                                    }, 300);
                                    return true;
                                } else if (sizeElement.tagName === 'INPUT') {
                                    setReactValue(sizeElement, data.size);
                                    filledCount++;
                                    console.log('✅ Filled size');
                                    return true;
                                }
                            }
                        }
                        return false;
                    };
                    
                    // Fill category - Navigate Vinted's category tree
                    const fillCategory = () => {
                        if (!data.categoryMain) return false;
                        
                        // Try to find and click category buttons
                        const categorySelectors = [
                            'button[data-testid*="category"]',
                            'button[aria-label*="category" i]',
                            '[role="button"][aria-label*="category" i]',
                            'button:has-text("' + data.categoryMain + '")'
                        ];
                        
                        // First, try to find main category
                        const findAndClickCategory = (categoryText, level) => {
                            if (!categoryText) return false;
                            
                            const buttons = document.querySelectorAll('button, [role="button"]');
                            for (const btn of buttons) {
                                const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
                                const catLower = categoryText.toLowerCase();
                                
                                // Check if button text matches category
                                if (btnText.includes(catLower) || catLower.includes(btnText)) {
                                    // Check if it's visible and clickable
                                    const rect = btn.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        btn.click();
                                        console.log('✅ Clicked category level ' + level + ': ' + categoryText);
                                        filledCount++;
                                        
                                        // Wait for next level to appear, then continue
                                        setTimeout(() => {
                                            if (level === 1 && data.categorySub) {
                                                setTimeout(() => findAndClickCategory(data.categorySub, 2), 500);
                                            } else if (level === 2 && data.categoryDetail) {
                                                setTimeout(() => findAndClickCategory(data.categoryDetail, 3), 500);
                                            }
                                        }, 500);
                                        
                                        return true;
                                    }
                                }
                            }
                            return false;
                        };
                        
                        // Start with main category
                        return findAndClickCategory(data.categoryMain, 1);
                    };
                    
                    // Main fill function with retry logic
                    const attemptFill = () => {
                        filledCount = 0;
                        
                        // Fill title - Vinted specific selectors
                        fillField([
                            'input[data-testid*="title"]',
                            'input[name="title"]',
                            'input[placeholder*="title" i]',
                            '#title',
                            '[data-testid*="item-title"] input',
                            'input[type="text"]:first-of-type'
                        ], data.title, 'title');
                        
                        // Fill description
                        fillField([
                            'textarea[data-testid*="description"]',
                            'textarea[name="description"]',
                            'textarea[placeholder*="description" i]',
                            '[data-testid*="item-description"] textarea',
                            'textarea:first-of-type'
                        ], data.description, 'description');
                        
                        // Fill price
                        fillField([
                            'input[data-testid*="price"]',
                            'input[name="price"]',
                            'input[type="number"][placeholder*="price" i]',
                            '[data-testid*="item-price"] input',
                            'input[type="number"]'
                        ], data.price, 'price');
                        
                        // Fill brand
                        fillBrand();
                        
                        // Fill category (try early, may need multiple clicks)
                        fillCategory();
                        
                        // Fill condition
                        fillCondition();
                        
                        // Fill size
                        fillSize();
                        
                        if (filledCount >= 4) {
                            // Toast notification handled by Vinted autofill script
                            // Note: This is in bookmarklet code, can't use showToast directly
                        } else if (retryCount < maxRetries) {
                            retryCount++;
                            setTimeout(attemptFill, 500);
                        } else {
                            // Toast notification handled by Vinted autofill script
                            // Note: This is in bookmarklet code, can't use showToast directly
                        }
                    };
                    
                    // Start filling after page loads
                    showNotification('QuickList Autofill starting...', 'info');
                    
                    if (document.readyState === 'complete') {
                        setTimeout(() => {
                            attemptFill();
                            setTimeout(() => {
                                if (filledCount >= 4) {
                                    showNotification('Autofill complete! ' + filledCount + ' fields filled.', 'success');
                                } else if (filledCount > 0) {
                                    showNotification('⚠️ Partially filled: ' + filledCount + ' fields. Check console for details.', 'info');
                                } else {
                                    showNotification('Could not find form fields. Vinted may have updated their form structure.', 'error');
                                }
                            }, 3000);
                        }, 1000);
                    } else {
                        window.addEventListener('load', () => {
                            setTimeout(() => {
                                attemptFill();
                                setTimeout(() => {
                                    if (filledCount >= 4) {
                                        showNotification('Autofill complete! ' + filledCount + ' fields filled.', 'success');
                                    } else if (filledCount > 0) {
                                        showNotification('⚠️ Partially filled: ' + filledCount + ' fields. Check console for details.', 'info');
                                    } else {
                                        showNotification('Could not find form fields. Vinted may have updated their form structure.', 'error');
                                    }
                                }, 3000);
                            }, 1000);
                        });
                        setTimeout(() => {
                            attemptFill();
                            setTimeout(() => {
                                if (filledCount >= 4) {
                                    showNotification('Autofill complete! ' + filledCount + ' fields filled.', 'success');
                                } else if (filledCount > 0) {
                                    showNotification('⚠️ Partially filled: ' + filledCount + ' fields. Check console for details.', 'info');
                                } else {
                                    showNotification('Could not find form fields. Vinted may have updated their form structure.', 'error');
                                }
                            }, 3000);
                        }, 2000); // Fallback
                    }
                })();`;
  },

  // Show Vinted autofill instructions
  showVintedAutofillInstructions(script, imageCount = 0) {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    // Escape script for HTML
    const escapedScript = script.replace(/`/g, '\\`').replace(/\${/g, '\\${');

    const photoInstructions =
      imageCount > 0
        ? `<div style="background: var(--accent-indigo-light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--accent-indigo);">
                        <strong style="color: var(--accent-indigo);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>Photo Upload:</strong>
                        <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                            After running the autofill script, you'll need to upload ${imageCount} photo${imageCount > 1 ? 's' : ''} manually. 
                            The script will fill all text fields, but photos must be uploaded through Vinted's photo uploader.
                        </p>
                    </div>`
        : '';

    modal.innerHTML = `
                    <div class="modal-content" style="max-width: 700px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Vinted Autofill Instructions</h2>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                        </div>
                        <div style="padding: 1rem 0;">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                Vinted opened in a new tab. To autofill the form:
                            </p>
                            <ol style="margin-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-secondary); line-height: 2;">
                                <li>Go to the Vinted tab that just opened</li>
                                <li>Wait for the page to fully load</li>
                                <li>Copy the script below</li>
                                <li>Paste it into your browser's address bar</li>
                                <li>Press Enter to run it</li>
                                <li>The form fields (title, description, price, brand, category, condition, size) will be filled automatically</li>
                            </ol>
                            ${photoInstructions}
                            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <textarea 
                                    id="vintedScript" 
                                    readonly 
                                    style="width: 100%; min-height: 120px; padding: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: monospace; font-size: 0.7rem; resize: vertical;"
                                ></textarea>
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('vintedScript').value); app.showToast('Script copied! Paste into address bar on Vinted page.');">
                                    Copy Script
                                </button>
                                <a id="vintedScriptLink" class="btn btn-secondary" style="text-decoration: none; display: inline-block;" target="_blank">
                                    Open & Run Script
                                </a>
                                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                    Close
                                </button>
                            </div>
                            <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                                <p style="margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--text-muted);">
                                    <strong><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Tips:</strong>
                                </p>
                                <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.875rem; color: var(--text-muted); line-height: 1.8;">
                                    <li>The script will retry up to 10 times to find form fields</li>
                                    <li>If some fields aren't filled, Vinted's form structure may have changed - manually fill those fields</li>
                                    <li>Category selection may require multiple clicks - the script handles this automatically</li>
                                    <li>Check the browser console (F12) for autofill status messages</li>
                                </ul>
                            </div>
                            <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-muted);">
                                <strong>Note:</strong> Due to browser security, we can't directly fill forms on other websites. This bookmarklet script runs on the Vinted page to fill the fields for you.
                            </p>
                        </div>
                    </div>
                `;
    document.body.appendChild(modal);

    // Set script content after modal is created (avoid template literal issues)
    const textarea = document.getElementById('vintedScript');
    const link = document.getElementById('vintedScriptLink');
    if (textarea) {
      textarea.value = script;
    }
    if (link) {
      link.href = script;
    }
  },

  // Save listing
  async saveListing() {
    if (!this.state.currentListing) return;

    try {
      // Get current field values
      const listingData = {
        title: document.getElementById('outputTitle').value,
        brand: document.getElementById('outputBrand').value,
        category: document.getElementById('outputCategory').value,
        description: document.getElementById('outputDescription').value,
        condition: document.getElementById('outputCondition').value,
        rrp: document.getElementById('outputRRP').value,
        price: document.getElementById('outputPrice').value,
        location:
          document.getElementById('itemLocation')?.value ||
          this.state.currentListing.location ||
          '',
        keywords: this.state.currentListing.keywords,
        sources: this.state.currentListing.sources,
        platform: this.state.currentListing.platform,
        images: await Promise.all(
          this.state.uploadedImages.map(async (img) => ({
            data: await this.fileToBase64(img.file || img.url),
            isBlurry: img.isBlurry,
          }))
        ),
      };

      const response = await fetch(`${this.apiUrl}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify(listingData),
      });

      if (!response.ok) {
        throw new Error('Failed to save listing');
      }

      // Reload listings from database
      await this.loadListingsFromDB();
      // Clear saved edits since listing is now saved
      this.clearSavedEdits();
      this.showToast('Listing saved!');
    } catch (error) {
      console.error('Save error:', error);
      this.showToast('Failed to save listing. Please try again.', 'error');
    }
  },

  // Load listing
  loadListing(id) {
    const listing = this.state.savedListings.find((l) => l.id === id);
    if (!listing) return;

    // Switch to new item view
    this.navigateToApp('newItem');

    // Load images
    this.state.uploadedImages = listing.images || [];
    this.renderImageGrid();
    this.updateGenerateButton();

    // Load platform
    const platformSelect = document.getElementById('platformSelect');
    if (platformSelect) {
      platformSelect.value = listing.platform || 'vinted';
    }

    // Store as current listing
    this.state.currentListing = listing;

    // Display the listing
    this.displayListing(listing);

    // Show result state
    document.getElementById('initialState').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultState').classList.remove('hidden');
    this.setWizardPhase('review');

    this.showToast('Listing loaded!');
  },

  // Delete listing
  deleteListing(id) {
    this.state.selectedItemForDelete = id;
    document.getElementById('deleteModal').classList.add('active');
  },

  // Close delete modal
  closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    this.state.selectedItemForDelete = null;
  },

  // Confirm delete
  async confirmDelete() {
    if (!this.state.selectedItemForDelete) return;

    try {
      const response = await fetch(`${this.apiUrl}/listings/${this.state.selectedItemForDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.state.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Delete failed:', response.status, errorData);

        if (response.status === 404) {
          // Listing already deleted or doesn't exist - just refresh the list
          await this.loadListingsFromDB();
          this.renderSavedItems();
          this.closeDeleteModal();
          this.showToast('Listing not found - may have already been deleted');
          return;
        }

        if (response.status === 401) {
          this.showToast('Session expired. Please sign in again.', 'warning');
          this.signOut();
          return;
        }

        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Reload listings from database
      await this.loadListingsFromDB();
      this.renderSavedItems();
      this.closeDeleteModal();
      this.showToast('Listing deleted');
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error.message || 'Failed to delete listing. Please try again.';
      this.showToast(errorMessage, 'error');
    }
  },

  // Filter saved items
  filterSavedItems() {
    const searchTerm = (document.getElementById('savedItemsSearch')?.value || '').toLowerCase();
    const platformFilter = document.getElementById('savedItemsPlatformFilter')?.value || '';
    const sortBy = document.getElementById('savedItemsSort')?.value || 'newest';

    // Filter listings
    let filtered = this.state.savedListings.filter((listing) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        listing.title?.toLowerCase().includes(searchTerm) ||
        listing.brand?.toLowerCase().includes(searchTerm) ||
        listing.category?.toLowerCase().includes(searchTerm);

      // Platform filter
      const matchesPlatform =
        !platformFilter || listing.platform?.toLowerCase() === platformFilter.toLowerCase();

      return matchesSearch && matchesPlatform;
    });

    // Sort listings
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'brand':
          return (a.brand || '').localeCompare(b.brand || '');
        case 'newest':
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    this.state.filteredSavedListings = filtered;
    this.renderSavedItems();
  },

  // Clear all filters
  clearSavedItemsFilters() {
    const searchInput = document.getElementById('savedItemsSearch');
    const platformFilter = document.getElementById('savedItemsPlatformFilter');
    const sortSelect = document.getElementById('savedItemsSort');

    if (searchInput) searchInput.value = '';
    if (platformFilter) platformFilter.value = '';
    if (sortSelect) sortSelect.value = 'newest';

    this.filterSavedItems();
  },

  // Render saved items
  renderSavedItems() {
    const grid = document.getElementById('savedItemsGrid');
    const empty = document.getElementById('savedItemsEmpty');
    const noResults = document.getElementById('savedItemsNoResults');
    const countEl = document.getElementById('savedItemsCount');

    // Show loading state
    if (this.state.loadingSavedItems) {
      grid.classList.remove('hidden');
      empty.classList.add('hidden');
      if (noResults) noResults.classList.add('hidden');
      if (countEl) countEl.textContent = '';
      grid.innerHTML = '<div class="skeleton skeleton-text-large"></div>'.repeat(3);
      return;
    }

    // Use filtered listings if filters are active, otherwise use all listings
    const listingsToRender =
      this.state.filteredSavedListings.length > 0 ||
      document.getElementById('savedItemsSearch')?.value ||
      document.getElementById('savedItemsPlatformFilter')?.value
        ? this.state.filteredSavedListings
        : this.state.savedListings;

    // Update count
    if (countEl) {
      const total = this.state.savedListings.length;
      const showing = listingsToRender.length;
      if (showing < total) {
        countEl.textContent = `Showing ${showing} of ${total} items`;
      } else {
        countEl.textContent = total === 1 ? '1 item' : `${total} items`;
      }
    }

    if (this.state.savedListings.length === 0) {
      grid.classList.add('hidden');
      empty.classList.remove('hidden');
      if (noResults) noResults.classList.add('hidden');
      return;
    }

    if (listingsToRender.length === 0) {
      grid.classList.add('hidden');
      empty.classList.add('hidden');
      if (noResults) noResults.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    empty.classList.add('hidden');
    if (noResults) noResults.classList.add('hidden');

    grid.innerHTML = listingsToRender
      .map((listing) => {
        const primaryImage = listing.images?.[0]?.url || listing.images?.[0]?.data || '';
        const createdDate = listing.created_at
          ? new Date(listing.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : 'Draft';
        const statusLabel = listing.status === 'sold' ? ' • Sold' : '';
        return `
                        <div class="swipeable-card" data-listing-id="${listing.id}">
                            <div class="swipeable-card-actions swipeable-card-action-left">✏️ Edit</div>
                            <div class="swipeable-card-actions swipeable-card-action-right">✓ Sold</div>
                            <div class="swipeable-card-content">
                                <img src="${primaryImage}" alt="${listing.title || 'Listing'}" class="swipeable-card-image">
                                <div class="swipeable-card-info">
                                    <div class="swipeable-card-title">${listing.title || 'Untitled'}</div>
                                    <div class="swipeable-card-meta">${(listing.platform || 'Draft').toUpperCase()} · ${createdDate}${statusLabel}</div>
                                    <div style="font-weight: 600; margin-top: 4px;">${listing.price || '—'}</div>
                                </div>
                                <button class="btn btn-secondary btn-small" type="button" onclick="app.loadListing(${listing.id})">Open</button>
                            </div>
                        </div>
                    `;
      })
      .join('');

    this.initSwipeableCards();
  },

  async loadDashboardMetrics(force = false) {
    if (!this.state.isAuthenticated || !this.state.token) return;
    if (this.state.dashboardMetrics && !force) {
      this.renderDashboard();
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/dashboard/metrics`, {
        headers: { Authorization: `Bearer ${this.state.token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to load dashboard metrics');
      }
      this.state.dashboardMetrics = await response.json();
      this.renderDashboard();
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      this.showToast('Could not load dashboard data', 'error');
    }
  },

  async loadMessages(force = false) {
    if (!this.state.isAuthenticated || !this.state.token) return;
    if (this.state.messages.length && !force) {
      this.renderMessages();
      return;
    }

    this.state.messagesLoading = true;
    this.renderMessages();

    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        headers: { Authorization: `Bearer ${this.state.token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const data = await response.json();
      this.state.messages = data.messages || [];
      this.renderMessages();
      this.updateBottomNavBadges();
    } catch (error) {
      console.error('Messages error:', error);
      this.showToast('Could not load messages', 'error');
    } finally {
      this.state.messagesLoading = false;
      this.renderMessages();
    }
  },

  async markListingSold(listingId) {
    if (!listingId || !this.state.token) return;
    try {
      const listing = this.state.savedListings.find((l) => String(l.id) === String(listingId));
      const response = await fetch(`${this.apiUrl}/listings/${listingId}/mark-sold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({
          soldPrice: listing?.price || '',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to mark as sold');
      }

      const data = await response.json();
      this.state.savedListings = this.state.savedListings.map((item) =>
        item.id === data.listing.id ? data.listing : item
      );
      this.filterSavedItems();
      this.loadDashboardMetrics(true);
      this.showToast('Marked as sold!');
    } catch (error) {
      console.error('Mark sold error:', error);
      this.showToast(error.message || 'Could not mark item as sold', 'error');
    }
  },

  renderDashboard() {
    const revenueEl = document.getElementById('statRevenue');
    const revenueTrendEl = document.getElementById('statRevenueTrend');
    const listingsEl = document.getElementById('statListings');
    const listingsTrendEl = document.getElementById('statListingsTrend');
    const messagesEl = document.getElementById('statMessages');
    const messagesTrendEl = document.getElementById('statMessagesTrend');
    const activityEl = document.getElementById('dashboardActivity');
    const tipsEl = document.getElementById('dashboardTips');

    if (!revenueEl) return;

    const metrics = this.state.dashboardMetrics;

    if (!metrics) {
      revenueEl.textContent = '£0.00';
      revenueTrendEl.textContent = 'Loading...';
      listingsEl.textContent = '—';
      listingsTrendEl.textContent = 'Loading...';
      messagesEl.textContent = '—';
      messagesTrendEl.textContent = 'Loading...';
      if (activityEl) {
        activityEl.innerHTML = '<p style="color: var(--text-muted);">Loading activity...</p>';
      }
      if (tipsEl) {
        tipsEl.innerHTML = this.state.dashboardTips
          .map((tip) => `<li style="color: var(--text-secondary);">• ${tip}</li>`)
          .join('');
      }
      return;
    }

    const revenueValue = metrics.revenueLast7Days || 0;
    revenueEl.textContent = `£${revenueValue.toFixed(2)}`;
    revenueTrendEl.textContent = `${metrics.revenueTrend >= 0 ? '+' : ''}${metrics.revenueTrend}% vs last week`;
    listingsEl.textContent = metrics.activeListings ?? 0;
    listingsTrendEl.textContent = metrics.listingsAddedToday
      ? `${metrics.listingsAddedToday} added today`
      : 'No new listings today';
    messagesEl.textContent = metrics.unreadMessages ?? 0;
    messagesTrendEl.textContent = metrics.unreadMessages
      ? `${metrics.unreadMessages} awaiting reply`
      : 'Inbox clear';

    if (activityEl) {
      const items = (metrics.activity || []).map((item) => {
        const detail = typeof item.detail !== 'undefined' ? item.detail : item.value;
        return `
                        <div style="display: flex; gap: 0.75rem; align-items: center;">
                            <div style="font-size: 1.5rem;">${item.icon || '•'}</div>
                            <div>
                                <strong>${item.label}</strong>
                                <p style="margin: 0; color: var(--text-muted);">${detail}</p>
                            </div>
                        </div>
                    `;
      });
      activityEl.innerHTML = items.length
        ? items.join('')
        : '<p style="color: var(--text-muted);">No recent activity yet</p>';
    }

    if (tipsEl) {
      const tipSource =
        metrics.tips && metrics.tips.length ? metrics.tips : this.state.dashboardTips;
      tipsEl.innerHTML = tipSource
        .map((tip) => `<li style="color: var(--text-secondary);">• ${tip}</li>`)
        .join('');
    }
  },

  updateDashboard() {
    this.renderDashboard();
  },

  renderMessages() {
    const list = document.getElementById('messagesList');
    const empty = document.getElementById('messagesEmpty');
    if (!list) return;

    if (this.state.messagesLoading) {
      list.innerHTML = '<p style="color: var(--text-muted);">Loading messages...</p>';
      if (empty) empty.classList.add('hidden');
      return;
    }

    if (!this.state.messages.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    list.innerHTML = this.state.messages
      .map((message) => {
        const buyerName = message.buyer_name || message.buyer || 'Buyer';
        const initials = buyerName
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const badge = message.unread
          ? '<span class="badge" style="background: var(--accent-indigo);">Unread</span>'
          : '';
        const quickReplies = this.getQuickReplies(message.platform)
          .map((reply) => {
            const safeReply = reply.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<button class="btn btn-secondary btn-small" type="button" onclick="app.sendQuickReply(${message.id}, '${safeReply}')">${reply}</button>`;
          })
          .join('');
        const snippet = message.snippet || message.last_reply_text || 'New message';
        const timeAgo = this.formatRelativeTime(message.last_reply_at || message.created_at);
        return `
                        <div class="message-card ${message.unread ? 'unread' : ''}">
                            <div class="message-header">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div class="message-avatar">${initials}</div>
                                    <div>
                                        <div style="font-weight: 600;">${buyerName}</div>
                                        <div class="message-meta">${message.platform || 'Marketplace'} · ${timeAgo}</div>
                                    </div>
                                </div>
                                ${badge}
                            </div>
                            <p style="margin: 0.75rem 0;">${snippet}</p>
                            <div class="message-actions">
                                ${quickReplies}
                                <button class="btn btn-secondary btn-small" type="button" onclick="app.markMessageRead(${message.id})">Mark read</button>
                            </div>
                        </div>
                    `;
      })
      .join('');
  },

  formatRelativeTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  },

  getQuickReplies(platform = '') {
    const normalized = platform.toLowerCase();
    if (normalized.includes('vinted')) {
      return ['Hi! Yes it is available 👍', 'Happy to bundle items if you like'];
    }
    if (normalized.includes('ebay')) {
      return [
        'Thanks for reaching out! I can ship today.',
        'I can do a small discount for quick payment.',
      ];
    }
    if (normalized.includes('gumtree')) {
      return ['Collection works for me. When suits you?', 'Cash on collection is fine.'];
    }
    return ['Thanks for your message!', 'Happy to help.'];
  },

  async sendQuickReply(id, reply) {
    if (!reply || !this.state.token) return;
    try {
      const response = await fetch(`${this.apiUrl}/messages/${id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({ reply }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send reply');
      }
      const data = await response.json();
      this.state.messages = this.state.messages.map((message) =>
        message.id === data.message.id ? data.message : message
      );
      this.vibrateDevice('success');
      this.renderMessages();
      this.updateBottomNavBadges();
      this.showToast('Reply sent!');
    } catch (error) {
      console.error('Reply error:', error);
      this.showToast(error.message || 'Could not send reply', 'error');
    }
  },

  async markMessageRead(id) {
    if (!this.state.token) return;
    try {
      const response = await fetch(`${this.apiUrl}/messages/${id}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update message');
      }
      const data = await response.json();
      this.state.messages = this.state.messages.map((message) =>
        message.id === data.message.id ? data.message : message
      );
      this.renderMessages();
      this.updateBottomNavBadges();
    } catch (error) {
      console.error('Mark read error:', error);
      this.showToast(error.message || 'Could not update message', 'error');
    }
  },

  // Navigation
  navigateTo(view) {
    // Hide all marketing views
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('photoTipsView').classList.add('hidden');
    document.getElementById('checklistView').classList.add('hidden');
    document.getElementById('pricingView').classList.add('hidden');

    // Show selected view
    document.getElementById(view + 'View').classList.remove('hidden');

    this.state.currentView = view;
    window.scrollTo(0, 0);
  },

  navigateToApp(view) {
    this.switchAppView(view);
  },

  highlightBottomTab(view) {
    const tabs = document.querySelectorAll('.bottom-nav-tab');
    tabs.forEach((tab) => {
      const tabView = tab.getAttribute('data-view');
      if (tabView === view) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
  },

  switchAppView(view) {
    // Map 'dashboard' to 'settings' since dashboard content is in settingsView
    const resolvedView = view === 'dashboard' ? 'settings' : view;

    const views = ['newItem', 'savedItems', 'settings', 'profile'];
    views.forEach((v) => {
      const el = document.getElementById(`${v}View`);
      if (el) {
        el.classList.toggle('hidden', v !== resolvedView);
      }
    });

    this.state.currentAppView = resolvedView;

    if (resolvedView === 'savedItems') {
      this.renderSavedItems();
    } else if (resolvedView === 'settings') {
      this.loadSubscriptionData();
      this.loadDashboardMetrics(); // Also load dashboard metrics
    } else if (resolvedView === 'profile') {
      this.loadProfileData();
    }

    this.highlightBottomTab(resolvedView);
    window.scrollTo(0, 0);
  },

  // Authentication
  // Show auth - now uses Clerk's built-in modal
  showAuthModal(mode = 'signIn') {
    if (this.state.isAuthenticated || (window.Clerk && window.Clerk.user)) {
      // User is already signed in - take them to the app
      this.updateUI(); // Show the app view
      this.navigateToApp('newItem');
      return;
    }
    this.signInWithClerk(mode);
  },

  // Go to dashboard - for authenticated users
  goToDashboard() {
    if (!this.state.isAuthenticated && !(window.Clerk && window.Clerk.user)) {
      this.showAuthModal('signIn');
      return;
    }
    this.updateUI();
    this.navigateToApp('settings'); // Dashboard content is in settingsView
  },

  // Check Clerk authentication
  setupClerkListeners() {
    // Listen for Clerk sign-in events
    window.addEventListener('clerkSignedIn', async (event) => {
      console.log('Clerk sign-in detected');
      const { user, session } = event.detail;

      // Set auth state immediately (don't wait for backend)
      const token = await session.getToken();
      this.state.isAuthenticated = true;
      this.state.user = {
        email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress,
        name: user.fullName || user.firstName || 'User',
        avatarUrl: user.imageUrl,
      };
      this.state.token = token;
      localStorage.setItem('quicklist-token', token);

      console.log('User authenticated via Clerk:', this.state.user.email);

      // Update UI to show app
      this.updateUI();
      this.updateAuthButtons();
      this.updateMobileMenu();

      // Load user data
      await this.loadListingsFromDB();

      // Show welcome toast only once per session
      if (!this.state.hasShownWelcomeToast) {
        this.showToast('Welcome back!', 'success');
        this.state.hasShownWelcomeToast = true;
      }
    });

    // Listen for Clerk sign-out events
    window.addEventListener('clerkSignedOut', () => {
      console.log('Clerk sign-out detected');
      this.state.isAuthenticated = false;
      this.state.user = null;
      this.state.token = null;
      localStorage.removeItem('quicklist-token');

      this.updateUI();
      this.updateAuthButtons();
      this.updateMobileMenu();
    });
  },

  async checkClerkAuth() {
    if (!window.Clerk) return;

    try {
      const user = window.Clerk.user;
      const session = window.Clerk.session;

      if (user && session) {
        // Get session token from the active session
        const token = await session.getToken();

        if (token) {
          console.log('Clerk user already signed in');

          // Set auth state directly from Clerk (no backend verification needed)
          this.state.isAuthenticated = true;
          this.state.user = {
            email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress,
            name: user.fullName || user.firstName || 'User',
            avatarUrl: user.imageUrl,
          };
          this.state.token = token;
          localStorage.setItem('quicklist-token', token);

          console.log('User authenticated:', this.state.user.email);

          await this.loadListingsFromDB();
        }
      }
    } catch (error) {
      console.error('Clerk auth check error:', error);
    }
  },

  // Sign in with Clerk - uses Clerk's prebuilt UI
  async signInWithClerk(mode = 'signIn') {
    if (!window.Clerk) {
      this.showToast('Authentication system not ready', 'error');
      return;
    }

    if (this.state.isAuthenticated || window.Clerk.user) {
      this.updateUI();
      this.navigateToApp('newItem');
      return;
    }

    try {
      if (mode === 'signUp') {
        await window.Clerk.openSignUp({
          appearance: {
            elements: {
              rootBox: 'clerk-modal-root',
              card: 'clerk-modal-card',
            },
          },
        });
      } else {
        // Use Clerk's openSignIn() method which shows their prebuilt modal
        // This includes email/password, Google OAuth, and more
        await window.Clerk.openSignIn({
          // Customize appearance if needed
          appearance: {
            elements: {
              rootBox: 'clerk-modal-root',
              card: 'clerk-modal-card',
            },
          },
        });
      }
    } catch (error) {
      console.error('Clerk sign in error:', error);
      // Only show error if it's not the "already signed in" error
      if (!error.code || error.code !== 'cannot_render_single_session_enabled') {
        this.showToast('Authentication error', 'error');
      }
    }
  },

  // Mobile Menu Functions
  toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');

    if (menu.classList.contains('active')) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  },

  openMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');

    menu.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  },

  closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');

    menu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  },

  updateMobileMenu() {
    const menuContent = document.getElementById('mobileMenuContent');
    const isAuth = this.state.isAuthenticated;

    if (isAuth) {
      // Post-auth menu items
      menuContent.innerHTML = `
                        <a onclick="app.navigateToApp('newItem'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                            New Item
                        </a>
                        <a onclick="app.navigateToApp('savedItems'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                            Saved Items
                        </a>
                        <a onclick="app.navigateToApp('dashboard'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                            Dashboard
                        </a>
                        <div class="menu-divider"></div>
                        <a onclick="app.navigateToApp('settings'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </a>
                        <a onclick="app.navigateToApp('profile'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            Profile
                        </a>
                        <a onclick="app.signOut(); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            Sign Out
                        </a>
                    `;
    } else {
      // Pre-auth menu items
      menuContent.innerHTML = `
                        <a onclick="app.navigateTo('photoTips'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                            Photo Tips
                        </a>
                        <a onclick="app.navigateTo('checklist'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Seller Checklist
                        </a>
                        <a onclick="app.navigateTo('pricing'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
                            </svg>
                            Pricing
                        </a>
                        <div class="menu-divider"></div>
                        <a onclick="app.showAuthModal('signUp'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                            </svg>
                            Sign Up
                        </a>
                        <a onclick="app.showAuthModal('signIn'); app.closeMobileMenu()">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                            </svg>
                            Sign In
                        </a>
                    `;
    }
  },

  async signOut() {
    try {
      if (window.Clerk) {
        await window.Clerk.signOut();
      }

      localStorage.removeItem('quicklist-token');

      this.state.isAuthenticated = false;
      this.state.user = null;
      this.state.token = null;
      this.cleanupImageUrls(); // Prevent memory leak
      this.state.uploadedImages = [];
      this.state.currentListing = null;
      this.state.savedListings = [];
      this.state.messages = [];
      this.state.dashboardMetrics = null;

      this.updateUI();
      this.updateAuthButtons();
      this.updateMobileMenu(); // Update mobile menu after sign out
      this.showToast('Signed out successfully', 'success');
    } catch (error) {
      console.error('Sign out error:', error);
      this.showToast('Error signing out', 'error');
    }
  },

  // Update auth buttons visibility based on authentication state
  updateAuthButtons() {
    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    const isAuthenticated = this.state.isAuthenticated || (window.Clerk && window.Clerk.user);

    if (signInBtn && signUpBtn && dashboardBtn && signOutBtn) {
      if (isAuthenticated) {
        // User is signed in - show dashboard and sign out
        signInBtn.style.display = 'none';
        signUpBtn.style.display = 'none';
        dashboardBtn.style.display = 'inline-block';
        signOutBtn.style.display = 'inline-block';
      } else {
        // User is not signed in - show sign in and sign up
        signInBtn.style.display = 'inline-block';
        signUpBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'none';
        signOutBtn.style.display = 'none';
      }
    }
  },

  // Subscription Management
  async loadSubscriptionData() {
    if (!this.state.isAuthenticated || !this.state.token) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/subscription/status`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load subscription data');
      }

      const data = await response.json();

      // Update user profile
      const userNameEl = document.getElementById('userName');
      const userEmailEl = document.getElementById('userEmail');
      const userAvatarEl = document.getElementById('userAvatar');

      if (userNameEl) userNameEl.textContent = data.user.name || 'User';
      if (userEmailEl) userEmailEl.textContent = data.user.email;
      if (userAvatarEl && data.user.avatarUrl) {
        userAvatarEl.style.backgroundImage = `url(${data.user.avatarUrl})`;
        userAvatarEl.style.backgroundSize = 'cover';
        userAvatarEl.textContent = '';
      } else if (userAvatarEl) {
        userAvatarEl.textContent = (data.user.name || data.user.email)[0].toUpperCase();
      }

      // Update subscription info
      const currentPlanEl = document.getElementById('currentPlan');
      const planStatusEl = document.getElementById('planStatus');
      const renewalDateEl = document.getElementById('renewalDate');
      const subscriptionStatusEl = document.getElementById('subscriptionStatus');
      const manageBillingBtn = document.getElementById('manageBillingBtn');

      if (currentPlanEl) {
        const planNames = {
          free: 'Free',
          starter: 'Starter',
          pro: 'Pro',
          business: 'Business',
        };
        currentPlanEl.textContent = planNames[data.subscription.planType] || 'Free';
      }

      if (planStatusEl) {
        planStatusEl.textContent =
          data.subscription.status.charAt(0).toUpperCase() + data.subscription.status.slice(1);
      }

      if (renewalDateEl) {
        if (data.subscription.currentPeriodEnd && data.subscription.planType !== 'free') {
          const date = new Date(data.subscription.currentPeriodEnd);
          renewalDateEl.textContent = date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } else {
          renewalDateEl.textContent = 'Never';
        }
      }

      if (subscriptionStatusEl) {
        const statusColors = {
          active: 'var(--success)',
          canceled: 'var(--text-muted)',
          past_due: 'var(--warning)',
          trialing: 'var(--accent-indigo)',
        };
        subscriptionStatusEl.style.background =
          statusColors[data.subscription.status] || 'var(--success)';
        subscriptionStatusEl.textContent =
          data.subscription.status.charAt(0).toUpperCase() + data.subscription.status.slice(1);
      }

      // Show manage billing button if user has Stripe customer
      if (manageBillingBtn && data.subscription.stripeCustomerId) {
        manageBillingBtn.style.display = 'inline-block';
      }

      // Update usage
      const usageCountEl = document.getElementById('usageCount');
      const usageBarEl = document.getElementById('usageBar');
      const usageLimitEl = document.getElementById('usageLimit');

      if (usageCountEl) usageCountEl.textContent = data.usage.listingsCreated;
      if (usageBarEl) usageBarEl.style.width = `${data.usage.percentage}%`;
      if (usageLimitEl) usageLimitEl.textContent = `of ${data.usage.limit} listings used`;

      // Update upsell footer for free users
      this.updateUpsellFooter(data.subscription, data.usage);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      this.showToast('Failed to load subscription data', 'error');
    }
  },

  // Upsell Footer Management
  updateUpsellFooter(subscription, usage) {
    const footer = document.getElementById('upsellFooter');
    if (!footer) return;

    // Only show for free users who haven't dismissed it this session
    const dismissed = sessionStorage.getItem('upsellDismissed');
    const isFree = !subscription.planType || subscription.planType === 'free';
    
    if (!isFree || dismissed) {
      footer.classList.add('hidden');
      document.body.classList.remove('has-upsell-footer');
      return;
    }

    // Update usage display
    const usedEl = document.getElementById('upsellUsed');
    const limitEl = document.getElementById('upsellLimit');
    const barFill = document.getElementById('upsellBarFill');

    if (usedEl) usedEl.textContent = usage.listingsCreated || 0;
    if (limitEl) limitEl.textContent = usage.limit || 5;
    
    const percentage = usage.percentage || 0;
    if (barFill) {
      barFill.style.width = `${percentage}%`;
      // Color coding based on usage
      barFill.classList.remove('warning', 'critical');
      if (percentage >= 80) {
        barFill.classList.add('critical');
      } else if (percentage >= 60) {
        barFill.classList.add('warning');
      }
    }

    // Show the footer
    footer.classList.remove('hidden');
    document.body.classList.add('has-upsell-footer');
  },

  dismissUpsell() {
    const footer = document.getElementById('upsellFooter');
    if (footer) {
      footer.classList.add('hidden');
      document.body.classList.remove('has-upsell-footer');
      // Remember dismissal for this session
      sessionStorage.setItem('upsellDismissed', 'true');
    }
  },

  async loadProfileData() {
    if (!this.state.isAuthenticated) {
      return;
    }

    // Get user data from Clerk or state
    const user = this.state.user || (window.Clerk && window.Clerk.user);

    if (!user) {
      console.warn('No user data available for profile');
      return;
    }

    // Update profile avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
      if (user.imageUrl || user.avatarUrl) {
        profileAvatar.style.backgroundImage = `url(${user.imageUrl || user.avatarUrl})`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.textContent = '';
      } else {
        const name =
          user.fullName ||
          user.name ||
          user.firstName ||
          user.emailAddresses?.[0]?.emailAddress ||
          user.email ||
          'User';
        profileAvatar.textContent = name[0].toUpperCase();
      }
    }

    // Update profile name
    const profileName = document.getElementById('profileName');
    if (profileName) {
      const name =
        user.fullName ||
        user.name ||
        user.firstName ||
        user.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
        'User';
      profileName.textContent = name;
    }

    // Update profile email
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) {
      const email =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress ||
        user.email ||
        '';
      profileEmail.textContent = email;
    }

    // Update member since date
    const memberSince = document.getElementById('memberSince');
    if (memberSince) {
      const createdAt = user.createdAt || user.created_at;
      if (createdAt) {
        const date = new Date(createdAt);
        memberSince.textContent = date.toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        });
      } else {
        memberSince.textContent = 'Recently';
      }
    }

    // Update plan information
    const profilePlan = document.getElementById('profilePlan');
    if (profilePlan && this.state.token) {
      try {
        const response = await fetch(`${this.apiUrl}/subscription/status`, {
          headers: {
            Authorization: `Bearer ${this.state.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const planNames = {
            free: 'Free',
            starter: 'Starter',
            pro: 'Pro',
            business: 'Business',
          };
          profilePlan.textContent = planNames[data.subscription?.planType] || 'Free';

          // Update total listings
          const totalListings = document.getElementById('totalListings');
          if (totalListings && data.usage) {
            totalListings.textContent = data.usage.listingsCreated || 0;
          }
        } else {
          profilePlan.textContent = 'Free';
        }
      } catch (error) {
        console.error('Error loading profile subscription data:', error);
        profilePlan.textContent = 'Free';
      }
    } else if (profilePlan) {
      profilePlan.textContent = 'Free';
    }
  },

  async showUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    const plansContainer = document.getElementById('pricingPlans');

    if (!modal || !plansContainer) return;

    // Load pricing config from API
    if (!this.pricingConfig) {
      await this.loadPricingConfig();
    }

    // Get current subscription plan
    let currentPlan = 'free';
    try {
      const statusResponse = await fetch(`${this.apiUrl}/subscription/status`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        currentPlan = statusData.subscription.planType || 'free';
      }
    } catch (error) {
      console.error('Error fetching current plan:', error);
    }

    // Build plans array from backend config
    const plans = [];
    
    if (!this.pricingConfig?.configured) {
      // Stripe not configured - show informational message
      plansContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 2rem;">
          <h3 style="margin-bottom: 1rem;">Pricing Coming Soon</h3>
          <p style="color: var(--text-muted);">Payment system is currently being configured. Please check back soon!</p>
        </div>
      `;
      modal.classList.remove('hidden');
      return;
    }

    // Build plans from API config
    const tierConfig = this.pricingConfig.tiers;
    
    if (tierConfig.casual) {
      plans.push({
        id: 'casual',
        name: tierConfig.casual.name,
        price: `£${tierConfig.casual.price}`,
        period: 'month',
        priceId: tierConfig.casual.priceId,
        features: [
          `${tierConfig.casual.listings} listings/month`,
          'All marketplaces',
          'AI-powered descriptions',
          'Market research',
          'Pricing intelligence',
          'Image enhancement',
        ],
        current: currentPlan === 'casual',
      });
    }
    
    if (tierConfig.pro) {
      plans.push({
        id: 'pro',
        name: tierConfig.pro.name,
        price: `£${tierConfig.pro.price}`,
        period: 'month',
        priceId: tierConfig.pro.priceId,
        features: [
          `${tierConfig.pro.listings} listings/month`,
          'Premium AI personalities',
          'Bulk processing',
          'Advanced analytics',
          'Priority support',
          'Export & backup',
        ],
        current: currentPlan === 'pro',
        featured: tierConfig.pro.featured,
      });
    }
    
    if (tierConfig.max) {
      plans.push({
        id: 'max',
        name: tierConfig.max.name,
        price: `£${tierConfig.max.price}`,
        period: 'month',
        priceId: tierConfig.max.priceId,
        features: [
          'Unlimited listings',
          'All Pro features',
          'API access',
          'Custom integrations',
          'Dedicated support',
          'Early access to features',
        ],
        current: currentPlan === 'max',
      });
    }

    plansContainer.innerHTML = plans
      .map(
        (plan) => `
                    <div class="card" style="${plan.featured ? 'border: 2px solid var(--accent-indigo);' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">${plan.name}</h3>
                            ${plan.current ? '<span class="badge" style="background: var(--success);">Current</span>' : ''}
                        </div>
                        <div style="font-size: 2rem; font-weight: 600; margin-bottom: 1rem;">
                            ${plan.price}<span style="font-size: 1rem; color: var(--text-muted);">/${plan.period}</span>
                        </div>
                        <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem;">
                            ${plan.features.map((f) => `<li style="padding: 0.5rem 0; border-bottom: 1px solid var(--bg-secondary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"></polyline></svg> ${f}</li>`).join('')}
                        </ul>
                        ${
                          plan.current
                            ? '<button class="btn btn-secondary" disabled>Current Plan</button>'
                            : `<button class="btn ${plan.featured ? 'btn-primary' : 'btn-secondary'}" onclick="app.handlePlanSelection('${plan.id}', '${plan.priceId}')">Upgrade to ${plan.name}</button>`
                        }
                    </div>
                `
      )
      .join('');

    modal.classList.remove('hidden');
  },

  closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.add('hidden');
  },

  // Pricing configuration loaded from server
  pricingConfig: null,

  async loadPricingConfig() {
    try {
      const response = await fetch(`${this.apiUrl}/config/pricing`);
      if (response.ok) {
        this.pricingConfig = await response.json();
      }
    } catch (error) {
      console.error('Failed to load pricing config:', error);
    }
  },

  async handlePlanSelection(planType, fallbackPriceId) {
    // Ensure pricing config is loaded
    if (!this.pricingConfig) {
      await this.loadPricingConfig();
    }

    // Use price ID from config if available, otherwise use fallback
    let priceId = this.pricingConfig?.tiers?.[planType]?.priceId || fallbackPriceId;

    if (!priceId) {
      this.showToast('Payment system is being configured. Please try again later.', 'warning');
      return;
    }

    await this.startCheckout(priceId, planType);
  },

  async startCheckout(priceId, planType) {
    if (!this.state.isAuthenticated || !this.state.token) {
      this.showToast('Please sign in to upgrade', 'warning');
      return;
    }

    try {
      this.showToast('Redirecting to checkout...', 'info');

      const response = await fetch(`${this.apiUrl}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({ priceId, planType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      this.showToast(error.message || 'Failed to start checkout', 'error');
    }
  },

  async openBillingPortal() {
    if (!this.state.isAuthenticated || !this.state.token) {
      this.showToast('Please sign in', 'warning');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create portal session');
      }

      const data = await response.json();

      // Redirect to Stripe Billing Portal
      window.location.href = data.url;
    } catch (error) {
      console.error('Billing portal error:', error);
      this.showToast(error.message || 'Failed to open billing portal', 'error');
    }
  },

  // Update UI based on auth state
  updateUI() {
    const marketingView = document.getElementById('marketingView');
    const marketingHeader = document.getElementById('marketingHeader');
    const marketingFooter = document.getElementById('marketingFooter');
    const appView = document.getElementById('appView');
    const appHeader = document.getElementById('appHeader');

    if (!marketingView || !appView) {
      console.warn('Required view elements not found');
      return;
    }

    if (this.state.isAuthenticated) {
      // User is signed in - show app, hide marketing
      marketingView.style.display = 'none';
      marketingHeader.classList.add('hidden');
      if (marketingFooter) marketingFooter.style.display = 'none';

      appView.classList.remove('hidden');
      appView.style.display = 'block';
      appHeader.classList.remove('hidden');

      // ALWAYS go to New Item page for authenticated users
      this.navigateToApp('newItem');

      // Load app data
      this.loadDashboardMetrics();
    } else {
      // User is NOT signed in - show marketing, hide app
      marketingView.style.display = 'block';
      marketingHeader.classList.remove('hidden');
      if (marketingFooter) marketingFooter.style.display = 'block';

      appView.classList.add('hidden');
      appView.style.display = 'none';
      appHeader.classList.add('hidden');

      // Show landing page
      this.navigateTo('home');
    }

    // Update mobile menu items based on auth state
    this.updateMobileMenu();

    // Update auth buttons visibility
    this.updateAuthButtons();

    // Update settings UI (only if element exists)
    const settingAutoDownload = document.getElementById('settingAutoDownload');
    if (settingAutoDownload) {
      settingAutoDownload.checked = this.state.settings.autoDownloadZip;
    }
  },

  // Settings storage (local only)
  saveSettings() {
    try {
      localStorage.setItem('quicklist-settings', JSON.stringify(this.state.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  },

  loadSettings() {
    try {
      const data = localStorage.getItem('quicklist-settings');
      if (data) {
        this.state.settings = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  },

  // Toast notification
  showToast(message, type = 'info') {
    // Use new toast manager (with queue and debouncing)
    if (window.toastManager) {
      window.toastManager.showToast(message, type);
    }
  },

  // ============================================
  // MOBILE-FIRST FEATURES - PHASE 1
  // ============================================

  // Initialize bottom navigation
  initBottomNav() {
    const bottomNavTabs = document.querySelectorAll('.bottom-nav-tab');
    bottomNavTabs.forEach((tab) => {
      if (tab.dataset.bound === 'true') return;
      tab.dataset.bound = 'true';
      tab.addEventListener('click', (e) => {
        const view = tab.getAttribute('data-view');
        this.switchAppView(view);
      });
    });

    this.updateBottomNavBadges();
    this.highlightBottomTab(this.state.currentAppView);
  },

  updateBottomNavBadges() {
    const listingsBadge = document.getElementById('listingsBadge');
    if (listingsBadge && this.state.savedListings) {
      const count = this.state.savedListings.length;
      if (count > 0) {
        listingsBadge.textContent = count > 99 ? '99+' : count;
        listingsBadge.style.display = 'flex';
      } else {
        listingsBadge.style.display = 'none';
      }
    }

    const messagesBadge = document.getElementById('messagesBadge');
    const messages = this.state.messages || [];
    if (messagesBadge) {
      const unread = messages.filter((msg) => msg.unread).length;
      if (unread > 0) {
        messagesBadge.textContent = unread > 9 ? '9+' : unread;
        messagesBadge.style.display = 'flex';
      } else {
        messagesBadge.style.display = 'none';
      }
    }
  },

  cameraStream: null,
  currentCamera: 'environment',

  async openCamera() {
    const container = document.getElementById('cameraContainer');
    const video = document.getElementById('cameraVideo');

    try {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: this.currentCamera,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.cameraStream;
      container.classList.add('active');

      this.monitorImageQuality();
    } catch (error) {
      console.error('Camera access error:', error);
      this.showToast('Camera access denied', 'error');
    }
  },

  closeCamera() {
    const container = document.getElementById('cameraContainer');
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    container.classList.remove('active');
  },

  async switchCamera() {
    this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
    await this.openCamera();
  },

  capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          this.showToast('Failed to capture photo', 'error');
          return;
        }

        try {
          const file = new File([blob], `capture-${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          await this.processFiles([file]);
          this.showMobileToast('Photo captured!', 'success');
          this.vibrateDevice('success');
        } catch (error) {
          console.error('Capture processing error:', error);
          this.showToast('Failed to process captured photo', 'error');
        } finally {
          this.closeCamera();
        }
      },
      'image/jpeg',
      0.9
    );
  },

  monitorImageQuality() {
    const dots = document.querySelectorAll('.quality-dot');
    let quality = 3;

    const interval = setInterval(() => {
      if (!this.cameraStream) {
        clearInterval(interval);
        return;
      }

      quality = Math.floor(Math.random() * 3) + 3;

      dots.forEach((dot, index) => {
        if (index < quality) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      const hint = document.getElementById('cameraHint');
      if (quality === 5) {
        hint.textContent = 'Perfect! Ready to capture';
      } else if (quality === 4) {
        hint.textContent = 'Good lighting';
      } else {
        hint.textContent = 'Move to better lighting';
      }
    }, 1000);
  },

  openGallery() {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
      imageInput.click();
    }
    this.closeCamera();
  },

  toggleFlash() {
    this.showMobileToast('Flash not supported', 'warning');
  },

  vibrateDevice(type = 'click') {
    if (!navigator.vibrate) return;

    const patterns = {
      click: 10,
      success: [50, 30, 50],
      warning: [100, 50, 100, 50, 100],
      error: 200,
    };

    navigator.vibrate(patterns[type] || 10);
  },

  // Barcode Scanner Functions
  showLabelScanner() {
    return this.showBarcodeScanner();
  },

  async showBarcodeScanner() {
    const modal = document.getElementById('barcodeScannerModal');
    if (!modal) {
      console.error('Barcode scanner modal not found');
      return;
    }

    // Check if Quagga is loaded
    if (typeof Quagga === 'undefined') {
      this.showToast('Barcode scanner library not loaded. Please refresh the page.', 'error');
      return;
    }

    // Check camera permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Stop the test stream immediately
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error('Camera access error:', err);
      this.showToast(
        'Camera access denied. Please enable camera permissions in your browser settings.',
        'error'
      );
      return;
    }

    // Close camera if open
    this.closeCamera();

    // Show modal
    modal.classList.remove('hidden');

    // Initialize barcode scanner
    this.initBarcodeScanner();
  },

  closeBarcodeScanner() {
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
      modal.classList.add('hidden');
    }

    // Stop Quagga scanner
    if (typeof Quagga !== 'undefined' && Quagga.stop) {
      Quagga.stop();
    }

    // Clear result display
    const resultDiv = document.getElementById('barcodeResult');
    if (resultDiv) {
      resultDiv.textContent = '';
    }
  },

  initBarcodeScanner() {
    // Check if Quagga is loaded
    if (typeof Quagga === 'undefined') {
      console.error('QuaggaJS library not loaded');
      this.showToast('Barcode scanner not available', 'error');
      return;
    }

    // Initialize QuaggaJS
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: document.querySelector('#barcodeScannerView'),
          constraints: {
            width: 640,
            height: 480,
            facingMode: 'environment', // Use rear camera
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            'ean_reader', // EAN-13, EAN-8
            'ean_8_reader', // EAN-8
            'upc_reader', // UPC-A
            'upc_e_reader', // UPC-E
            'code_128_reader', // Code 128
            'code_39_reader', // Code 39
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Barcode scanner init error:', err);
          this.showToast('Camera access denied or unavailable', 'error');
          this.closeBarcodeScanner();
          return;
        }
        console.log('Barcode scanner initialization complete');
        Quagga.start();
      }
    );

    // Handle detected barcodes
    Quagga.onDetected((data) => {
      if (data && data.codeResult && data.codeResult.code) {
        const barcode = data.codeResult.code;
        console.log('Barcode detected:', barcode);

        // Stop scanning
        Quagga.stop();

        // Display result
        const resultDiv = document.getElementById('barcodeResult');
        if (resultDiv) {
          resultDiv.textContent = `Barcode: ${barcode} - Looking up product...`;
        }

        // Vibrate on success
        this.vibrateDevice('success');

        // Process barcode
        this.processBarcodeResult(barcode);
      }
    });

    // Optional: Draw boxes around detected barcodes
    Quagga.onProcessed((result) => {
      const drawingCtx = Quagga.canvas.ctx.overlay;
      const drawingCanvas = Quagga.canvas.dom.overlay;

      if (result) {
        if (result.boxes) {
          drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute('width')),
            parseInt(drawingCanvas.getAttribute('height'))
          );
          result.boxes
            .filter((box) => {
              return box !== result.box;
            })
            .forEach((box) => {
              Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                color: 'green',
                lineWidth: 2,
              });
            });
        }

        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
            color: '#00F',
            lineWidth: 2,
          });
        }

        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, {
            color: 'red',
            lineWidth: 3,
          });
        }
      }
    });
  },

  async processBarcodeResult(barcode) {
    console.log('Processing barcode:', barcode);
    this.showToast('Barcode detected! Looking up product...', 'info');

    try {
      // Get the auth token
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/api/lookup-barcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ barcode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Barcode lookup failed');
      }

      const productData = await response.json();
      console.log('Product data:', productData);

      if (productData.found) {
        this.showToast('Product found! Details pre-filled.', 'success');
        this.prefillListingFromBarcode(productData);
        this.closeBarcodeScanner();
      } else {
        this.showToast('Product not found in database. Try manual entry.', 'warning');
        const resultDiv = document.getElementById('barcodeResult');
        if (resultDiv) {
          resultDiv.textContent = `Barcode: ${barcode} - Not found`;
        }
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      this.showToast('Barcode lookup failed: ' + error.message, 'error');
    }
  },

  prefillListingFromBarcode(productData) {
    console.log('Pre-filling listing with:', productData);

    // Store product data for reference
    this.state.barcodeProductData = productData;

    // Create a generated listing object from barcode data
    const generatedListing = {
      title: productData.title || '',
      brand: productData.brand || '',
      category: productData.category || '',
      description: this.generateDescriptionFromProduct(productData),
      condition: 'Good', // Default condition for used items
      rrp: productData.rrp || productData.msrp || '',
      price: this.calculateUsedPrice(productData.rrp || productData.msrp || ''),
      keywords: this.extractKeywordsFromProduct(productData),
      sources: productData.source
        ? [{ url: `Barcode: ${productData.barcode}`, title: `Source: ${productData.source}` }]
        : [],
      fromBarcode: true,
    };

    // Store in state
    this.state.generatedListing = generatedListing;

    // Display the listing
    this.displayListing(generatedListing);

    // Show a special indicator that this was from barcode
    const listingContainer = document.querySelector('.listing-container');
    if (listingContainer) {
      // Add a badge or indicator
      const badge = document.createElement('div');
      badge.className = 'barcode-badge';
      badge.style.cssText =
        'background: var(--indigo-500); color: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; text-align: center;';
      badge.textContent = `📷 Scanned from barcode: ${productData.barcode}`;
      listingContainer.insertBefore(badge, listingContainer.firstChild);
    }
  },

  generateDescriptionFromProduct(product) {
    let desc = product.description || '';

    // Add specifications if available
    if (product.specifications) {
      desc += '\n\nSpecifications:\n';
      Object.entries(product.specifications).forEach(([key, value]) => {
        if (value && value !== 'N/A') {
          desc += `• ${key}: ${value}\n`;
        }
      });
    }

    // Add condition note
    if (!desc.includes('Condition:')) {
      desc += '\n\nCondition: Please see photos for actual item condition.';
    }

    return desc.trim();
  },

  calculateUsedPrice(rrp) {
    if (!rrp) return '';

    // Extract numeric value from price string
    const rrpNum = parseFloat(rrp.replace(/[^0-9.]/g, ''));
    if (isNaN(rrpNum)) return '';

    // Used items typically sell for 40-70% of RRP
    const usedMultiplier = 0.55; // 55% of RRP as default
    const usedPrice = (rrpNum * usedMultiplier).toFixed(2);

    // Return with appropriate currency symbol
    if (rrp.includes('£')) return `£${usedPrice}`;
    if (rrp.includes('$')) return `$${usedPrice}`;
    if (rrp.includes('€')) return `€${usedPrice}`;

    return `£${usedPrice}`; // Default to pounds
  },

  extractKeywordsFromProduct(product) {
    const keywords = [];

    // Add brand
    if (product.brand) {
      keywords.push(product.brand.toLowerCase());
    }

    // Extract keywords from title
    if (product.title) {
      const titleWords = product.title.toLowerCase().split(/\s+/);
      titleWords.forEach((word) => {
        if (word.length > 3 && !keywords.includes(word)) {
          keywords.push(word);
        }
      });
    }

    // Add category keywords
    if (product.category) {
      const categoryWords = product.category.toLowerCase().split(/[\s,/]+/);
      categoryWords.forEach((word) => {
        if (word.length > 3 && !keywords.includes(word)) {
          keywords.push(word);
        }
      });
    }

    // Add barcode as keyword
    if (product.barcode) {
      keywords.push(product.barcode);
    }

    // Limit to 15 keywords
    return keywords.slice(0, 15);
  },

  manualBarcodeEntry() {
    const barcode = prompt('Enter barcode number (UPC or EAN):');
    if (barcode && barcode.length >= 8) {
      this.processBarcodeResult(barcode);
    } else if (barcode) {
      this.showToast('Invalid barcode format. Must be at least 8 digits.', 'error');
    }
  },
  showMobileToast(message, type = 'success') {
    // Use unified toast manager
    this.showToast(message, type);
  },

  initSwipeableCards() {
    const cards = document.querySelectorAll('.swipeable-card');

    cards.forEach((card) => {
      if (card.dataset.swipeBound === 'true') return;
      card.dataset.swipeBound = 'true';

      let startX = 0;
      let currentX = 0;
      let isDragging = false;

      const content = card.querySelector('.swipeable-card-content');

      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        content.style.transition = 'none';
      });

      card.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const maxSwipe = 100;
        const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));

        content.style.transform = `translateX(${limitedDiff}px)`;
      });

      card.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = currentX - startX;
        content.style.transition = 'transform 0.3s ease-out';

        if (diff > 80) {
          this.handleSwipeAction(card, 'sold');
        } else if (diff < -80) {
          this.handleSwipeAction(card, 'edit');
        }

        content.style.transform = 'translateX(0)';
      });
    });
  },

  handleSwipeAction(card, action) {
    const listingId = card.getAttribute('data-listing-id');

    if (action === 'edit') {
      this.vibrateDevice('click');
      this.loadListing(listingId);
    } else if (action === 'sold') {
      this.vibrateDevice('success');
      this.markListingSold(listingId);
    }
  },

  initCollapsibleSections() {
    const sections = document.querySelectorAll('.collapsible-section');

    sections.forEach((section) => {
      const header = section.querySelector('.collapsible-header');
      if (!header) return;

      const toggle = () => {
        this.vibrateDevice('click');
        const expanded = section.classList.toggle('expanded');
        header.setAttribute('aria-expanded', expanded);
      };

      if (!header.hasAttribute('tabindex')) {
        header.setAttribute('tabindex', '0');
      }
      header.setAttribute('aria-expanded', section.classList.contains('expanded'));

      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  },

  isMobile() {
    return window.innerWidth < 768;
  },

  initMobileFeatures() {
    this.initCollapsibleSections();

    if (this.isMobile()) {
      this.initBottomNav();
      this.initSwipeableCards();

      const appView = document.getElementById('appView');
      if (appView) {
        appView.classList.add('app-with-bottom-nav');
      }
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.isMobile()) {
          this.initBottomNav();
        }
      }, 250);
    });
  },
};

// Expose app to global scope for inline event handlers
window.app = app;

// Add animations
const style = document.createElement('style');
style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateY(100px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(100px);
                    opacity: 0;
                }
            }
        `;
document.head.appendChild(style);

// Lazy loading animation system with IntersectionObserver
function initLazyAnimations() {
  // Check if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    console.log('User prefers reduced motion - skipping animations');
    return;
  }

  // Define all lazy-loaded animations
  const lazyAnimations = [
    {
      id: 'step1-animation',
      path: '/json_anim/scan-to-pay-illustration-in-line-art-style-2025-10-20-04-28-23-utc.json',
      label: 'Scanning and photographing items',
    },
    {
      id: 'step2-animation',
      path: '/json_anim/online-shopping-time-line-art-illustration-2025-10-20-03-11-10-utc.json',
      label: 'AI processing in real-time',
    },
    {
      id: 'step3-animation',
      path: '/json_anim/shopping-receipt-illustration-in-line-art-style-2025-10-20-04-34-46-utc.json',
      label: 'Completed listing',
    },
    {
      id: 'casual-seller-animation',
      path: '/json_anim/woman-buys-handbag-online-line-art-2025-10-20-04-29-16-utc.json',
      label: 'Casual online shopping',
    },
    {
      id: 'power-seller-animation',
      path: '/json_anim/online-furniture-shopping-line-art-illustration-2025-10-20-04-32-43-utc.json',
      label: 'Professional online selling',
    },
  ];

  // Check if Lottie is available
  if (typeof lottie === 'undefined') {
    console.warn('Lottie library not loaded - animations disabled');
    return;
  }

  // Intersection Observer configuration
  const observerOptions = {
    root: null,
    rootMargin: '200px', // Start loading 200px before entering viewport
    threshold: 0.01,
  };

  // Create observer
  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !entry.target.dataset.loaded) {
        const animId = entry.target.id;
        const animConfig = lazyAnimations.find((a) => a.id === animId);

        if (animConfig) {
          try {
            console.log(`Loading animation: ${animId}`);

            lottie.loadAnimation({
              container: entry.target,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: animConfig.path,
            });

            // Mark as loaded
            entry.target.dataset.loaded = 'true';
          } catch (error) {
            console.error(`Failed to load animation: ${animId}`, error);

            // Show fallback message
            entry.target.innerHTML = `
                                    <div style="
                                        width: 100%;
                                        height: 100%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: var(--text-muted);
                                        font-size: 0.9rem;
                                    ">
                                        Animation unavailable
                                    </div>
                                `;
          }

          // Stop observing this element
          animationObserver.unobserve(entry.target);
        }
      }
    });
  }, observerOptions);

  // Observe all animation containers
  lazyAnimations.forEach(({ id }) => {
    const container = document.getElementById(id);
    if (container) {
      animationObserver.observe(container);
    } else {
      console.warn(`Animation container not found: ${id}`);
    }
  });

  // Pause animations when tab is not visible (save CPU/battery)
  document.addEventListener('visibilitychange', () => {
    if (typeof lottie === 'undefined') return;

    const allAnimations = lottie.getRegisteredAnimations ? lottie.getRegisteredAnimations() : [];

    allAnimations.forEach((animation) => {
      if (document.hidden) {
        animation.pause();
      } else {
        animation.play();
      }
    });
  });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize logo animations
  const logoAnim1 = document.getElementById('logo-animation-1');
  const logoAnim2 = document.getElementById('logo-animation-2');

  if (logoAnim1 && typeof lottie !== 'undefined') {
    try {
      lottie.loadAnimation({
        container: logoAnim1,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/brand/Quicklist Anim White Trimed.json',
      });
    } catch (error) {
      console.error('Failed to load logo animation 1:', error);
    }
  }

  if (logoAnim2 && typeof lottie !== 'undefined') {
    try {
      lottie.loadAnimation({
        container: logoAnim2,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/brand/Quicklist Anim White Trimed.json',
      });
    } catch (error) {
      console.error('Failed to load logo animation 2:', error);
    }
  }

  // Initialize hero animation (load immediately)
  const heroAnimContainer = document.getElementById('hero-animation');
  if (heroAnimContainer && typeof lottie !== 'undefined') {
    try {
      lottie.loadAnimation({
        container: heroAnimContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/json_anim/online-marketplace-website-in-browser-window-2025-11-05-04-21-50-utc.json',
      });
    } catch (error) {
      console.error('Failed to load hero animation:', error);
    }
  }

  // Initialize lazy-loaded animations
  initLazyAnimations();

  app.init();
});
