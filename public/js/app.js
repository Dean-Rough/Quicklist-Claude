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
    currentAppView: 'dashboard',
    wizardPhase: 'photos',
    dashboardMetrics: null,
    uploadedImages: [],
    currentListing: null,
    savedListings: [],
    filteredSavedListings: [],
    loadingSavedItems: false,
    selectedItemForDelete: null,
    selectedListingIds: new Set(),
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

  // HTML entity escaping for safe innerHTML interpolation
  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // URL sanitization — only allow safe protocols
  sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^(https?:\/\/|\/[^\/])/i.test(trimmed)) return trimmed;
    if (/^[a-z0-9]/i.test(trimmed) && !trimmed.includes(':')) return trimmed;
    return '';
  },

  // Escape string for use inside a JS string literal in an onclick attribute
  escapeAttr(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#039;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\');
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

  scriptPromises: {},

  loadScriptOnce(src, { crossOrigin = 'anonymous' } = {}) {
    if (this.scriptPromises[src]) {
      return this.scriptPromises[src];
    }

    this.scriptPromises[src] = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing?.dataset.loaded === 'true') {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement('script');
      const handleLoad = () => {
        script.dataset.loaded = 'true';
        resolve(script);
      };
      const handleError = () => {
        delete this.scriptPromises[src];
        reject(new Error(`Failed to load script: ${src}`));
      };

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });

      if (!existing) {
        script.src = src;
        script.async = true;
        script.defer = true;
        if (crossOrigin) {
          script.crossOrigin = crossOrigin;
        }
        document.head.appendChild(script);
      }
    });

    return this.scriptPromises[src];
  },

  async ensureJSZip() {
    if (window.JSZip) {
      return window.JSZip;
    }

    await this.loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    return window.JSZip;
  },

  async ensureQuagga() {
    if (window.Quagga) {
      return window.Quagga;
    }

    await this.loadScriptOnce('https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js');
    return window.Quagga;
  },

  async ensureLottie() {
    if (window.lottie) {
      return window.lottie;
    }

    await this.loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js');
    return window.lottie;
  },

  async ensureClerkReady() {
    if (window.Clerk) {
      return window.Clerk;
    }

    if (!window.quicklistAuth?.ensureLoaded) {
      throw new Error('Authentication system unavailable');
    }

    const clerk = await window.quicklistAuth.ensureLoaded();
    await this.checkClerkAuth();
    return clerk;
  },

  shouldLoadRichAnimations() {
    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const lowBandwidth = /(^|slow-)2g/.test(connection?.effectiveType || '');
    const saveData = Boolean(connection?.saveData);
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    const smallViewport = window.innerWidth < 1024;

    return !(prefersReducedMotion || lowBandwidth || saveData || lowMemory || smallViewport);
  },

  // ========================================
  // UNIFIED WIZARD FLOW
  // ========================================

  initWizard() {
    // Reset wizard state
    this.state.wizard = {
      step: 'upload',
      uploadedImages: [],
      platform: 'vinted',
      hint: '',
      condition: '',
      detectedItems: [],
      selectedItemIds: new Set(),
      generatedListings: [],
      currentListingIndex: 0,
    };

    // Show upload step, hide others
    this.showWizardStep('upload');
  },

  showWizardStep(step) {
    const steps = ['upload', 'analyze', 'select', 'review', 'export'];
    steps.forEach(s => {
      const el = document.getElementById(`wizardStep-${s}`);
      if (el) el.classList.toggle('hidden', s !== step);
    });

    this.state.wizard.step = step;

    // Update progress indicator
    const stepMap = { upload: 1, analyze: 2, select: 2, review: 3, export: 4 };
    const currentStepNum = stepMap[step] || 1;
    const progressSteps = document.querySelectorAll('#wizardProgress .wizard-step');
    progressSteps.forEach((stepEl) => {
      const stepNum = parseInt(stepEl.dataset.step);
      stepEl.classList.remove('active', 'completed');
      if (stepNum < currentStepNum) {
        stepEl.classList.add('completed');
      } else if (stepNum === currentStepNum) {
        stepEl.classList.add('active');
      }
    });
  },

  async startWizardAnalysis() {
    const images = this.state.wizard.uploadedImages;
    if (images.length === 0) return;

    // Show analyze step
    this.showWizardStep('analyze');

    // Comedy messages
    const comedyMessages = [
      'Warming up the AI...',
      'Squinting at your photos...',
      'Consulting the fashion oracle...',
      'Cross-referencing marketplaces...',
      'Checking the latest trends...',
      'Doing some detective work...',
      'Almost there...',
      'Putting the finishing touches on...',
    ];

    let msgIdx = 0;
    const comedyEl = document.getElementById('wizardAnalyzeComedy');
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % comedyMessages.length;
      if (comedyEl) comedyEl.textContent = comedyMessages[msgIdx];
    }, 2500);

    try {
      // Compress images for API (more aggressive than upload preview to fit Vercel's 4.5 MB limit)
      const base64Images = await this.compressImagesForApi(images);

      // Refresh token if available
      if (window.Clerk?.session) {
        try {
          const freshToken = await window.Clerk.session.getToken();
          if (freshToken) {
            this.state.token = freshToken;
            localStorage.setItem('quicklist-token', freshToken);
          }
        } catch (e) { /* ignore */ }
      }

      const platform = this.state.wizard.platform;
      const hint = this.state.wizard.hint;
      const condition = this.state.wizard.condition;

      if (images.length <= 2) {
        // Single item path — call /api/generate directly
        const statusEl = document.getElementById('wizardAnalyzeStatus');
        if (statusEl) statusEl.textContent = 'Generating your listing...';

        const response = await fetch(`${this.apiUrl}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.state.token}`,
          },
          body: JSON.stringify({
            images: base64Images,
            platform,
            hint: [hint, condition].filter(Boolean).join('. '),
          }),
        });

        clearInterval(msgInterval);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          throw new Error('Generation failed');
        }

        const listing = await response.json();

        // Store listing with images
        this.state.wizard.generatedListings = [{
          ...listing,
          images: images.map(img => ({ preview: img.preview, file: img.file })),
        }];

        // Skip select step, go directly to review
        this.showWizardStep('review');
        this.showWizardReview();

      } else {
        // Multi-item path — call /api/photo-dump/group
        const statusEl = document.getElementById('wizardAnalyzeStatus');
        if (statusEl) statusEl.textContent = 'Grouping your items...';

        const response = await fetch(`${this.apiUrl}/photo-dump/group`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.state.token}`,
          },
          body: JSON.stringify({ images: base64Images }),
        });

        clearInterval(msgInterval);

        if (!response.ok) {
          throw new Error('Grouping failed');
        }

        const results = await response.json();
        this.state.wizard.detectedItems = results.groups.map((group, idx) => ({
          title: group.description || `Item ${idx + 1}`,
          photoIndices: group.photoIndices,
          preview: images[group.photoIndices[0]]?.preview,
        }));

        // Select all by default
        this.state.wizard.selectedItemIds = new Set(
          this.state.wizard.detectedItems.map((_, idx) => idx)
        );

        // Show select step
        this.showWizardStep('select');
        this.renderWizardItemSelection();
      }

    } catch (error) {
      clearInterval(msgInterval);
      console.error('Wizard analysis error:', error);
      this.showToast(error.message || 'Analysis failed. Please try again.', 'error');
      this.showWizardStep('upload');
    }
  },

  showWizardReview() {
    const listings = this.state.wizard.generatedListings;
    const idx = this.state.wizard.currentListingIndex;
    const listing = listings[idx];

    if (!listing) return;

    // Show/hide multi-item navigation
    const nav = document.getElementById('wizardItemNav');
    if (listings.length > 1) {
      nav.style.display = 'flex';
      document.getElementById('wizardItemCounter').textContent = `Item ${idx + 1} of ${listings.length}`;
      document.getElementById('wizardPrevBtn').disabled = idx === 0;
      document.getElementById('wizardNextBtn').disabled = idx === listings.length - 1;
    } else {
      nav.style.display = 'none';
    }

    // Populate image thumbnails
    const imagesGrid = document.getElementById('wizardReviewImages');
    if (listing.images && listing.images.length > 0) {
      imagesGrid.style.display = 'grid';
      imagesGrid.innerHTML = listing.images.map((img, i) => `
        <div class="wizard-upload-thumb">
          <img src="${img.preview || img.url || img}" alt="Photo ${i + 1}" loading="lazy">
        </div>
      `).join('');
    } else {
      imagesGrid.style.display = 'none';
    }

    // Populate fields
    document.getElementById('wizardTitle').value = listing.title || '';
    document.getElementById('wizardBrand').value = listing.brand || '';
    document.getElementById('wizardCategory').value = listing.category || '';
    document.getElementById('wizardReviewCondition').value = listing.condition || '';
    document.getElementById('wizardDescription').value = listing.description || '';
    document.getElementById('wizardRRP').value = listing.rrp || '';
    document.getElementById('wizardPrice').value = listing.price || '';
    document.getElementById('wizardKeywords').value = Array.isArray(listing.keywords)
      ? listing.keywords.join(', ')
      : (listing.keywords || '');
    document.getElementById('wizardReviewPlatform').value = this.state.wizard.platform;

    // Update character counters
    this.updateWizardCharCount('wizardTitle', 'wizardTitleCount', 80);
    this.updateWizardCharCount('wizardDescription', 'wizardDescCount', 1000);

    // Add live character count listeners
    document.getElementById('wizardTitle').oninput = () =>
      this.updateWizardCharCount('wizardTitle', 'wizardTitleCount', 80);
    document.getElementById('wizardDescription').oninput = () =>
      this.updateWizardCharCount('wizardDescription', 'wizardDescCount', 1000);
  },

  updateWizardCharCount(inputId, countId, max) {
    const len = document.getElementById(inputId)?.value?.length || 0;
    const el = document.getElementById(countId);
    if (el) el.textContent = len;
  },

  collectWizardFields() {
    return {
      title: document.getElementById('wizardTitle')?.value || '',
      brand: document.getElementById('wizardBrand')?.value || '',
      category: document.getElementById('wizardCategory')?.value || '',
      condition: document.getElementById('wizardReviewCondition')?.value || '',
      description: document.getElementById('wizardDescription')?.value || '',
      rrp: document.getElementById('wizardRRP')?.value || '',
      price: document.getElementById('wizardPrice')?.value || '',
      keywords: (document.getElementById('wizardKeywords')?.value || '')
        .split(',').map(k => k.trim()).filter(Boolean),
      platform: document.getElementById('wizardReviewPlatform')?.value || 'vinted',
    };
  },

  saveWizardFieldsToState() {
    const idx = this.state.wizard.currentListingIndex;
    const listing = this.state.wizard.generatedListings[idx];
    if (!listing) return;

    const fields = this.collectWizardFields();
    Object.assign(listing, fields);
  },

  wizardPrevItem() {
    this.saveWizardFieldsToState();
    if (this.state.wizard.currentListingIndex > 0) {
      this.state.wizard.currentListingIndex--;
      this.showWizardReview();
    }
  },

  wizardNextItem() {
    this.saveWizardFieldsToState();
    const max = this.state.wizard.generatedListings.length - 1;
    if (this.state.wizard.currentListingIndex < max) {
      this.state.wizard.currentListingIndex++;
      this.showWizardReview();
    }
  },

  async saveWizardItem() {
    this.saveWizardFieldsToState();

    const idx = this.state.wizard.currentListingIndex;
    const listing = this.state.wizard.generatedListings[idx];
    if (!listing) return;

    try {
      // Convert images to base64 for saving
      const imageData = [];
      if (listing.images) {
        for (const img of listing.images) {
          if (img.file) {
            const base64 = await this.fileToBase64(img.file);
            imageData.push({ image_data: base64 });
          }
        }
      }

      const response = await fetch(`${this.apiUrl}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({
          title: listing.title,
          brand: listing.brand,
          category: listing.category,
          condition: listing.condition,
          description: listing.description,
          rrp: listing.rrp,
          price: listing.price,
          keywords: listing.keywords,
          platform: listing.platform || this.state.wizard.platform,
          images: imageData,
        }),
      });

      if (!response.ok) throw new Error('Save failed');

      const saved = await response.json();
      listing.savedId = saved.id || saved.listing?.id;
      this.showToast(`"${listing.title}" saved!`, 'success');

      // Move to export step
      this.showWizardStep('export');
      this.showWizardExport();

    } catch (error) {
      console.error('Save error:', error);
      this.showToast('Failed to save listing. Please try again.', 'error');
    }
  },

  showWizardExport() {
    const listings = this.state.wizard.generatedListings;
    const idx = this.state.wizard.currentListingIndex;
    const listing = listings[idx];

    // Update subtitle
    const subtitle = document.getElementById('wizardExportSubtitle');
    if (subtitle && listing) {
      subtitle.textContent = `"${listing.title}" has been saved to your library.`;
    }

    // Show "Next Item" button if multi-item and more items remain
    const nextItemDiv = document.getElementById('wizardExportNextItem');
    if (nextItemDiv) {
      const hasMore = idx < listings.length - 1;
      nextItemDiv.style.display = hasMore ? 'block' : 'none';
    }
  },

  wizardExportNextItem() {
    this.state.wizard.currentListingIndex++;
    this.showWizardStep('review');
    this.showWizardReview();
  },

  async wizardDownloadZip() {
    const idx = this.state.wizard.currentListingIndex;
    const listing = this.state.wizard.generatedListings[idx];
    if (!listing) return;

    try {
      if (typeof JSZip === 'undefined') {
        this.showToast('ZIP library not loaded. Try again.', 'error');
        return;
      }

      const zip = new JSZip();

      // Add listing text
      const text = [
        `Title: ${listing.title}`,
        `Brand: ${listing.brand}`,
        `Category: ${listing.category}`,
        `Condition: ${listing.condition}`,
        `Description: ${listing.description}`,
        `Price: ${listing.price}`,
        `RRP: ${listing.rrp}`,
        `Keywords: ${Array.isArray(listing.keywords) ? listing.keywords.join(', ') : listing.keywords}`,
        `Platform: ${listing.platform || this.state.wizard.platform}`,
      ].join('\n\n');

      zip.file('listing.txt', text);

      // Add images
      if (listing.images) {
        for (let i = 0; i < listing.images.length; i++) {
          const img = listing.images[i];
          if (img.file) {
            zip.file(`image-${i + 1}.jpg`, img.file);
          }
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(listing.title || 'listing').replace(/[^a-z0-9]/gi, '-').substring(0, 50)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast('ZIP downloaded!', 'success');
    } catch (error) {
      console.error('ZIP download error:', error);
      this.showToast('Failed to create ZIP', 'error');
    }
  },

  async wizardCopyAll() {
    const idx = this.state.wizard.currentListingIndex;
    const listing = this.state.wizard.generatedListings[idx];
    if (!listing) return;

    const text = [
      listing.title,
      '',
      listing.description,
      '',
      `Price: ${listing.price}`,
      listing.brand ? `Brand: ${listing.brand}` : '',
      listing.condition ? `Condition: ${listing.condition}` : '',
      Array.isArray(listing.keywords) && listing.keywords.length
        ? `Keywords: ${listing.keywords.join(', ')}`
        : '',
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Listing copied to clipboard!', 'success');
    } catch (error) {
      this.showToast('Failed to copy', 'error');
    }
  },

  async wizardShare() {
    const idx = this.state.wizard.currentListingIndex;
    const listing = this.state.wizard.generatedListings[idx];
    if (!listing) return;

    const text = `${listing.title}\n\n${listing.description}\n\nPrice: ${listing.price}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, text });
      } catch (e) {
        if (e.name !== 'AbortError') {
          await this.wizardCopyAll();
        }
      }
    } else {
      await this.wizardCopyAll();
    }
  },

  renderWizardItemSelection() {
    const items = this.state.wizard.detectedItems;
    const grid = document.getElementById('wizardItemGrid');
    const countEl = document.getElementById('wizardItemCount');

    if (countEl) countEl.textContent = items.length;

    grid.innerHTML = items.map((item, idx) => `
      <div class="wizard-item-card ${this.state.wizard.selectedItemIds.has(idx) ? 'selected' : ''}"
           data-item-idx="${idx}" onclick="app.toggleWizardItemSelection(${idx})">
        <div class="item-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <img src="${item.preview || ''}" alt="${item.title}" loading="lazy">
        <div class="item-title">${item.title}</div>
        <div class="item-meta">${item.photoIndices.length} photo${item.photoIndices.length !== 1 ? 's' : ''}</div>
      </div>
    `).join('');

    this.updateWizardSelectedCount();
  },

  toggleWizardItemSelection(idx) {
    const selected = this.state.wizard.selectedItemIds;
    if (selected.has(idx)) {
      selected.delete(idx);
    } else {
      selected.add(idx);
    }

    const card = document.querySelector(`[data-item-idx="${idx}"]`);
    if (card) card.classList.toggle('selected');
    this.updateWizardSelectedCount();
  },

  selectAllWizardItems() {
    const items = this.state.wizard.detectedItems;
    this.state.wizard.selectedItemIds = new Set(items.map((_, idx) => idx));
    document.querySelectorAll('.wizard-item-card').forEach(card => card.classList.add('selected'));
    this.updateWizardSelectedCount();
  },

  deselectAllWizardItems() {
    this.state.wizard.selectedItemIds.clear();
    document.querySelectorAll('.wizard-item-card').forEach(card => card.classList.remove('selected'));
    this.updateWizardSelectedCount();
  },

  updateWizardSelectedCount() {
    const count = this.state.wizard.selectedItemIds.size;
    const el = document.getElementById('wizardSelectedCount');
    if (el) el.textContent = count;

    const btn = document.getElementById('wizardGenerateSelectedBtn');
    if (btn) btn.disabled = count === 0;
  },

  async generateSelectedWizardItems() {
    const selected = this.state.wizard.selectedItemIds;
    if (selected.size === 0) {
      this.showToast('Please select at least one item', 'warning');
      return;
    }

    // Show analyze step with generating message
    this.showWizardStep('analyze');
    const statusEl = document.getElementById('wizardAnalyzeStatus');
    if (statusEl) statusEl.textContent = `Generating ${selected.size} listing${selected.size !== 1 ? 's' : ''}...`;

    const comedyMessages = [
      'Writing compelling descriptions...',
      'Researching market prices...',
      'Finding the perfect keywords...',
      'Polishing the copy...',
      'Almost ready...',
    ];

    let msgIdx = 0;
    const comedyEl = document.getElementById('wizardAnalyzeComedy');
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % comedyMessages.length;
      if (comedyEl) comedyEl.textContent = comedyMessages[msgIdx];
    }, 2500);

    try {
      const images = this.state.wizard.uploadedImages;
      const selectedItems = this.state.wizard.detectedItems.filter((_, idx) => selected.has(idx));

      // Calculate total image count for compression scaling
      const totalImageCount = selectedItems.reduce((sum, item) => sum + item.photoIndices.length, 0);
      const maxWidth = totalImageCount > 10 ? 768 : 1024;
      const quality = totalImageCount > 10 ? 0.5 : 0.7;

      // Convert images for each selected group (with compression)
      const groupImages = await Promise.all(
        selectedItems.map(async item => {
          const imgs = await Promise.all(
            item.photoIndices.map(async idx => {
              const compressed = await this.compressImage(images[idx].file, maxWidth, quality);
              return this.fileToBase64(compressed);
            })
          );
          return { images: imgs };
        })
      );

      const response = await fetch(`${this.apiUrl}/photo-dump/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({
          groups: groupImages,
          platform: this.state.wizard.platform,
          hint: this.state.wizard.hint,
        }),
      });

      clearInterval(msgInterval);

      if (!response.ok) throw new Error('Generation failed');

      const results = await response.json();

      // Store generated listings with their images
      this.state.wizard.generatedListings = (results.items || []).map((item, idx) => ({
        ...item,
        images: selectedItems[idx]?.photoIndices.map(photoIdx => ({
          preview: images[photoIdx]?.preview,
          file: images[photoIdx]?.file,
        })) || [],
      }));

      this.state.wizard.currentListingIndex = 0;
      this.showWizardStep('review');
      this.showWizardReview();

    } catch (error) {
      clearInterval(msgInterval);
      console.error('Wizard generation error:', error);
      this.showToast('Generation failed. Please try again.', 'error');
      this.showWizardStep('select');
    }
  },

  async handleWizardUpload(files) {
    if (!files || files.length === 0) return;

    this.showToast(`Compressing ${files.length} image${files.length !== 1 ? 's' : ''}...`, 'info');

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      try {
        const compressed = await this.compressImage(file, 1920, 0.85);
        const compressedFile = compressed instanceof Blob && compressed !== file
          ? new File([compressed], file.name, { type: 'image/jpeg' })
          : file;

        const id = Date.now() + Math.random();
        const preview = URL.createObjectURL(compressedFile);

        this.state.wizard.uploadedImages.push({ id, file: compressedFile, preview });
      } catch (error) {
        console.error('Failed to compress image:', error);
      }
    }

    this.renderWizardImageGrid();
    this.updateWizardAnalyzeButton();

    // Clear file input so same files can be re-selected
    const input = document.getElementById('wizardFileInput');
    if (input) input.value = '';
  },

  renderWizardImageGrid() {
    const grid = document.getElementById('wizardImageGrid');
    const images = this.state.wizard.uploadedImages;

    if (images.length === 0) {
      grid.style.display = 'none';
      return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = images.map((img, idx) => `
      <div class="wizard-upload-thumb">
        <img src="${img.preview}" alt="Photo ${idx + 1}" loading="lazy">
        <div class="thumb-index">${idx + 1}</div>
        <button class="thumb-remove" onclick="app.removeWizardImage('${img.id}')" title="Remove">×</button>
      </div>
    `).join('');
  },

  removeWizardImage(id) {
    const numId = parseFloat(id);
    const idx = this.state.wizard.uploadedImages.findIndex(img => img.id === numId);
    if (idx !== -1) {
      URL.revokeObjectURL(this.state.wizard.uploadedImages[idx].preview);
      this.state.wizard.uploadedImages.splice(idx, 1);
    }
    this.renderWizardImageGrid();
    this.updateWizardAnalyzeButton();
  },

  updateWizardAnalyzeButton() {
    const btn = document.getElementById('wizardAnalyzeBtn');
    if (btn) {
      const count = this.state.wizard.uploadedImages.length;
      btn.disabled = count === 0;
      btn.querySelector('svg').nextSibling.textContent = count > 0
        ? ` Analyze ${count} Photo${count !== 1 ? 's' : ''}`
        : ' Analyze Photos';
    }
  },

  scheduleMarketingAnimations() {
    if (!this.shouldLoadRichAnimations()) {
      return;
    }

    const startAnimations = () => {
      this.ensureLottie()
        .then(() => {
          this.initLogoAnimations();
          this.initHeroAnimation();
          initLazyAnimations();
        })
        .catch((error) => {
          console.warn('Animation enhancement unavailable:', error);
        });
    };

    const queueAnimations = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(startAnimations, { timeout: 2500 });
      } else {
        setTimeout(startAnimations, 600);
      }
    };

    if (document.readyState === 'complete') {
      queueAnimations();
      return;
    }

    window.addEventListener('load', queueAnimations, { once: true });
  },

  initLogoAnimations() {
    if (typeof window.lottie === 'undefined') return;

    [
      { id: 'logo-animation-1', path: '/brand/Quicklist Anim White Trimed.json' },
      { id: 'logo-animation-2', path: '/brand/Quicklist Anim White Trimed.json' },
    ].forEach(({ id, path }) => {
      const container = document.getElementById(id);
      if (!container) return;

      try {
        window.lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path,
        });
        container.classList.add('animation-loaded');
      } catch (error) {
        console.error(`Failed to load ${id}:`, error);
      }
    });
  },

  initHeroAnimation() {
    if (typeof window.lottie === 'undefined') return;

    const heroAnimContainer = document.getElementById('hero-animation');
    if (!heroAnimContainer) return;

    try {
      window.lottie.loadAnimation({
        container: heroAnimContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/json_anim/online-marketplace-website-in-browser-window-2025-11-05-04-21-50-utc.json',
      });
      heroAnimContainer.closest('.hero-image-container')?.classList.add('animation-loaded');
    } catch (error) {
      console.error('Failed to load hero animation:', error);
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

  // Check for first-time users and show onboarding
  checkOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('quicklist-onboarding-v1');
    if (!hasSeenOnboarding && this.state.isAuthenticated) {
      // Show onboarding tour after a brief delay
      setTimeout(() => this.startOnboardingTour(), 800);
    }
  },

  // Onboarding tour state
  onboardingStep: 0,
  onboardingSteps: [
    {
      target: '#photoUploader',
      title: 'Step 1: Upload Photos',
      content: 'Drag and drop your item photos here, or tap to select. More angles = better listings!',
      position: 'bottom'
    },
    {
      target: '#generateBtn',
      title: 'Step 2: AI Magic',
      content: 'Our AI analyzes your photos and generates a complete listing with title, description, and pricing.',
      position: 'top'
    },
    {
      target: '.export-actions, #downloadBtn',
      title: 'Step 3: Export & Sell',
      content: 'Download, copy, or share your listing. Then paste it into Vinted, eBay, or any marketplace!',
      position: 'top'
    }
  ],

  // Start the onboarding tour
  startOnboardingTour() {
    this.onboardingStep = 0;
    this.showOnboardingStep();
  },

  // Show current onboarding step
  showOnboardingStep() {
    // Remove any existing tooltip
    const existing = document.getElementById('onboardingTooltip');
    if (existing) existing.remove();

    const step = this.onboardingSteps[this.onboardingStep];
    if (!step) {
      this.finishOnboarding();
      return;
    }

    const target = document.querySelector(step.target);
    if (!target) {
      // Skip to next step if target not found
      this.onboardingStep++;
      if (this.onboardingStep < this.onboardingSteps.length) {
        this.showOnboardingStep();
      } else {
        this.finishOnboarding();
      }
      return;
    }

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'onboardingTooltip';
    tooltip.innerHTML = `
      <div class="onboarding-backdrop" onclick="app.skipOnboarding()"></div>
      <div class="onboarding-tooltip" style="position: absolute; z-index: 10001;">
        <div class="onboarding-progress">
          ${this.onboardingSteps.map((_, i) => `
            <div class="onboarding-dot ${i === this.onboardingStep ? 'active' : i < this.onboardingStep ? 'completed' : ''}"></div>
          `).join('')}
        </div>
        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 1rem;">${step.title}</h4>
        <p style="margin: 0 0 1rem 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">${step.content}</p>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="app.skipOnboarding()" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">Skip</button>
          <button class="btn btn-primary" onclick="app.nextOnboardingStep()" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">
            ${this.onboardingStep < this.onboardingSteps.length - 1 ? 'Next' : 'Got it!'}
          </button>
        </div>
      </div>
      <style>
        .onboarding-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9999;
        }
        .onboarding-tooltip {
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #333);
          border-radius: 12px;
          padding: 1rem;
          max-width: 300px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .onboarding-progress {
          display: flex;
          gap: 6px;
          margin-bottom: 0.75rem;
        }
        .onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border-color, #333);
        }
        .onboarding-dot.active {
          background: var(--primary, #6c5ce7);
          transform: scale(1.2);
        }
        .onboarding-dot.completed {
          background: var(--success, #10b981);
        }
        .onboarding-highlight {
          position: relative;
          z-index: 10000 !important;
          box-shadow: 0 0 0 4px var(--primary, #6c5ce7), 0 0 20px rgba(108, 92, 231, 0.4);
          border-radius: 8px;
        }
      </style>
    `;
    document.body.appendChild(tooltip);

    // Highlight target element
    target.classList.add('onboarding-highlight');

    // Position tooltip
    const tooltipEl = tooltip.querySelector('.onboarding-tooltip');
    const targetRect = target.getBoundingClientRect();

    if (step.position === 'bottom') {
      tooltipEl.style.top = `${targetRect.bottom + window.scrollY + 12}px`;
      tooltipEl.style.left = `${Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 150, window.innerWidth - 316))}px`;
    } else {
      tooltipEl.style.top = `${targetRect.top + window.scrollY - tooltipEl.offsetHeight - 12}px`;
      tooltipEl.style.left = `${Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 150, window.innerWidth - 316))}px`;
    }

    // Scroll target into view if needed
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  // Move to next onboarding step
  nextOnboardingStep() {
    // Remove highlight from current target
    const currentStep = this.onboardingSteps[this.onboardingStep];
    if (currentStep) {
      const target = document.querySelector(currentStep.target);
      if (target) target.classList.remove('onboarding-highlight');
    }

    this.onboardingStep++;
    if (this.onboardingStep < this.onboardingSteps.length) {
      this.showOnboardingStep();
    } else {
      this.finishOnboarding();
    }
  },

  // Skip onboarding
  skipOnboarding() {
    this.finishOnboarding();
  },

  // Finish onboarding
  finishOnboarding() {
    // Remove tooltip
    const tooltip = document.getElementById('onboardingTooltip');
    if (tooltip) tooltip.remove();

    // Remove any highlights
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });

    // Mark as completed
    localStorage.setItem('quicklist-onboarding-v1', 'true');
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

    // Mock upgrade method for testing
    this.mockUpgrade = async function (planType) {
      if (!this.state.isAuthenticated) {
        this.showToast('Please sign in first', 'error');
        return;
      }

      try {
        this.showLoader();
        const response = await fetch('/api/user/mock-upgrade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.state.token}`,
          },
          body: JSON.stringify({ planType }),
        });

        const data = await response.json();

        if (response.ok) {
          this.showToast(`Upgraded to ${planType} plan!`, 'success');
          // Refresh status on frontend
          await this.checkClerkAuth();
          if (!this.state.isAuthenticated) {
            await this.checkAuth();
          }
          this.updatePersonalityDropdown();
        } else {
          this.showToast(data.error || 'Upgrade failed', 'error');
        }
      } catch (error) {
        console.error('Upgrade error:', error);
        this.showToast('Failed to change plan', 'error');
      } finally {
        this.hideLoader();
      }
    };

    // Setup Clerk event listeners BEFORE waiting for auth
    this.setupClerkListeners();

    // Auth bootstrap is lazy. Only wait briefly if a bootstrap event is still pending.
    await new Promise((resolve) => {
      if (window.quicklistAuthReady) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(resolve, 250);
      window.addEventListener(
        'authReady',
        () => {
          clearTimeout(timeoutId);
          resolve();
        },
        { once: true }
      );
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

    // Check for onboarding tour (after auth is established)
    this.checkOnboarding();

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
            url: img.image_url || img.thumbnail_url || img.data,
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
    // Settings
    const settingAutoDownload = document.getElementById('settingAutoDownload');
    if (settingAutoDownload) {
      settingAutoDownload.addEventListener('change', (e) => {
        this.state.settings.autoDownloadZip = e.target.checked;
        this.saveSettings();
      });
    }

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
              this.navigateToApp('createListing');
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
    try {
      const files = Array.from(event.target.files || []);
      console.log('handleImageUpload called with', files.length, 'files');
      if (files.length === 0) {
        console.warn('No files selected');
        return;
      }
      await this.processFiles(files);
      // Reset input so same file can be selected again
      event.target.value = '';
    } catch (error) {
      console.error('Error in handleImageUpload:', error);
      this.showToast('Failed to upload images. Please try again.', 'error');
    }
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
    console.log('processFiles called with', files?.length, 'files');
    if (!files || files.length === 0) {
      console.warn('No files to process');
      return;
    }

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
          isMain: this.state.uploadedImages.length === 0, // First image is main by default
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

        // Real blur detection using Laplacian variance (local, no API call)
        this.detectBlur(imageData.file)
          .then((isBlurry) => {
            imageData.status = 'ready';
            imageData.isBlurry = isBlurry;
            this.renderImageGrid();
            this.updateGenerateButton();
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
    console.log('renderImageGrid called, grid element:', !!grid, 'uploadedImages:', this.state.uploadedImages?.length);

    grid.innerHTML = this.state.uploadedImages
      .map(
        (img, index) => `
                    <div class="image-thumbnail ${img.isMain ? 'main-image' : ''}" style="position: relative;" onclick="app.setMainImage('${img.id}')">
                        <img src="${img.url}" alt="Uploaded">
                        <button class="image-thumbnail-delete" onclick="event.stopPropagation(); app.deleteImage('${img.id}')" aria-label="Delete image">×</button>
                        ${img.isMain
            ? `<div class="main-image-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Main</div>
               ${!img.studioEnhanced ? `<button class="studio-edit-btn" onclick="event.stopPropagation(); app.studioEditImage('${img.id}')" title="Transform to studio photo (uses 1 credit)">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                 Studio Edit
               </button>` : '<div class="studio-enhanced-badge">Studio</div>'}`
            : '<div class="set-main-badge">Set as Main</div>'
          }
                        ${img.status === 'checking'
            ? '<div class="image-thumbnail-status">Checking...</div>'
            : img.isBlurry
              ? '<div class="image-thumbnail-status warning"><span style="width: 20px; height: 20px; display: inline-flex;"><svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Blur Detected</div>'
              : ''
          }
                    </div>
                `
      )
      .join('');

    this.renderReviewImages();
  },

  // Set main image (for studio processing and thumbnail)
  setMainImage(id) {
    this.state.uploadedImages = this.state.uploadedImages.map(img => ({
      ...img,
      isMain: img.id === id
    }));
    this.renderImageGrid();
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

  // Studio Edit - Transform main image to studio photo using NanoBanana2
  async studioEditImage(id) {
    const img = this.state.uploadedImages.find((img) => img.id === id);
    if (!img) return;

    // Check if user has credits available
    const hasCredits = await this.checkAvailableCredits();
    if (!hasCredits) {
      this.showToast('No credits available. Upgrade to Pro for more studio edits.', 'warning');
      return;
    }

    // Show confirmation
    if (!confirm('Transform this image to a studio photo? This uses 1 credit.')) {
      return;
    }

    // Show loading state
    img.status = 'enhancing';
    this.renderImageGrid();

    try {
      const base64 = await this.fileToBase64(img.file);
      const bgStyle = document.getElementById('studioBackground')?.value || 'white';
      const lightStyle = document.getElementById('studioLighting')?.value || 'soft';

      const response = await fetch(`${this.apiUrl}/enhance-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({
          image: base64,
          background: bgStyle,
          lighting: lightStyle
        }),
      });

      if (!response.ok) {
        throw new Error('Studio enhancement failed');
      }

      const data = await response.json();

      if (data.enhancedImage) {
        // Update the image with enhanced version
        img.originalUrl = img.url; // Keep original
        img.url = data.enhancedImage;
        img.studioEnhanced = true;
        img.status = 'ready';

        this.showToast('Studio photo created!', 'success');
        this.renderImageGrid();
      } else {
        throw new Error('No enhanced image returned');
      }
    } catch (error) {
      console.error('Studio edit error:', error);
      img.status = 'ready';
      this.renderImageGrid();
      this.showToast('Studio edit failed. Please try again.', 'error');
    }
  },

  // Check if user has available credits for studio edit
  async checkAvailableCredits() {
    try {
      const response = await fetch(`${this.apiUrl}/usage`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const used = data.listingsCreated || 0;
        const limit = data.limit || 5;
        return used < limit;
      }
      return false;
    } catch (error) {
      console.error('Error checking credits:', error);
      return false;
    }
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
    this.navigateToApp('createListing');
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

  startVoiceInput(fieldId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast('Voice input is not supported in your browser.', 'error');
      this.stopVoiceInput();
      return;
    }

    if (this._recognition) {
      this.stopVoiceInput();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    this._recognition = recognition;
    const inputField = document.getElementById(fieldId);

    if (!inputField) {
      this.stopVoiceInput();
      return;
    }

    let finalTranscript = inputField.value ? inputField.value + ' ' : '';
    const initialTranscriptLength = finalTranscript.length;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      finalTranscript += currentFinal;
      // Prevent duplicating text if the field was already populated, but add the new text
      inputField.value = finalTranscript + interimTranscript;
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        this.showToast(`Microphone error: ${event.error}`, 'error');
      }
      this.stopVoiceInput();
    };

    recognition.onend = () => {
      this.stopVoiceInput();
    };

    try {
      recognition.start();
      this.showToast('Listening... Speak now.', 'info');
    } catch (err) {
      console.error('Failed to start recognition:', err);
      this.stopVoiceInput();
    }
  },

  stopVoiceInput() {
    if (this._recognition) {
      try {
        this._recognition.stop();
      } catch (e) {
        // ignore
      }
      this._recognition = null;
    }

    document.querySelectorAll('.voice-input-button.listening').forEach((btn) => {
      btn.classList.remove('listening');
      btn.setAttribute('aria-pressed', 'false');
    });
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
                        ${condition ? condition + ' · ' : ''}${analysis.damages.length} issue${analysis.damages.length === 1 ? '' : 's'} detected.
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

      const response = await fetch(`${this.apiUrl}/analyze-image-quality`, {
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
                            <h3>Image Quality Issues Detected</h3>
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

                            ${quality.criticalIssues && quality.criticalIssues.length > 0
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

                            ${quality.recommendations && quality.recommendations.length > 0
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
      // Compress images for API (aggressive to fit Vercel's 4.5 MB limit)
      const images = await this.compressImagesForApi(this.state.uploadedImages);

      const response = await fetch(`${this.apiUrl}/analyze-damage`, {
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
                                ${damageData.conditionJustification
        ? `
                                    <p style="margin-top: 1rem; color: var(--text-secondary);">
                                        ${damageData.conditionJustification}
                                    </p>
                                `
        : ''
      }
                            </div>

                            ${damageData.damageFound
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
                                                ${damage.estimatedSize
                ? `
                                                    <p><strong>Size:</strong> ${damage.estimatedSize}</p>
                                                `
                : ''
              }
                                                ${damage.confidence !== undefined
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
                                <h4>Suggested Condition Disclosure</h4>
                                <div class="damage-disclosure-text">
                                    ${damageData.conditionDisclosure}
                                </div>
                                <button class="btn btn-secondary" style="margin-top: 0.5rem;" onclick="app.addDamageDisclosure()">
                                    Add to Description
                                </button>
                            </div>

                            ${damageData.recommendations && damageData.recommendations.length > 0
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

                            ${damageData.honestyScore !== undefined
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
      stain: 'Stain',
      tear: 'Tear/Hole',
      scratch: 'Scratch',
      discoloration: 'Discoloration',
      missing_part: 'Missing Part',
      structural: 'Structural Damage',
      wear: 'Normal Wear',
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

    // Close input sheet
    this.closeInputSheet();

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

    // Start comedy loading cycler
    this.startComedyCycler();

    try {
      // Get ALL uploaded images
      const platform = this.getPlatform();
      const hint = this.getItemHint();
      const location = document.getElementById('itemLocation')?.value || '';

      // Compress images for API (aggressive to fit Vercel's 4.5 MB limit)
      const base64Images = await this.compressImagesForApi(this.state.uploadedImages);

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

      // Post-generation referral nudge on 2nd generation
      const genCount = parseInt(localStorage.getItem('ql_gen_count') || '0', 10) + 1;
      localStorage.setItem('ql_gen_count', String(genCount));
      if (genCount === 2) {
        setTimeout(() => this.showReferralNudge(), 1500);
      }

      // Show result state
      loadingState.classList.add('hidden');
      resultState.classList.remove('hidden');
      const fab = document.getElementById('newListingFab');
      if (fab) fab.classList.add('hidden');
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
    this.clearComedyCycler();

    // Reset loading state HTML
    loadingState.innerHTML = '';

    this.state.damageAnalysis = null;
    this.updateDamageSummary();
    this.renderReviewImages();
    this.setWizardPhase('photos');
    const fab = document.getElementById('newListingFab');
    if (fab) fab.classList.remove('hidden');
  },

  openInputSheet() {
    const sheet = document.getElementById('inputSheet');
    const backdrop = document.getElementById('sheetBackdrop');
    const fab = document.getElementById('newListingFab');
    if (!sheet) return;
    sheet.classList.add('open');
    backdrop.classList.add('open');
    if (fab) fab.classList.add('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeInputSheet(confirmIfImages = false) {
    if (confirmIfImages && this.state.uploadedImages?.length > 0) {
      if (!confirm('Discard uploaded images and close?')) return;
      this.state.uploadedImages = [];
      this.renderImageGrid();
      this.updateGenerateButton();
    }
    const sheet = document.getElementById('inputSheet');
    const backdrop = document.getElementById('sheetBackdrop');
    const fab = document.getElementById('newListingFab');
    if (!sheet) return;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    if (fab) fab.classList.remove('hidden');
    document.body.style.overflow = '';
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

    // Simplified tier hierarchy: free < pro < unlimited
    const tierLevels = { free: 0, pro: 1, unlimited: 2 };
    const userLevel = tierLevels[userTier] || 0;

    // Enable/disable options based on tier
    const options = select.querySelectorAll('option');
    options.forEach((option) => {
      const requiredTier = option.dataset.tier || 'free';
      const requiredLevel = tierLevels[requiredTier] || 0;

      if (userLevel >= requiredLevel) {
        option.disabled = false;
        // Remove lock emoji from text if user has access
        option.textContent = option.textContent.replace(/^\[Pro\]\s*/, '');
      } else {
        option.disabled = true;
        // Add Pro marker if not already there
        if (!option.textContent.startsWith('[Pro]')) {
          option.textContent = '[Pro] ' + option.textContent;
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
    const studioControls = document.getElementById('studioControls');
    const studioBackground = document.getElementById('studioBackground');
    const studioLighting = document.getElementById('studioLighting');
    if (!toggle) return;

    const tierLevels = { free: 0, pro: 1, unlimited: 2 };
    const userLevel = tierLevels[userTier] || 0;
    const requiredLevel = 1; // Pro or higher required for enhancement

    if (userLevel >= requiredLevel) {
      toggle.disabled = false;
      if (description) {
        description.textContent =
          'AI-powered image improvements, auto-tagging, OCR, and quality analysis';
      }
      // Enable studio controls for Pro and Unlimited tiers
      if (studioControls) {
        studioControls.style.display = 'block';
        if (studioBackground) studioBackground.disabled = false;
        if (studioLighting) studioLighting.disabled = false;
      }
    } else {
      toggle.disabled = true;
      toggle.checked = false;
      if (description) {
        description.innerHTML =
          'Upgrade to <strong>Pro</strong> or <strong>Unlimited</strong> for AI image enhancements';
      }
      // Hide studio controls for free tier
      if (studioControls) {
        studioControls.style.display = 'none';
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

    // Always get a fresh Clerk token before generation — JWTs are short-lived
    if (window.Clerk?.session) {
      try {
        const freshToken = await window.Clerk.session.getToken();
        if (freshToken) {
          this.state.token = freshToken;
          localStorage.setItem('quicklist-token', freshToken);
        }
      } catch (e) { }
    }

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
  /**
   * Compress an image file before upload
   * @param {File} file - Image file to compress
   * @param {number} maxWidth - Maximum width in pixels (default: 1920)
   * @param {number} quality - JPEG quality 0-1 (default: 0.85)
   * @returns {Promise<Blob>} Compressed image blob
   */
  async compressImage(file, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
      // Skip compression for very small images
      if (file.size < 100 * 1024) { // < 100KB
        resolve(file);
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image to canvas with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Only use compressed version if it's actually smaller
              resolve(blob.size < file.size ? blob : file);
            } else {
              resolve(file);
            }
            // Clean up
            URL.revokeObjectURL(img.src);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = URL.createObjectURL(file);
    });
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Compress images for API transmission.
   * Uses more aggressive compression than the upload preview to stay
   * within Vercel's 4.5 MB serverless body limit.
   * @param {Array<{file: File|Blob}>} images - Array of image objects with .file property
   * @returns {Promise<string[]>} Array of base64 data-URL strings
   */
  async compressImagesForApi(images) {
    const count = images.length;
    // Scale compression based on image count to keep total payload under ~4 MB
    const maxWidth = count > 10 ? 768 : 1024;
    const quality = count > 10 ? 0.5 : 0.7;

    return Promise.all(
      images.map(async (img) => {
        const compressed = await this.compressImage(img.file, maxWidth, quality);
        return this.fileToBase64(compressed);
      })
    );
  },

  startComedyCycler() {
    const messages = [
      "Squinting at your photos...",
      "Checking what it's going for on eBay...",
      "Running the numbers...",
      "Polishing the description...",
      "Wiping the marks off...",
      "Arguing with the pricing algorithm...",
      "Adding a sprinkle of charm...",
      "Nearly there, just buffing it up...",
      "Zooming in on the labels...",
      "Cross-referencing the model code...",
      "Checking sold listings...",
      "Fact-checking the brand name...",
      "Measuring the dimensions...",
      "Inspecting the condition...",
      "Looking up the RRP...",
      "Calculating depreciation...",
      "Researching the product line...",
      "Verifying the colourway...",
      "Scanning for defects...",
      "Checking market demand...",
      "Comparing to similar items...",
      "Validating the size info...",
      "Reading the care labels...",
      "Analysing the materials...",
      "Estimating postage costs...",
      "Double-checking everything...",
      "Finalising the keywords...",
      "Crafting the perfect title...",
      "Just a moment longer...",
    ];

    const loadingState = document.getElementById('loadingState');
    if (!loadingState) return;

    loadingState.innerHTML = `
      <div class="comedy-loading">
        <div class="comedy-loading-text"><span id="comedyMsg">${messages[0]}</span></div>
        <div class="comedy-progress-bar"><div class="comedy-progress-bar-fill"></div></div>
        <button id="cancelGenerationBtn" class="btn btn-secondary" onclick="app.cancelGeneration()" style="display:none;margin-top:1rem;">
          Cancel
        </button>
      </div>
    `;

    let idx = 0;
    const el = document.getElementById('comedyMsg');

    const cancelTimer = setTimeout(() => {
      const btn = document.getElementById('cancelGenerationBtn');
      if (btn) btn.style.display = 'inline-flex';
    }, 4000);

    this.state._comedyCancelTimer = cancelTimer;
    this.state._comedyInterval = setInterval(() => {
      if (!el || this.state.generationCancelled) return;
      el.classList.add('fade-out');
      setTimeout(() => {
        idx = (idx + 1) % messages.length;
        if (el) {
          el.textContent = messages[idx];
          el.classList.remove('fade-out');
        }
      }, 400);
    }, 2500);
  },

  clearComedyCycler() {
    if (this.state._comedyInterval) {
      clearInterval(this.state._comedyInterval);
      this.state._comedyInterval = null;
    }
    if (this.state._comedyCancelTimer) {
      clearTimeout(this.state._comedyCancelTimer);
      this.state._comedyCancelTimer = null;
    }
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
    const rawOutput = document.getElementById('rawOutput');
    if (rawOutput) {
      rawOutput.value = JSON.stringify(listing, null, 2);
    }
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

    // Show pricing section for all platforms (enhanced display)
    const suggestedPrice = document.getElementById('outputPrice')?.value || listing.price || '';
    const rrp = document.getElementById('outputRRP')?.value || listing.rrp || '';

    if ((pricingIntelligence || suggestedPrice) && pricingSection) {
      pricingSection.style.display = 'block';

      let html = '';

      // Universal pricing explanation header
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="width: 40px; height: 40px; background: var(--primary, #6c5ce7); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <div style="font-weight: 600; color: var(--text-primary);">Suggested Price: ${suggestedPrice}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">AI-recommended based on similar items</div>
          </div>
        </div>
      `;

      // Show RRP comparison if available
      if (rrp && rrp !== '£0' && rrp !== suggestedPrice) {
        const rrpNum = parseFloat(rrp.replace(/[^0-9.]/g, ''));
        const priceNum = parseFloat(suggestedPrice.replace(/[^0-9.]/g, ''));
        if (rrpNum > priceNum && rrpNum > 0) {
          const discount = Math.round((1 - priceNum / rrpNum) * 100);
          html += `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success, #10b981); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
              <div style="font-size: 0.9rem; color: var(--success, #10b981);">
                <strong>${discount}% off RRP</strong> — Great value for buyers!
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                Original retail: ${rrp}
              </div>
            </div>
          `;
        }
      }

      // Detailed pricing intel for eBay
      if (pricingIntelligence && platform === 'ebay') {
        html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">';

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
        html += '</div>';
      } else if (!pricingIntelligence) {
        // Simplified pricing tips for non-eBay platforms
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        html += `
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; background: var(--bg-tertiary, var(--bg-secondary)); padding: 0.75rem; border-radius: 8px;">
            <p style="margin: 0 0 0.5rem 0;"><strong>Pricing tips for ${platformName}:</strong></p>
            <ul style="margin: 0; padding-left: 1.25rem;">
              <li>Check similar items on ${platformName} before listing</li>
              <li>Factor in platform fees (typically 10-15%)</li>
              <li>Price competitively for faster sales</li>
            </ul>
          </div>
        `;
      }

      if (pricingIntelligence && pricingIntelligence.recommendations && pricingIntelligence.recommendations.length > 0) {
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
    } else if (pricingSection) {
      pricingSection.style.display = 'none';
    }

    // Show Post to eBay button if platform is eBay
    const postBtn = document.getElementById('postToEbayBtn');
    if (postBtn) {
      postBtn.style.display = platform === 'ebay' ? 'block' : 'none';
    }

    // Display stock image if found
    this.displayStockImage(stockImageData || listing.stockImageData);

    // Display listing quality score
    this.displayListingScore();
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
                            ${stockImageData.alternatives && stockImageData.alternatives.length > 0
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
                                ${stockImageData.alternatives &&
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

                    ${hasValidData
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

                        ${predictedPrice
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
                                ${predictedPrice.marketInsights
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

                        ${pricingData.soldExamples && pricingData.soldExamples.length > 0
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

                        ${predictedPrice && predictedPrice.reasoning
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
    if (this.state.imageEnhancementEnabled) {
      try {
        this.showToast('Enhancing with Nano Banana 2...', 'info');

        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(imageFile);
        const base64Image = await base64Promise;

        const backgroundType = document.getElementById('studioBackground')?.value || 'neutral';
        const lightingType = document.getElementById('studioLighting')?.value || 'soft';

        const token = await this.getAuthToken();
        const response = await fetch(`${this.apiUrl}/enhance-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image: base64Image,
            background: backgroundType,
            lighting: lightingType
          }),
        });

        if (!response.ok) {
          throw new Error('Enhancement failed');
        }

        const data = await response.json();

        if (data.success && data.enhancedImage) {
          // Convert base64 back to Blob for the form data
          const res = await fetch(data.enhancedImage);
          const blob = await res.blob();
          this.showToast('Image enhanced successfully!', 'success');
          return blob;
        }
      } catch (error) {
        console.error('Nano Banana 2 Enhancement Error:', error);
        this.showToast('Enhancement failed, using original image.', 'warning');
      }
    }

    // Fallback method
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

        // Get user-selected background and lighting options
        const backgroundType = document.getElementById('studioBackground')?.value || 'neutral';
        const lightingType = document.getElementById('studioLighting')?.value || 'soft';

        // Apply background based on selection
        switch (backgroundType) {
          case 'white':
            ctx.fillStyle = '#FFFFFF';
            break;
          case 'gradient':
            const gradient = ctx.createLinearGradient(0, 0, 0, 1200);
            gradient.addColorStop(0, '#F8F8F8');
            gradient.addColorStop(1, '#E0E0E0');
            ctx.fillStyle = gradient;
            break;
          case 'warm':
            ctx.fillStyle = '#FFF8F0';
            break;
          case 'cool':
            ctx.fillStyle = '#F0F5FF';
            break;
          case 'neutral':
          default:
            ctx.fillStyle = '#F5F5F5';
            break;
        }
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

        // Apply lighting/shadow based on selection
        switch (lightingType) {
          case 'dramatic':
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetY = 20;
            ctx.shadowOffsetX = 10;
            break;
          case 'none':
            // No shadow
            ctx.shadowColor = 'transparent';
            break;
          case 'glow':
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 40;
            break;
          case 'soft':
          default:
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
            break;
        }

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
      const JSZipLib = await this.ensureJSZip();
      const zip = new JSZipLib();
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

      const getStock = document.getElementById('toggleStock')?.checked || false;
      // Add stock image if enabled and available
      if (getStock && this.state.currentListing?.stockImageUrl) {
        btn.innerHTML = '<span class="spinner"></span> Fetching stock image...';
        try {
          const res = await fetch(this.state.currentListing.stockImageUrl);
          if (res.ok) {
            const stockBlob = await res.blob();
            let ext = 'jpg';
            if (this.state.currentListing.stockImageUrl.toLowerCase().split('?')[0].endsWith('.png')) ext = 'png';
            else if (this.state.currentListing.stockImageUrl.toLowerCase().split('?')[0].endsWith('.webp')) ext = 'webp';
            zip.file(`stock-image.${ext}`, stockBlob);
          }
        } catch (err) {
          console.error("Failed to fetch stock image for ZIP:", err);
        }
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

      // Show success modal after brief delay
      setTimeout(() => this.showExportSuccess('downloaded'), 500);
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

  handleOutsideClick: function (e) {
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
      const JSZipLib = await this.ensureJSZip();
      const zip = new JSZipLib();

      for (let i = 0; i < this.state.uploadedImages.length; i++) {
        const img = this.state.uploadedImages[i];
        const blob = await fetch(img.url).then(r => r.blob());
        zip.file(`image-${i + 1}.jpg`, blob);
      }

      const getStock = document.getElementById('toggleStock')?.checked || false;
      if (getStock && this.state.currentListing?.stockImageUrl) {
        try {
          const res = await fetch(this.state.currentListing.stockImageUrl);
          if (res.ok) {
            const stockBlob = await res.blob();
            let ext = 'jpg';
            if (this.state.currentListing.stockImageUrl.toLowerCase().split('?')[0].endsWith('.png')) ext = 'png';
            else if (this.state.currentListing.stockImageUrl.toLowerCase().split('?')[0].endsWith('.webp')) ext = 'webp';
            zip.file(`stock-image.${ext}`, stockBlob);
          }
        } catch (err) {
          console.error("Failed to fetch stock image for ZIP:", err);
        }
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
  async copyAll(showSuccessModal = true) {
    const text = this.getListingText();
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Listing copied to clipboard!');
      if (showSuccessModal) {
        setTimeout(() => this.showExportSuccess('copied'), 300);
      }
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('Listing copied to clipboard!');
      if (showSuccessModal) {
        setTimeout(() => this.showExportSuccess('copied'), 300);
      }
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
        setTimeout(() => this.showExportSuccess('shared'), 300);
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.showToast('Share failed', 'error');
        }
      }
    } else {
      // Fallback: copy to clipboard
      await this.copyAll(false); // Don't show double modal
      this.showToast('Share not supported - copied to clipboard instead');
      setTimeout(() => this.showExportSuccess('copied'), 300);
    }
  },

  // Alias for shareNative (used in HTML)
  async shareListing() {
    return this.shareNative();
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
        this.copyAll(false); // Copy listing first, no modal (they're leaving)
        this.showToast('Listing copied! Paste into eBay form.');
        break;
      case 'vinted':
        // Vinted sell page
        url = 'https://www.vinted.co.uk/items/new';
        this.copyAll(false); // No modal
        this.showToast('Listing copied! Paste into Vinted form.');
        break;
    }

    if (url) {
      window.open(url, '_blank');
    }
  },

  // ============================================
  // EXPORT SUCCESS FLOW
  // ============================================

  // Show export success modal
  showExportSuccess(action = 'copied') {
    const modal = document.getElementById('exportSuccessModal');
    const messageEl = document.getElementById('exportSuccessMessage');

    const messages = {
      copied: 'Your listing has been copied to clipboard. Now paste it into your marketplace.',
      downloaded: 'Your listing files have been downloaded. Upload the images and paste the text into your marketplace.',
      shared: 'Your listing has been shared successfully.',
      emailed: 'Your listing has been sent to your email.'
    };

    messageEl.textContent = messages[action] || messages.copied;
    modal.classList.remove('hidden');
    modal.classList.add('active');

    // Track conversion
    if (typeof gtag !== 'undefined') {
      gtag('event', 'export_complete', {
        'event_category': 'listing',
        'event_label': action
      });
    }
  },

  // Close export success modal
  closeExportSuccess() {
    const modal = document.getElementById('exportSuccessModal');
    modal.classList.add('hidden');
    modal.classList.remove('active');
  },

  // Start new listing (from success modal)
  startNewListing() {
    this.closeExportSuccess();

    // Reset state
    this.state.uploadedImages = [];
    this.state.currentListing = null;

    // Clear UI
    const previewGrid = document.getElementById('previewGrid');
    if (previewGrid) previewGrid.innerHTML = '';

    const itemHint = document.getElementById('itemHint');
    if (itemHint) itemHint.value = '';

    const conditionInfo = document.getElementById('conditionInfo');
    if (conditionInfo) conditionInfo.value = '';

    // Show initial state
    this.showInitialState();
    this.setWizardPhase('photos');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.showToast('Ready for your next listing!', 'success');
  },

  // ============================================
  // LISTING QUALITY SCORE
  // ============================================

  // Calculate listing quality score
  calculateListingScore() {
    const score = {
      total: 0,
      breakdown: [],
      suggestions: []
    };

    // Title (25 points max)
    const title = document.getElementById('outputTitle')?.value || '';
    const titleLength = title.length;
    if (titleLength >= 40 && titleLength <= 80) {
      score.total += 25;
      score.breakdown.push({ label: 'Title length', points: 25, max: 25, status: 'good' });
    } else if (titleLength >= 20 && titleLength < 40) {
      score.total += 15;
      score.breakdown.push({ label: 'Title length', points: 15, max: 25, status: 'ok' });
      score.suggestions.push('Add more detail to your title (aim for 40-80 characters)');
    } else if (titleLength > 80) {
      score.total += 18;
      score.breakdown.push({ label: 'Title length', points: 18, max: 25, status: 'ok' });
      score.suggestions.push('Title is a bit long - consider trimming to under 80 characters');
    } else {
      score.total += 5;
      score.breakdown.push({ label: 'Title length', points: 5, max: 25, status: 'poor' });
      score.suggestions.push('Title is too short - add brand, size, color, or condition');
    }

    // Description (25 points max)
    const description = document.getElementById('outputDescription')?.value || '';
    const descLength = description.length;
    const hasKeyDetails = /\b(size|condition|brand|color|material|measurements?)\b/i.test(description);

    if (descLength >= 150 && hasKeyDetails) {
      score.total += 25;
      score.breakdown.push({ label: 'Description', points: 25, max: 25, status: 'good' });
    } else if (descLength >= 80) {
      score.total += 18;
      score.breakdown.push({ label: 'Description', points: 18, max: 25, status: 'ok' });
      if (!hasKeyDetails) {
        score.suggestions.push('Add measurements, material, or specific condition details');
      }
    } else {
      score.total += 8;
      score.breakdown.push({ label: 'Description', points: 8, max: 25, status: 'poor' });
      score.suggestions.push('Add more description - buyers want details about condition and fit');
    }

    // Photos (25 points max)
    const photoCount = this.state.uploadedImages?.length || 0;
    const hasBlurry = this.state.uploadedImages?.some(img => img.isBlurry) || false;

    if (photoCount >= 4 && !hasBlurry) {
      score.total += 25;
      score.breakdown.push({ label: 'Photos', points: 25, max: 25, status: 'good' });
    } else if (photoCount >= 2) {
      score.total += 15 + (hasBlurry ? 0 : 5);
      score.breakdown.push({ label: 'Photos', points: 15 + (hasBlurry ? 0 : 5), max: 25, status: 'ok' });
      if (photoCount < 4) {
        score.suggestions.push('Add more photos (4+ recommended) - show different angles');
      }
      if (hasBlurry) {
        score.suggestions.push('Some photos are blurry - consider retaking for better quality');
      }
    } else {
      score.total += 5;
      score.breakdown.push({ label: 'Photos', points: 5, max: 25, status: 'poor' });
      score.suggestions.push('Add more photos! Listings with 4+ photos sell faster');
    }

    // Price & brand completeness (25 points max)
    const price = document.getElementById('outputPrice')?.value || '';
    const brand = document.getElementById('outputBrand')?.value || '';
    const condition = document.getElementById('outputCondition')?.value || '';

    let completenessPoints = 0;
    if (price && price !== '£0' && price !== '0') completenessPoints += 10;
    else score.suggestions.push('Add a price to your listing');

    if (brand && brand.toLowerCase() !== 'unknown' && brand.toLowerCase() !== 'unbranded') completenessPoints += 10;
    else score.suggestions.push('Add brand if known - branded items sell better');

    if (condition) completenessPoints += 5;

    score.total += completenessPoints;
    score.breakdown.push({ label: 'Completeness', points: completenessPoints, max: 25, status: completenessPoints >= 20 ? 'good' : completenessPoints >= 10 ? 'ok' : 'poor' });

    // Determine overall rating
    if (score.total >= 85) {
      score.rating = 'excellent';
      score.label = 'Excellent';
      score.color = 'var(--success, #10b981)';
    } else if (score.total >= 65) {
      score.rating = 'good';
      score.label = 'Good';
      score.color = 'var(--success, #10b981)';
    } else if (score.total >= 45) {
      score.rating = 'fair';
      score.label = 'Needs Work';
      score.color = 'var(--warning, #f59e0b)';
    } else {
      score.rating = 'poor';
      score.label = 'Poor';
      score.color = 'var(--error, #ef4444)';
    }

    return score;
  },

  // Display listing score badge
  displayListingScore() {
    const score = this.calculateListingScore();

    // Find or create score container
    let scoreContainer = document.getElementById('listingScoreContainer');
    if (!scoreContainer) {
      // Insert after the wizard steps
      const resultCard = document.querySelector('#resultState .result-card');
      if (!resultCard) return;

      scoreContainer = document.createElement('div');
      scoreContainer.id = 'listingScoreContainer';
      scoreContainer.style.cssText = 'margin-bottom: 1.5rem;';
      resultCard.insertBefore(scoreContainer, resultCard.firstChild);
    }

    const suggestionsHtml = score.suggestions.length > 0
      ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
           <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Tips to improve:</p>
           <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
             ${score.suggestions.slice(0, 3).map(s => `<li style="margin-bottom: 0.25rem;">${s}</li>`).join('')}
           </ul>
         </div>`
      : '';

    scoreContainer.innerHTML = `
      <div style="background: var(--bg-secondary); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: ${score.color}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; color: white;">
              ${score.total}
            </div>
            <div>
              <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem;">Listing Score: ${score.label}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">How your listing compares</div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${score.breakdown.map(b => `
              <div style="background: var(--bg-tertiary, var(--bg-primary)); padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.75rem;">
                <span style="color: var(--text-muted);">${b.label}:</span>
                <span style="color: ${b.status === 'good' ? 'var(--success, #10b981)' : b.status === 'ok' ? 'var(--warning, #f59e0b)' : 'var(--error, #ef4444)'}; font-weight: 600;">${b.points}/${b.max}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ${suggestionsHtml}
      </div>
    `;
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

    // Switch to create listing view
    this.navigateToApp('createListing');

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
    const fab = document.getElementById('newListingFab');
    if (fab) fab.classList.add('hidden');

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

  // Flat SVG icon helper — no emojis
  _icon(name, size = 16) {
    const s = size;
    const icons = {
      checkbox: `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;flex-shrink:0"><rect x="1" y="1" width="16" height="16" rx="3"/></svg>`,
      'checkbox-checked': `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" style="display:block;flex-shrink:0"><rect width="18" height="18" rx="4" fill="var(--accent-indigo)"/><path d="M4 9.5l3.2 3.2L14 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'checkbox-indeterminate': `<svg width="${s}" height="${s}" viewBox="0 0 18 18" fill="none" style="display:block;flex-shrink:0"><rect width="18" height="18" rx="4" fill="var(--accent-indigo)"/><path d="M4.5 9h9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
      trash: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
      package: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      edit: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      check: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>`,
    };
    return icons[name] ?? '';
  },

  // Update the select-all button and delete button state
  updateSelectBar(listingsToRender) {
    const iconEl = document.getElementById('selectAllIcon');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const countEl = document.getElementById('selectedCount');
    const labelEl = document.getElementById('selectAllLabel');
    if (!iconEl || !deleteBtn || !countEl) return;

    const n = this.state.selectedListingIds.size;
    const total = listingsToRender?.length ?? 0;
    const allSelected = total > 0 && n >= total;
    const someSelected = n > 0 && n < total;

    countEl.textContent = n;
    deleteBtn.classList.toggle('hidden', n === 0);

    if (allSelected) {
      iconEl.innerHTML = this._icon('checkbox-checked', 18);
    } else if (someSelected) {
      iconEl.innerHTML = this._icon('checkbox-indeterminate', 18);
    } else {
      iconEl.innerHTML = this._icon('checkbox', 18);
    }
    if (labelEl) labelEl.textContent = allSelected ? 'Deselect all' : 'Select all';
  },

  toggleSelectItem(id) {
    const nowSelected = !this.state.selectedListingIds.has(id);
    if (nowSelected) {
      this.state.selectedListingIds.add(id);
    } else {
      this.state.selectedListingIds.delete(id);
    }
    // Update card outline and checkbox icon without full re-render
    const card = document.querySelector(`.swipeable-card[data-listing-id="${id}"]`);
    if (card) {
      card.style.outline = nowSelected ? '2px solid var(--accent-indigo)' : '';
      card.style.borderRadius = nowSelected ? 'var(--radius-bento)' : '';
      const btn = card.querySelector('.saved-item-cb');
      if (btn) btn.innerHTML = nowSelected ? this._icon('checkbox-checked', 18) : this._icon('checkbox', 18);
    }
    const listingsToRender = this.state.filteredSavedListings.length > 0 ||
      document.getElementById('savedItemsSearch')?.value ||
      document.getElementById('savedItemsPlatformFilter')?.value
      ? this.state.filteredSavedListings
      : this.state.savedListings;
    this.updateSelectBar(listingsToRender);
  },

  toggleSelectAll() {
    const listingsToRender = this.state.filteredSavedListings.length > 0 ||
      document.getElementById('savedItemsSearch')?.value ||
      document.getElementById('savedItemsPlatformFilter')?.value
      ? this.state.filteredSavedListings
      : this.state.savedListings;

    const allSelected = listingsToRender.every((l) => this.state.selectedListingIds.has(l.id));
    const shouldSelect = !allSelected;

    listingsToRender.forEach((l) => {
      if (shouldSelect) {
        this.state.selectedListingIds.add(l.id);
      } else {
        this.state.selectedListingIds.delete(l.id);
      }
    });

    // Update all card outlines and checkbox icons without re-render
    document.querySelectorAll('.swipeable-card[data-listing-id]').forEach((card) => {
      card.style.outline = shouldSelect ? '2px solid var(--accent-indigo)' : '';
      card.style.borderRadius = shouldSelect ? 'var(--radius-bento)' : '';
      const btn = card.querySelector('.saved-item-cb');
      if (btn) btn.innerHTML = shouldSelect ? this._icon('checkbox-checked', 18) : this._icon('checkbox', 18);
    });

    this.updateSelectBar(listingsToRender);
  },

  async deleteSelectedListings() {
    const ids = [...this.state.selectedListingIds];
    if (ids.length === 0) return;

    if (!confirm(`Delete ${ids.length} listing${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;

    let failed = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`${this.apiUrl}/listings/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.state.token}` },
        });
        if (!res.ok && res.status !== 404) failed++;
      } catch (_) {
        failed++;
      }
    }));

    this.state.selectedListingIds.clear();
    await this.loadListingsFromDB();
    this.renderSavedItems();

    if (failed > 0) {
      this.showToast(`Deleted ${ids.length - failed} items. ${failed} failed.`, 'error');
    } else {
      this.showToast(`Deleted ${ids.length} listing${ids.length > 1 ? 's' : ''}`);
    }
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

    // Show select bar
    const selectBar = document.getElementById('savedItemsSelectBar');
    if (selectBar) selectBar.classList.remove('hidden');

    grid.innerHTML = listingsToRender
      .map((listing) => {
        const isSelected = this.state.selectedListingIds.has(listing.id);
        const primaryImage = listing.images?.[0]?.url || listing.images?.[0]?.data || '';
        const imgEl = primaryImage
          ? `<img src="${primaryImage}" alt="${listing.title || 'Listing'}" class="swipeable-card-image" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : '';
        const imgPlaceholder = `<div class="swipeable-card-image" style="${primaryImage ? 'display:none;' : 'display:flex;'}align-items:center;justify-content:center;background:var(--bg-tertiary);border-radius:8px;color:var(--text-muted);">${this._icon('package', 32)}</div>`;
        const createdDate = listing.created_at
          ? new Date(listing.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
          : 'Draft';
        const statusLabel = listing.status === 'sold' ? ' • Sold' : '';
        return `
                        <div class="swipeable-card" data-listing-id="${listing.id}" style="${isSelected ? 'outline:2px solid var(--accent-indigo);border-radius:var(--radius-bento);' : ''}">
                            <div class="swipeable-card-actions swipeable-card-action-left" style="flex-direction:column;gap:4px;">${this._icon('edit', 16)}<span style="font-size:11px;">Edit</span></div>
                            <div class="swipeable-card-actions swipeable-card-action-right" style="flex-direction:column;gap:4px;">${this._icon('check', 16)}<span style="font-size:11px;">Sold</span></div>
                            <div class="swipeable-card-content">
                                <button type="button" class="saved-item-cb" onclick="app.toggleSelectItem(${listing.id})" aria-label="Select listing" style="background:none;border:none;cursor:pointer;padding:0 4px 0 0;display:flex;align-items:center;flex-shrink:0;color:var(--text-muted);">${isSelected ? this._icon('checkbox-checked', 18) : this._icon('checkbox', 18)}</button>
                                ${imgEl}${imgPlaceholder}
                                <div class="swipeable-card-info">
                                    <div class="swipeable-card-title">${listing.title || 'Untitled'}</div>
                                    <div class="swipeable-card-meta">${(listing.platform || 'Draft').toUpperCase()} · ${createdDate}${statusLabel}</div>
                                    <div style="font-weight: 600; margin-top: 4px;">${listing.price || '—'}</div>
                                </div>
                                <div style="display:flex;gap:8px;flex-shrink:0;">
                                    <button class="btn btn-secondary btn-small" type="button" onclick="app.loadListing(${listing.id})">Open</button>
                                    <button class="btn btn-secondary btn-small" type="button" onclick="app.deleteListing(${listing.id})" aria-label="Delete listing" style="padding:6px 10px;color:var(--error,#e53e3e);display:flex;align-items:center;">${this._icon('trash', 15)}</button>
                                </div>
                            </div>
                        </div>
                    `;
      })
      .join('');

    this.updateSelectBar(listingsToRender);
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
    // Bottom nav removed
  },

  switchAppView(view) {
    const views = ['dashboard', 'createListing', 'savedItems', 'settings', 'profile'];
    views.forEach((v) => {
      const el = document.getElementById(`${v}View`);
      if (el) {
        el.classList.toggle('hidden', v !== view);
      }
    });

    this.state.currentAppView = view;

    if (view === 'dashboard') {
      this.loadDashboardMetrics();
    } else if (view === 'createListing') {
      this.initWizard();
    } else if (view === 'savedItems') {
      this.renderSavedItems();
    } else if (view === 'settings') {
      this.loadSubscriptionData();
      this.loadDashboardMetrics();
      this.loadReferralData();
    } else if (view === 'profile') {
      this.loadProfileData();
    }

    // Clear multi-select state when leaving saved items
    if (this.state.currentAppView === 'savedItems' && view !== 'savedItems') {
      this.state.selectedListingIds.clear();
      const selectBar = document.getElementById('savedItemsSelectBar');
      if (selectBar) selectBar.classList.add('hidden');
    }

    this.highlightBottomTab(view);
    window.scrollTo(0, 0);
    const appEl = document.getElementById('appView');
    if (appEl) appEl.scrollTop = 0;
  },

  // Authentication
  // Show auth - now uses Clerk's built-in modal
  showAuthModal(mode = 'signIn') {
    if (this.state.isAuthenticated || (window.Clerk && window.Clerk.user)) {
      // User is already signed in - take them to the app
      this.updateUI(); // Show the app view
      this.navigateToApp('dashboard');
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
    this.navigateToApp('dashboard');
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

      // Mount Clerk UserButton if available
      const userBtnMount = document.getElementById('user-button-mount');
      if (userBtnMount && window.Clerk) {
        window.Clerk.mountUserButton(userBtnMount, {
          appearance: this.getClerkAppearance(),
          afterSignOutUrl: '/',
        });
      }

      // Load user data
      await this.loadListingsFromDB();

      // Submit referral code if one was captured before signup
      this.submitReferralCode();

      // Show welcome toast only once per session
      if (!this.state.hasShownWelcomeToast) {
        this.showToast('Welcome back!', 'success');
        this.state.hasShownWelcomeToast = true;
      }
    });

    // Keep token fresh when Clerk silently refreshes the session
    window.addEventListener('clerkTokenRefreshed', async (event) => {
      try {
        const token = await event.detail.session.getToken();
        if (token) {
          this.state.token = token;
          localStorage.setItem('quicklist-token', token);
        }
      } catch (e) { }
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
    // Eagerly load Clerk so we can detect existing sessions
    // (returning from redirect sign-in, page refresh while signed in, etc.)
    if (!window.Clerk) {
      try {
        if (window.quicklistAuth?.ensureLoaded) {
          await window.quicklistAuth.ensureLoaded();
        } else {
          return;
        }
      } catch (error) {
        console.error('Clerk bootstrap error during auth check:', error);
        return;
      }
    }

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

          // Mount Clerk UserButton
          const userBtnMount = document.getElementById('user-button-mount');
          if (userBtnMount && window.Clerk) {
            window.Clerk.mountUserButton(userBtnMount, {
              appearance: this.getClerkAppearance(),
              afterSignOutUrl: '/',
            });
          }

          await this.loadListingsFromDB();
        }
      }
    } catch (error) {
      console.error('Clerk auth check error:', error);
    }
  },

  // Clerk appearance configuration - Quicklist branded (light theme)
  getClerkAppearance() {
    return {
      variables: {
        colorPrimary: '#FF7A5C',
        colorBackground: '#ffffff',
        colorInputBackground: '#f7f2ea',
        colorInputText: '#1a1a2e',
        colorText: '#1a1a2e',
        colorTextSecondary: '#64748b',
        colorDanger: '#FF6B6B',
        colorSuccess: '#6BCB8E',
        colorWarning: '#FFD93D',
        fontFamily: "'Maison', system-ui, sans-serif",
        borderRadius: '12px',
        spacingUnit: '4px',
      },
      elements: {
        rootBox: {
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        },
        card: {
          backgroundColor: '#ffffff',
          border: '1.5px solid #e5e0d8',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        },
        headerTitle: {
          color: '#1a1a2e',
          fontSize: '1.5rem',
          fontWeight: '800',
          fontFamily: "'Maison', system-ui, sans-serif",
        },
        headerSubtitle: {
          color: '#64748b',
        },
        socialButtonsBlockButton: {
          backgroundColor: '#f7f2ea',
          border: '1.5px solid #e5e0d8',
          borderRadius: '10px',
          color: '#1a1a2e',
        },
        socialButtonsBlockButtonText: {
          color: '#1a1a2e',
          fontWeight: '600',
        },
        dividerLine: {
          backgroundColor: '#e5e0d8',
        },
        dividerText: {
          color: '#64748b',
        },
        formFieldLabel: {
          color: '#1a1a2e',
          fontWeight: '500',
        },
        formFieldInput: {
          backgroundColor: '#f7f2ea',
          border: '1.5px solid #e5e0d8',
          borderRadius: '10px',
          color: '#1a1a2e',
        },
        formButtonPrimary: {
          backgroundColor: '#FF7A5C',
          borderRadius: '10px',
          fontWeight: '700',
          textTransform: 'none',
        },
        footerActionLink: {
          color: '#FF7A5C',
          fontWeight: '600',
        },
        identityPreviewText: {
          color: '#1a1a2e',
        },
        identityPreviewEditButton: {
          color: '#FF7A5C',
        },
        formFieldSuccessText: {
          color: '#6BCB8E',
        },
        formFieldErrorText: {
          color: '#ef4444',
        },
        alertText: {
          color: '#1a1a2e',
        },
        modalBackdrop: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        },
        footer: {
          display: 'none',
        },
      },
      layout: {
        socialButtonsPlacement: 'top',
        socialButtonsVariant: 'blockButton',
        showOptionalFields: false,
        shimmer: true,
      },
    };
  },

  // Sign in with Clerk - uses Clerk's prebuilt UI with Quicklist branding
  async signInWithClerk(mode = 'signIn') {
    let clerk = window.Clerk;

    if (!clerk) {
      try {
        clerk = await this.ensureClerkReady();
      } catch (error) {
        console.error('Clerk bootstrap error:', error);
        this.showToast('Authentication is temporarily unavailable', 'error');
        return;
      }
    }

    if (this.state.isAuthenticated || clerk.user) {
      this.updateUI();
      this.navigateToApp('dashboard');
      return;
    }

    const appearance = this.getClerkAppearance();

    const authOptions = {
      appearance: appearance,
      afterSignUpUrl: window.location.origin,
      afterSignInUrl: window.location.origin,
    };

    try {
      if (mode === 'signUp') {
        await clerk.openSignUp(authOptions);
      } else {
        await clerk.openSignIn(authOptions);
      }
    } catch (error) {
      console.error('Clerk sign in error:', error);

      // Fallback to hosted portal if UI components are missing in the browser bundle
      if (error && error.message && error.message.includes('Ui components')) {
        console.log('Falling back to hosted authentication portal...');
        if (mode === 'signUp') {
          clerk.redirectToSignUp(authOptions);
        } else {
          clerk.redirectToSignIn(authOptions);
        }
        return; // Don't show toast if we are redirecting
      }

      if (!error.code || error.code !== 'cannot_render_single_session_enabled') {
        this.showToast('Authentication error: ' + (error.message || 'Please try again'), 'error');
      }
    }
  },

  // Slide-Out Navigation
  toggleSlideNav() {
    const nav = document.getElementById('slideNav');
    if (nav && nav._isOpen) {
      this.closeSlideNav();
    } else {
      this.openSlideNav();
    }
  },

  // Alias for backward compatibility
  toggleMobileMenu() {
    this.toggleSlideNav();
  },

  openSlideNav() {
    const nav = document.getElementById('slideNav');
    const overlay = document.getElementById('navOverlay');
    if (!nav || nav._isOpen) return;

    nav._isOpen = true;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Kill any running animations
    if (nav._tl) nav._tl.kill();

    const links = nav.querySelectorAll('.slide-nav-link');

    if (typeof gsap !== 'undefined') {
      const tl = gsap.timeline();
      nav._tl = tl;

      tl.set(nav, { visibility: 'visible' });

      tl.to(nav, {
        x: 0,
        duration: 0.45,
        ease: 'power3.out',
      });

      tl.to(links, {
        opacity: 1,
        x: 0,
        duration: 0.35,
        stagger: 0.06,
        ease: 'power2.out',
      }, '-=0.2');
    } else {
      nav.style.visibility = 'visible';
      nav.style.transform = 'translateX(0)';
      links.forEach(link => {
        link.style.opacity = '1';
        link.style.transform = 'translateX(0)';
      });
    }

    // Close on overlay click
    overlay.onclick = () => this.closeSlideNav();

    // Close on Escape
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.closeSlideNav();
    };
    document.addEventListener('keydown', this._escHandler);
  },

  // Alias for backward compatibility
  openMobileMenu() {
    this.openSlideNav();
  },

  closeSlideNav() {
    const nav = document.getElementById('slideNav');
    const overlay = document.getElementById('navOverlay');
    if (!nav) return;

    nav._isOpen = false;
    document.body.style.overflow = '';

    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    const links = nav.querySelectorAll('.slide-nav-link');

    if (typeof gsap !== 'undefined') {
      if (nav._tl) nav._tl.kill();

      const tl = gsap.timeline({
        onComplete: () => {
          overlay.classList.remove('active');
          nav.style.visibility = 'hidden';
        }
      });
      nav._tl = tl;

      tl.to(links, {
        opacity: 0,
        x: 30,
        duration: 0.2,
        stagger: 0.03,
        ease: 'power2.in',
      });

      tl.to(nav, {
        x: '100%',
        duration: 0.35,
        ease: 'power3.in',
      }, '-=0.1');
    } else {
      nav.style.transform = 'translateX(100%)';
      nav.style.visibility = 'hidden';
      links.forEach(link => {
        link.style.opacity = '0';
        link.style.transform = 'translateX(30px)';
      });
      overlay.classList.remove('active');
    }
  },

  // Alias for backward compatibility
  closeMobileMenu() {
    this.closeSlideNav();
  },

  // Toggle slide-out nav links based on auth state
  updateMobileMenu() {
    const marketingLinks = document.getElementById('navLinksMarketing');
    const appLinks = document.getElementById('navLinksApp');
    if (!marketingLinks || !appLinks) return;

    // Default to marketing links unless positively authenticated
    const isAuthenticated = this.isAuthenticated === true;
    if (isAuthenticated) {
      marketingLinks.style.display = 'none';
      appLinks.style.display = 'flex';
    } else {
      marketingLinks.style.display = 'flex';
      appLinks.style.display = 'none';
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

      // Ensure slide nav is closed to clear any scroll locks
      this.closeSlideNav();

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
      const response = await fetch(`${this.apiUrl} /subscription/status`, {
        headers: {
          Authorization: `Bearer ${this.state.token} `,
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
      if (usageBarEl) usageBarEl.style.width = `${data.usage.percentage}% `;
      if (usageLimitEl) usageLimitEl.textContent = `of ${data.usage.limit} listings used`;

      // Fetch credit balance and update upsell footer for free users
      let creditBalance = 0;
      try {
        const creditsResp = await fetch(`${this.apiUrl}/credits`, {
          headers: { Authorization: `Bearer ${this.state.token}` },
        });
        if (creditsResp.ok) {
          const creditsData = await creditsResp.json();
          creditBalance = creditsData.balance || 0;
        }
      } catch (_) { }
      this.updateUpsellFooter(data.subscription, data.usage, creditBalance);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      this.showToast('Failed to load subscription data', 'error');
    }
  },

  // Upsell Footer Management
  updateUpsellFooter(subscription, usage, creditBalance = 0) {
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
    const creditsEl = document.getElementById('upsellCredits');
    const creditCountEl = document.getElementById('upsellCreditCount');

    if (usedEl) usedEl.textContent = usage.listingsCreated || 0;
    if (limitEl) limitEl.textContent = usage.limit || 5;
    if (creditsEl && creditCountEl) {
      if (creditBalance > 0) {
        creditCountEl.textContent = creditBalance;
        creditsEl.style.display = 'inline';
      } else {
        creditsEl.style.display = 'none';
      }
    }

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
                        ${plan.current
            ? '<button class="btn btn-secondary" disabled>Current Plan</button>'
            : `<button class="btn ${plan.featured ? 'btn-primary' : 'btn-secondary'}" onclick="app.handlePlanSelection('${plan.id}', '${plan.priceId}')">Upgrade to ${plan.name}</button>`
          }
                    </div>
                `
      )
      .join('');

    modal.classList.remove('hidden');
    modal.classList.add('active');
  },

  closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active');
    }
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
      const appAlreadyVisible = appView.style.display === 'block';

      // User is signed in - show app, hide marketing
      marketingView.style.display = 'none';
      marketingHeader.classList.add('hidden');
      if (marketingFooter) marketingFooter.style.display = 'none';

      // Hide referral invite banner once logged in
      const refBanner = document.getElementById('refBanner');
      if (refBanner) refBanner.style.display = 'none';

      appView.classList.remove('hidden');
      appView.style.display = 'block';
      appHeader.classList.remove('hidden');

      // Navigate to dashboard on initial transition (first load or sign-in)
      // Don't disrupt the user if they're already in the app
      if (!appAlreadyVisible) {
        this.navigateToApp('dashboard');
      }

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
    // Bottom nav removed
  },

  updateBottomNavBadges() {
    // Bottom nav removed
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

    try {
      await this.ensureQuagga();
    } catch (error) {
      console.error('Barcode scanner bootstrap error:', error);
      this.showToast('Barcode scanner is temporarily unavailable.', 'error');
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
    if (typeof window.Quagga !== 'undefined' && window.Quagga.stop) {
      window.Quagga.stop();
    }

    // Clear result display
    const resultDiv = document.getElementById('barcodeResult');
    if (resultDiv) {
      resultDiv.textContent = '';
    }
  },

  initBarcodeScanner() {
    const QuaggaLib = window.Quagga;

    // Check if Quagga is loaded
    if (!QuaggaLib) {
      console.error('QuaggaJS library not loaded');
      this.showToast('Barcode scanner not available', 'error');
      return;
    }

    // Initialize QuaggaJS
    QuaggaLib.init(
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
        QuaggaLib.start();
      }
    );

    // Handle detected barcodes
    QuaggaLib.onDetected((data) => {
      if (data && data.codeResult && data.codeResult.code) {
        const barcode = data.codeResult.code;
        console.log('Barcode detected:', barcode);

        // Stop scanning
        QuaggaLib.stop();

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
    QuaggaLib.onProcessed((result) => {
      const drawingCtx = QuaggaLib.canvas.ctx.overlay;
      const drawingCanvas = QuaggaLib.canvas.dom.overlay;

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
              QuaggaLib.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                color: 'green',
                lineWidth: 2,
              });
            });
        }

        if (result.box) {
          QuaggaLib.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
            color: '#00F',
            lineWidth: 2,
          });
        }

        if (result.codeResult && result.codeResult.code) {
          QuaggaLib.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, {
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

      const response = await fetch(`${this.apiUrl}/lookup-barcode`, {
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
      badge.textContent = `Scanned from barcode: ${productData.barcode}`;
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

  // ─── Referral & Credits ──────────────────────────────────────────────────

  async submitReferralCode() {
    try {
      const raw = localStorage.getItem('ql_ref');
      if (!raw) return;
      const { code, ts } = JSON.parse(raw);
      // Expire after 30 days
      if (Date.now() - ts > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('ql_ref');
        return;
      }
      const response = await fetch(`${this.apiUrl}/referral/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.token}`,
        },
        body: JSON.stringify({ code }),
      });
      localStorage.removeItem('ql_ref');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.showToast(`Referral applied — you got ${data.creditsEarned} bonus listings!`, 'success');
        }
      }
    } catch (e) {
      // Silent fail — never block the user
    }
  },

  async loadReferralData() {
    try {
      const response = await fetch(`${this.apiUrl}/referral/code`, {
        headers: { Authorization: `Bearer ${this.state.token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data) return;

      const urlEl = document.getElementById('referShareUrl');
      const balanceEl = document.getElementById('referCreditBalance');
      const countEl = document.getElementById('referCount');
      const progressEl = document.getElementById('referProgressBar');
      const milestoneLabel = document.getElementById('referMilestoneLabel');
      const milestoneNote = document.getElementById('referMilestoneNote');

      if (urlEl) urlEl.value = data.shareUrl || '';
      if (balanceEl) balanceEl.textContent = data.creditBalance ?? 0;
      if (countEl) countEl.textContent = data.successfulReferrals ?? 0;

      // Cache shareUrl in state so nudge can use it without a second API call
      if (data.shareUrl) this.state.referralShareUrl = data.shareUrl;

      const count = data.successfulReferrals || 0;
      const target = data.milestoneTarget || 3;
      const pct = Math.min(100, Math.round((count / target) * 100));
      if (progressEl) progressEl.style.width = pct + '%';
      if (milestoneLabel) milestoneLabel.textContent = `${count} / ${target} referrals`;
      if (milestoneNote) milestoneNote.style.display = data.milestoneRewardIssued ? 'block' : 'none';
    } catch (e) {
      console.warn('Could not load referral data:', e.message);
    }
  },

  showReferralNudge() {
    if (localStorage.getItem('ql_nudge_dismissed')) return;
    const shareUrl = this.state.referralShareUrl;
    if (!shareUrl) return;

    const existing = document.getElementById('referralNudge');
    if (existing) return; // already showing

    const nudge = document.createElement('div');
    nudge.id = 'referralNudge';
    nudge.style.cssText = [
      'position:fixed',
      'bottom:5rem',
      'right:1rem',
      'z-index:8500',
      'background:var(--bg-secondary)',
      'border:1px solid var(--border)',
      'border-radius:0.75rem',
      'padding:1rem 1.25rem',
      'max-width:320px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.3)',
      'animation:slideUp 0.3s ease',
    ].join(';');
    nudge.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem">
        <p style="margin:0;font-size:0.875rem;color:var(--text-primary);line-height:1.5">
          Enjoying QuickList? <strong>Share your link</strong> — your friends get 5 free listings and you earn credits.
        </p>
        <button onclick="document.getElementById('referralNudge').remove();localStorage.setItem('ql_nudge_dismissed','1')" aria-label="Dismiss" style="background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer;flex-shrink:0;line-height:1;margin-top:-2px">&times;</button>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
        <button id="referNudgeShareBtn" class="btn btn-primary" style="flex:1;font-size:0.8125rem;padding:0.375rem 0.75rem">Copy link</button>
        <button onclick="document.getElementById('referralNudge').remove();localStorage.setItem('ql_nudge_dismissed','1')" class="btn btn-secondary" style="font-size:0.8125rem;padding:0.375rem 0.75rem">Later</button>
      </div>`;
    document.body.appendChild(nudge);

    document.getElementById('referNudgeShareBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        document.getElementById('referNudgeShareBtn').textContent = 'Copied!';
        setTimeout(() => {
          const n = document.getElementById('referralNudge');
          if (n) n.remove();
          localStorage.setItem('ql_nudge_dismissed', '1');
        }, 1500);
      } catch (_) {
        this.showToast(`Your link: ${shareUrl}`, 'info');
      }
    });
  },

  async copyReferralLink() {
    const urlEl = document.getElementById('referShareUrl');
    const url = urlEl ? urlEl.value : '';
    if (!url || url === 'Loading…') {
      this.showToast('Your referral link is loading…', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Referral link copied!', 'success');
    } catch {
      urlEl.select();
      document.execCommand('copy');
      this.showToast('Link copied!', 'success');
    }
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
      path: '/json_anim/new/woman-shopping-online-with-smartphone-2025-10-20-04-32-45-utc.json',
      label: 'Scanning and photographing items',
    },
    {
      id: 'step2-animation',
      path: '/json_anim/new/virtual-marketplace-illustration-2025-10-20-03-04-06-utc.json',
      label: 'AI processing in real-time',
    },
    {
      id: 'step3-animation',
      path: '/json_anim/new/hand-holding-retail-shopping-bags-illustration-2025-10-20-05-59-48-utc.json',
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
  if (typeof window.lottie === 'undefined') {
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

            window.lottie.loadAnimation({
              container: entry.target,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: animConfig.path,
            });

            // Mark as loaded
            entry.target.dataset.loaded = 'true';
            entry.target.classList.add('animation-loaded');
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
    }
    // Silently skip missing containers - they may not be on current page
  });

  // Pause animations when tab is not visible (save CPU/battery)
  document.addEventListener('visibilitychange', () => {
    if (typeof window.lottie === 'undefined') return;

    const allAnimations = window.lottie.getRegisteredAnimations
      ? window.lottie.getRegisteredAnimations()
      : [];

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
  app.scheduleMarketingAnimations();
  app.init();
});
