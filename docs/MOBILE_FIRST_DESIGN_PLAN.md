# Mobile-First Design Plan - QuickList AI

**Generated:** 2025-11-11
**Last Updated:** 2025-11-11
**Version:** 2.0 (Comprehensive Revision)
**Research Finding:** 77% of retail traffic is mobile, 66% of online shopping orders are mobile

---

## Executive Summary

QuickList AI must prioritize mobile experience to align with reseller workflows and market trends. This revision updates the mobile strategy based on current codebase analysis (vanilla JavaScript, single-file architecture, PWA-ready).

### Current Technical Context

- **Architecture:** Single HTML file (~9K lines) with embedded CSS/JS
- **Framework:** Vanilla JavaScript (no React/Vue)
- **PWA Status:** Fully configured (manifest, service worker, offline support)
- **Camera Integration:** Partially implemented (getUserMedia API)
- **Backend:** Express.js with PostgreSQL, Google Gemini Vision API

### Reseller Mobile Workflows

Resellers primarily:

- **Source items on-the-go** (thrift stores, estate sales, garage sales)
- **Photograph at sourcing locations** to list immediately
- **Manage listings from phone** while away from desk
- **Respond to buyers quickly** via mobile notifications
- **Batch process items** at home with mobile device

### Design Philosophy Change

**Previous Plan:** Bottom navigation with emoji icons
**Updated Approach:** Hamburger menu overlay (top-left) with proper SVG icons for cleaner, more professional mobile UI

This plan outlines a complete mobile-first redesign strategy while maintaining desktop functionality for bulk operations.

---

## Mobile User Workflows

### Primary Mobile Use Cases

#### 1. **Sourcing Location Workflow** (Most Critical)

```
User at thrift store:
1. Find item worth reselling
2. Take photos on phone (in-store)
3. Open QuickList AI app
4. Upload photos → AI generates listing
5. Review/edit listing
6. Post to marketplaces
7. Continue shopping

Goal: Complete flow in <3 minutes per item
```

#### 2. **At-Home Listing Workflow**

```
User at home with items:
1. Set up photo area
2. Take multiple photos per item (batch)
3. Upload batch to QuickList AI
4. AI generates all listings
5. Quick review/approve
6. Batch post to marketplaces

Goal: Process 10 items in <20 minutes
```

#### 3. **Inventory Management Workflow**

```
User checking phone throughout day:
1. Receive sale notification
2. Mark as sold (auto-delists everywhere)
3. Check dashboard (revenue, active listings)
4. Respond to buyer questions
5. Update prices if needed

Goal: All tasks <30 seconds each
```

### Secondary Mobile Use Cases

- Quick price checks while sourcing
- Barcode scanning for instant info
- Customer service responses
- Shipping label generation
- Performance analytics checking

---

## Mobile-First Design Principles

### 1. **Thumb-Friendly Navigation**

- Bottom navigation bar (within thumb reach)
- Large tap targets (minimum 44x44px)
- Swipe gestures for common actions
- Minimal scrolling required

### 2. **Progressive Disclosure**

- Show only essential info by default
- Expandable sections for details
- Step-by-step workflows (not all-at-once)
- Clear visual hierarchy

### 3. **Touch-Optimized Controls**

- Sliders instead of text input where possible
- Toggle switches instead of checkboxes
- Action sheets for multi-option choices
- Haptic feedback for confirmations

### 4. **Performance First**

- Images lazy-loaded
- Aggressive caching
- Optimistic UI updates
- Offline mode for draft listings

### 5. **Camera-First Experience**

- Native camera integration
- In-app photo editing
- Real-time image quality feedback
- Batch photo capture

---

## Mobile UI Redesign

### New Mobile Navigation Structure

```
┌─────────────────────────┐
│ ☰  QuickList AI    [+]  │ ← Fixed header with hamburger (left) & FAB (right)
├─────────────────────────┤
│                         │
│    Main Content Area    │
│    (Scrollable)         │
│                         │
│                         │
│                         │
└─────────────────────────┘

When hamburger tapped:
┌─────────────────────────┐
│ [×] Menu          QuickList │ ← Overlay header
├─────────────────────────┤
│ [ICON] New Listing      │
│ [ICON] My Listings      │
│ [ICON] Dashboard        │
│ [ICON] Messages         │
│ ─────────────────       │
│ [ICON] Settings         │
│ [ICON] Help & Support   │
│ [ICON] Sign Out         │
│                         │
│   (Tap outside to close) │
└─────────────────────────┘
```

### Hamburger Menu Overlay Navigation

**Why This Approach?**

- **More screen real estate:** No persistent bottom bar consuming 60-80px
- **Professional appearance:** Industry standard for mobile apps
- **Scalable:** Easy to add new menu items without crowding
- **Gesture-friendly:** Swipe from left edge to open (iOS/Android standard)
- **Focus on content:** Full viewport for listing photos and details

**Navigation Structure:**

**Primary Actions (Top Section):**

1. **New Listing** (Camera icon)
   - Opens camera-first workflow
   - Primary user action
   - Can also be triggered by FAB button in header

2. **My Listings** (Grid icon)
   - Active listings with count badge
   - Swipe cards for quick edit/sold actions
   - Filter by platform dropdown
   - Search bar for finding specific items

3. **Dashboard** (Chart icon)
   - Revenue metrics (today/week/month)
   - Active listings count
   - Quick stats cards
   - Performance insights

4. **Messages** (Inbox icon)
   - Unified inbox from all marketplaces
   - Unread count badge
   - Quick reply templates
   - Buyer conversation threads

**Secondary Actions (Bottom Section):** 5. **Settings** (Gear icon)

- Account preferences
- Marketplace connections
- Notification settings
- Data & privacy

6. **Help & Support** (Question mark icon)
   - FAQ / Knowledge base
   - Contact support
   - Feature requests
   - Tutorial videos

7. **Sign Out** (Exit icon)
   - Clear session
   - Return to login

**Floating Action Button (FAB):**

- Fixed position: bottom-right corner (60px from bottom, 20px from right)
- Primary action: Camera icon "+"
- Always visible on main screens
- Tapping opens camera immediately (bypass menu)
- Provides redundant quick access to core workflow

### SVG Icon System

**Icon Library:** Use inline SVG icons (not icon fonts) for better performance and control

**Recommended Icon Set:** Heroicons v2 or Lucide Icons (MIT licensed, optimized for web)

**Icon Specifications:**

- Size: 24x24px (default), 20x20px (small), 32x32px (FAB)
- Stroke width: 2px (Heroicons standard)
- Color: CSS variables for theme consistency
- States: Default, hover, active, disabled

**Menu Icons Map:**

```javascript
const menuIcons = {
  hamburger: 'bars-3', // ☰ Three horizontal lines
  close: 'x-mark', // × Close icon
  newListing: 'camera', // Camera for photo capture
  myListings: 'squares-2x2', // Grid of squares
  dashboard: 'chart-bar-square', // Bar chart icon
  messages: 'inbox', // Inbox tray
  settings: 'cog-6-tooth', // Gear icon
  help: 'question-mark-circle', // Question mark in circle
  signOut: 'arrow-right-on-rectangle', // Exit door icon
  fab: 'plus', // + symbol for FAB
};
```

**SVG Implementation Example:**

```html
<!-- Hamburger Menu Icon -->
<svg
  class="icon icon-menu"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
  stroke-width="2"
  stroke="currentColor"
>
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
  />
</svg>

<!-- Camera Icon -->
<svg
  class="icon icon-camera"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
  stroke-width="2"
  stroke="currentColor"
>
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
  />
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
  />
</svg>
```

**CSS Styling:**

```css
.icon {
  width: 24px;
  height: 24px;
  color: var(--text-primary);
  transition: color 0.2s ease;
}

.icon-small {
  width: 20px;
  height: 20px;
}

.icon-large {
  width: 32px;
  height: 32px;
}

/* Interactive states */
button:hover .icon,
a:hover .icon {
  color: var(--accent-indigo);
}

button:active .icon {
  transform: scale(0.95);
}

button:disabled .icon {
  color: var(--text-muted);
  opacity: 0.5;
}
```

---

## Camera-First Photo Capture

### Guided Photo Capture Interface

```
┌─────────────────────────┐
│  [Back]    Guide  [Flip]│ ← Top controls
├─────────────────────────┤
│                         │
│     ┌─────────────┐     │
│     │             │     │ ← Overlay guide
│     │   Product   │     │    (dotted box)
│     │    Here     │     │
│     └─────────────┘     │
│                         │
│   Tips: Center item,    │
│   use good lighting     │
├─────────────────────────┤
│  Quality: ⚫⚫⚫⚪⚪    │ ← Real-time quality indicator
├─────────────────────────┤
│                         │
│    [Gallery] ⚪ [✓]    │ ← Capture button (center)
│                         │
│  Photo 1 of 10          │
└─────────────────────────┘
```

### Features

**Real-Time Quality Feedback**

- **Blur detection:** Analyze edge sharpness using Laplacian variance algorithm
- **Lighting analysis:** Check histogram for underexposure/overexposure
- **Framing guide:** Overlay grid showing optimal product placement (rule of thirds)
- **Live quality score:** 5-dot indicator fills as quality improves (updates every 500ms)

**Implementation:**

```javascript
// Real-time blur detection using Laplacian variance
function detectBlur(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = toGrayscale(imageData);
  const laplacian = applyLaplacianKernel(gray);
  const variance = calculateVariance(laplacian);

  // Threshold: < 100 = blurry, > 300 = sharp
  return {
    isBlurry: variance < 100,
    score: Math.min(variance / 300, 1) * 100,
  };
}

// Lighting analysis
function analyzeLighting(imageData) {
  const histogram = calculateHistogram(imageData);
  const avgBrightness = calculateAverage(histogram);

  return {
    tooDark: avgBrightness < 60,
    tooBright: avgBrightness > 200,
    score: avgBrightness >= 80 && avgBrightness <= 180 ? 100 : 50,
  };
}

// Update quality indicator in real-time
function updateQualityIndicator() {
  const canvas = document.getElementById('camera-canvas');
  const blur = detectBlur(canvas);
  const lighting = analyzeLighting(canvas);

  const overallScore = (blur.score + lighting.score) / 2;
  const dotsToFill = Math.floor(overallScore / 20); // 5 dots, 20% each

  // Update UI
  document.querySelectorAll('.quality-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < dotsToFill);
  });

  // Show warnings
  if (blur.isBlurry) showWarning('Hold steady - image is blurry');
  if (lighting.tooDark) showWarning('Too dark - add more light');
  if (lighting.tooBright) showWarning('Too bright - reduce lighting');
}
```

**Batch Capture Mode**

- Take multiple photos in sequence (up to 10 per listing)
- Thumbnail strip at bottom with delete/retake options
- Tap thumbnail to review full-size, swipe to navigate
- "Done" button proceeds to next step (enabled after minimum 1 photo)
- Auto-save to IndexedDB for offline support

**Smart Guides**

- **Item-specific guides:** Overlay templates for common categories
  - Clothing: Laid flat with arms spread, front + back + tag
  - Shoes: Side profile, bottom sole, interior
  - Electronics: Front, ports, serial number
  - Books: Cover, spine, copyright page, condition issues
- **Suggested photo angles:** Dynamic checklist based on category
- **Defect reminder:** "Did you photograph all defects?" confirmation before proceeding

**Camera Settings Optimization:**

```javascript
// Request highest quality camera stream
const constraints = {
  video: {
    facingMode: { ideal: 'environment' }, // Rear camera preferred
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    aspectRatio: { ideal: 4 / 3 },
    focusMode: { ideal: 'continuous' }, // Auto-focus
  },
};

navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
  videoElement.srcObject = stream;

  // Apply additional enhancements
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();

  // Enable HDR if supported
  if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
    track.applyConstraints({ exposureMode: 'continuous' });
  }

  // Enable torch/flash if available
  if (capabilities.torch) {
    // Show flash toggle button
    document.getElementById('flash-toggle').style.display = 'block';
  }
});
```

---

## Listing Creation Mobile Flow

### Step-by-Step Wizard

#### **Step 1: Photos**

```
┌─────────────────────────┐
│  Create New Listing     │
│  Step 1 of 4            │
├─────────────────────────┤
│                         │
│  [Take Photos]          │ ← Big button
│  [Upload from Gallery]  │
│                         │
│  ─── OR ───             │
│                         │
│  [Scan Barcode]         │ ← For branded items
│                         │
├─────────────────────────┤
│  Recent drafts:         │
│  📸 Nike Trainers       │ ← Resume draft
│  📸 Vintage Jeans       │
└─────────────────────────┘
```

#### **Step 2: AI Processing**

```
┌─────────────────────────┐
│  Analyzing Photos...    │
├─────────────────────────┤
│                         │
│   🤖  AI Working...     │
│                         │
│  ████████░░░░ 65%       │ ← Progress bar
│                         │
│  • Identifying product  │ ← Real-time updates
│  • Detecting condition  │
│  • Researching prices   │
│  ✓ Generating listing   │
│                         │
│  Estimated: 15 seconds  │
└─────────────────────────┘
```

#### **Step 3: Review & Edit**

```
┌─────────────────────────┐
│  Review Listing         │
│  Step 3 of 4            │
├─────────────────────────┤
│  [▼ Images (4)]         │ ← Collapsible sections
│    [Thumbnail strip]    │
│                         │
│  [▼ Title & Details]    │
│    Nike Air Max 90...   │ ← Tap to expand/edit
│    Brand: Nike          │
│    Condition: Good      │
│                         │
│  [▼ Price & Value]      │
│    £75 (AI suggest)     │ ← Tap to see pricing intel
│    RRP: £120            │
│                         │
│  [▼ Description]        │
│    Classic Nike Air...  │
│                         │
│  [▼ Damage Report (2)]  │ ← Attention if defects
│    ⚠️ Minor stain      │
│    ⚠️ Sole wear        │
│                         │
│  SEO Score: 78/100 🅱️  │
│  [Improve SEO]          │
├─────────────────────────┤
│  [Save Draft] [Next →] │
└─────────────────────────┘
```

#### **Step 4: Publish**

```
┌─────────────────────────┐
│  Where to List?         │
│  Step 4 of 4            │
├─────────────────────────┤
│                         │
│  ☑️ eBay                │ ← Toggle switches
│  ☑️ Vinted              │
│  ☑️ Gumtree             │
│  ☐ Facebook Marketplace │
│  ☐ Depop                │
│                         │
│  Platform-specific:     │
│  [▼ eBay Settings]      │ ← Expand for options
│      Duration: 7 days   │
│      Shipping: Calc     │
│                         │
│  [▼ Pricing Strategy]   │
│  • Same price all (£75) │ ← Or different per platform
│  • eBay: £78            │
│  • Vinted: £72          │
│                         │
├─────────────────────────┤
│  [🚀 Publish Now]       │ ← Big action button
│  [⏰ Schedule]          │
└─────────────────────────┘
```

---

## Mobile-Optimized Components

### Swipeable Cards for Listings

```
┌─────────────────────────┐
│ ← Swipe left or right → │
├─────────────────────────┤
│                         │
│  [Photo]  Nike Air Max  │
│           UK 9 • £75    │
│                         │
│  Listed on:             │
│  • eBay (45 views)      │
│  • Vinted (12 likes)    │
│                         │
│  3 days ago             │
│                         │
│ ← ✏️ Edit  |  Sold ✓ → │ ← Swipe actions
└─────────────────────────┘
```

**Swipe Actions:**

- Swipe left → Edit listing
- Swipe right → Mark as sold
- Tap → View full details
- Long press → More options (delete, relist, duplicate)

### Collapsible Sections

```
[▼ Title & Details]        ← Collapsed
[▽ Description (Tap to view 245 characters)]
```

Tap to expand:

```
[▼ Description]            ← Expanded
   Classic Nike Air Max 90 trainers in
   excellent condition. Minor sole wear.
   Perfect for casual wear or collectors.

   Condition Notes:
   • Light sole wear
   • Small scuff on right toe

   [Collapse ▲]
```

### Quick Action Sheets

When tapping "More Options":

```
┌─────────────────────────┐
│  Actions                │
│                         │
│  📝 Edit Listing        │
│  📊 View Analytics      │
│  💰 Change Price        │
│  📸 Add More Photos     │
│  🔄 Relist on New Platform │
│  🗑️ Delete Listing      │
│  ────────────           │
│  ❌ Cancel              │
└─────────────────────────┘
```

### Sticky Action Buttons

On detail pages, keep primary action visible:

```
┌─────────────────────────┐
│                         │
│  (Scrollable content)   │
│                         │
│                         │
├─────────────────────────┤
│  [Save Changes]         │ ← Sticky footer
└─────────────────────────┘
```

---

## Touch Gestures

### Gesture Map

| Gesture              | Action          | Context             |
| -------------------- | --------------- | ------------------- |
| **Tap**              | Select/Open     | Universal           |
| **Long Press**       | Context menu    | Listings, images    |
| **Swipe Left**       | Edit            | Listing cards       |
| **Swipe Right**      | Mark sold       | Listing cards       |
| **Swipe Down**       | Refresh         | Lists               |
| **Pinch to Zoom**    | Image detail    | Photo viewer        |
| **Swipe Left/Right** | Navigate images | Photo viewer        |
| **Pull to Refresh**  | Update data     | Dashboard, listings |

### Haptic Feedback

- Light tap: Button press
- Medium tap: Toggle switch
- Success vibration: Listing published
- Warning vibration: Quality issue detected
- Error vibration: Action failed

---

## Offline Mode

### Capability Matrix

| Feature              | Online Required | Offline Available | Notes                  |
| -------------------- | --------------- | ----------------- | ---------------------- |
| Take photos          | ❌              | ✅                | Stored locally         |
| Create draft listing | ❌              | ✅                | Saved to device        |
| AI generation        | ✅              | ❌                | Queued for when online |
| View saved listings  | ❌              | ✅                | Cached data            |
| Edit draft           | ❌              | ✅                | Syncs when online      |
| Publish listing      | ✅              | ❌                | Queued                 |
| View dashboard       | ❌              | ✅                | Cached stats           |
| Messages             | ✅              | ❌                | Real-time required     |

### Offline Workflow

```
User at thrift store (no WiFi):
1. Take 20 photos of 5 items
2. Photos saved locally
3. Create 5 draft listings (basic info only)
4. App shows "Queued for upload" badge
5. User leaves store, connects to WiFi
6. App auto-uploads photos
7. AI generates listings
8. Push notification: "5 listings ready to review"
9. User reviews and publishes
```

### Sync Indicator

```
┌─────────────────────────┐
│  QuickList AI    🔄 3   │ ← Sync badge
└─────────────────────────┘

Tap badge shows:
┌─────────────────────────┐
│  Syncing...             │
│                         │
│  ✓ Draft 1 uploaded     │
│  ✓ Draft 2 uploaded     │
│  ⏳ Draft 3 processing  │
│                         │
│  [View Queue]           │
└─────────────────────────┘
```

---

## Mobile Performance Optimizations

### Critical Performance Metrics (Target)

- **Time to Interactive (TTI):** <2 seconds on 4G
- **First Contentful Paint (FCP):** <1 second
- **Largest Contentful Paint (LCP):** <2.5 seconds
- **Cumulative Layout Shift (CLS):** <0.1
- **First Input Delay (FID):** <100ms
- **Bundle size:** <200KB initial load (gzipped)

### Image Optimization Pipeline

**Current Issue:** Base64 encoding in JSON inflates image size by ~33%
**Solution:** Use multipart/form-data and store as Blob URLs, then upload as binary

```javascript
// Optimized mobile image processing
class MobileImageOptimizer {
  constructor() {
    this.MAX_DIMENSION = 1200; // Mobile screen max
    this.THUMB_SIZE = 200; // List thumbnails
    this.QUALITY = 0.85; // Compression quality
    this.SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
  }

  async processImage(file) {
    // 1. Create canvas and load image
    const img = await this.loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 2. Calculate dimensions (maintain aspect ratio)
    const { width, height } = this.calculateDimensions(img.width, img.height, this.MAX_DIMENSION);

    // 3. Resize on canvas
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // 4. Convert to WebP if supported (better compression)
    const format = this.supportsWebP() ? 'image/webp' : 'image/jpeg';

    // 5. Create optimized blob
    const blob = await this.canvasToBlob(canvas, format, this.QUALITY);

    // 6. Generate thumbnail
    const thumbnail = await this.createThumbnail(canvas);

    // 7. Create object URLs (not base64!)
    return {
      full: {
        blob: blob,
        url: URL.createObjectURL(blob),
        size: blob.size,
        dimensions: { width, height },
      },
      thumb: {
        blob: thumbnail,
        url: URL.createObjectURL(thumbnail),
        size: thumbnail.size,
      },
    };
  }

  calculateDimensions(width, height, maxDimension) {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const ratio = width / height;
    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / ratio),
      };
    } else {
      return {
        width: Math.round(maxDimension * ratio),
        height: maxDimension,
      };
    }
  }

  async createThumbnail(sourceCanvas) {
    const thumbCanvas = document.createElement('canvas');
    const ctx = thumbCanvas.getContext('2d');

    thumbCanvas.width = this.THUMB_SIZE;
    thumbCanvas.height = this.THUMB_SIZE;

    // Draw with cover fit (crop to square)
    const size = Math.min(sourceCanvas.width, sourceCanvas.height);
    const x = (sourceCanvas.width - size) / 2;
    const y = (sourceCanvas.height - size) / 2;

    ctx.drawImage(sourceCanvas, x, y, size, size, 0, 0, this.THUMB_SIZE, this.THUMB_SIZE);

    return await this.canvasToBlob(
      thumbCanvas,
      'image/jpeg',
      0.7 // Lower quality for thumbnails
    );
  }

  canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
}

// Usage
const optimizer = new MobileImageOptimizer();
const optimized = await optimizer.processImage(file);

// Store in IndexedDB (not localStorage - no 5MB limit)
await db.images.add({
  id: generateId(),
  full: optimized.full.blob,
  thumb: optimized.thumb.blob,
  timestamp: Date.now(),
});
```

### Upload Strategy

**Problem:** Uploading 10 photos × 2MB each = 20MB on mobile data
**Solution:** Progressive upload with compression and cancellation

```javascript
class ProgressiveUploader {
  constructor(maxConcurrent = 2) {
    this.queue = [];
    this.active = new Set();
    this.maxConcurrent = maxConcurrent;
    this.abortControllers = new Map();
  }

  async uploadImages(images, onProgress) {
    const results = [];

    for (const image of images) {
      // Wait if at concurrency limit
      while (this.active.size >= this.maxConcurrent) {
        await this.waitForSlot();
      }

      // Start upload
      const uploadPromise = this.uploadSingle(image, onProgress);
      this.active.add(uploadPromise);

      uploadPromise.finally(() => {
        this.active.delete(uploadPromise);
      });

      results.push(uploadPromise);
    }

    return Promise.all(results);
  }

  async uploadSingle(image, onProgress) {
    const controller = new AbortController();
    const uploadId = Date.now() + Math.random();
    this.abortControllers.set(uploadId, controller);

    try {
      const formData = new FormData();
      formData.append('image', image.blob, `photo-${uploadId}.jpg`);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Track upload progress
        onUploadProgress: (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(uploadId, progress);
          }
        },
      });

      if (!response.ok) throw new Error('Upload failed');

      return await response.json();
    } finally {
      this.abortControllers.delete(uploadId);
    }
  }

  cancelAll() {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  waitForSlot() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.active.size < this.maxConcurrent) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}
```

### Lazy Loading Strategy

```javascript
// Only load images when they enter viewport
<img data-src="full-image.jpg"
     src="thumbnail.jpg"
     class="lazy-load">

// IntersectionObserver for lazy loading
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            observer.unobserve(img);
        }
    });
});
```

### IndexedDB Storage (Offline-First)

**Why IndexedDB over LocalStorage?**

- No 5MB limit (can store hundreds of draft listings with photos)
- Stores Blob objects directly (no base64 encoding needed)
- Asynchronous (doesn't block UI thread)
- Structured data with indexes for fast queries

```javascript
// Initialize IndexedDB database
class QuickListDB {
  constructor() {
    this.db = null;
    this.DB_NAME = 'QuickListDB';
    this.DB_VERSION = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for draft listings
        if (!db.objectStoreNames.contains('drafts')) {
          const draftStore = db.createObjectStore('drafts', {
            keyPath: 'id',
            autoIncrement: true,
          });
          draftStore.createIndex('timestamp', 'timestamp', { unique: false });
          draftStore.createIndex('status', 'status', { unique: false });
        }

        // Store for images (separate for better management)
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', {
            keyPath: 'id',
          });
          imageStore.createIndex('draftId', 'draftId', { unique: false });
          imageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for cached API responses
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', {
            keyPath: 'key',
          });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }

        // Queue for failed API requests (retry when online)
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Save draft listing
  async saveDraft(draft) {
    const transaction = this.db.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');

    const draftData = {
      ...draft,
      timestamp: Date.now(),
      status: 'draft',
      version: 1,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(draftData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Save image blob
  async saveImage(draftId, blob, type = 'full') {
    const transaction = this.db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');

    const imageData = {
      id: `${draftId}-${type}-${Date.now()}`,
      draftId: draftId,
      blob: blob,
      type: type, // 'full' or 'thumb'
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all drafts
  async getAllDrafts() {
    const transaction = this.db.transaction(['drafts'], 'readonly');
    const store = transaction.objectStore('drafts');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get images for a draft
  async getImagesForDraft(draftId) {
    const transaction = this.db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const index = store.index('draftId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(draftId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Cache API response
  async cacheData(key, data, ttl = 5 * 60 * 1000) {
    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    const cacheEntry = {
      key: key,
      data: data,
      expiry: Date.now() + ttl,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cacheEntry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  async getCachedData(key) {
    const transaction = this.db.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiry > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null); // Expired
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Add to sync queue (for failed uploads)
  async addToSyncQueue(action, data) {
    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    const queueItem = {
      action: action, // 'upload', 'delete', 'update'
      data: data,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get pending sync items
  async getPendingSyncItems() {
    const transaction = this.db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete from sync queue
  async removeFromSyncQueue(id) {
    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear expired cache entries
  async clearExpiredCache() {
    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('expiry');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      const deleted = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deleted.push(cursor.value.key);
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Initialize database
const db = new QuickListDB();
await db.init();

// Usage example: Save draft with images
const draftId = await db.saveDraft({
  title: 'Nike Air Max',
  description: 'Good condition...',
  price: 75,
});

// Save associated images
for (const image of optimizedImages) {
  await db.saveImage(draftId, image.full.blob, 'full');
  await db.saveImage(draftId, image.thumb.blob, 'thumb');
}
```

### Service Worker Caching Strategy

```javascript
// service-worker.js - Enhanced caching
const CACHE_VERSION = 'quicklist-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  // Add critical CSS/JS if extracted
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('quicklist-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch event - cache strategy based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
  }
  // Images: Cache first, network fallback
  else if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
  }
  // Static assets: Cache first
  else {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  }
});

// Network first (for API requests)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

// Cache first (for static assets and images)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Return offline fallback if available
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

// Background sync for queued uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-uploads') {
    event.waitUntil(syncQueuedUploads());
  }
});

async function syncQueuedUploads() {
  // This would integrate with IndexedDB sync queue
  const db = await openDB();
  const queue = await db.getPendingSyncItems();

  for (const item of queue) {
    try {
      await processQueueItem(item);
      await db.removeFromSyncQueue(item.id);
    } catch (error) {
      console.error('Sync failed for item:', item.id, error);
      // Retry later
    }
  }
}
```

### Progressive Web App (PWA) Configuration

```json
// manifest.json
{
  "name": "QuickList AI",
  "short_name": "QuickList",
  "description": "AI-powered marketplace listing generator",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#6366f1",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Responsive Breakpoints

### Mobile-First CSS Strategy

```css
/* Mobile first (default) */
.container {
  padding: 1rem;
  font-size: 16px;
}

.listing-card {
  display: block; /* Stacked */
  margin-bottom: 1rem;
}

.btn {
  width: 100%; /* Full width on mobile */
  padding: 1rem;
  font-size: 18px; /* Larger for touch */
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }

  .listing-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .btn {
    width: auto; /* Natural width */
    padding: 0.75rem 1.5rem;
    font-size: 16px;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem;
  }

  .listing-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .sidebar {
    display: block; /* Show sidebar on desktop */
  }
}

/* Large desktop (1440px+) */
@media (min-width: 1440px) {
  .listing-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### Adaptive UI Components

| Component          | Mobile (<768px)   | Tablet (768-1024px) | Desktop (>1024px)  |
| ------------------ | ----------------- | ------------------- | ------------------ |
| **Navigation**     | Bottom tabs       | Top bar + tabs      | Sidebar + top bar  |
| **Listing cards**  | Stacked (1 col)   | Grid (2 cols)       | Grid (3-4 cols)    |
| **Form fields**    | Full width        | 2 columns           | 3 columns          |
| **Images**         | Carousel          | Grid (2x2)          | Grid (3x3)         |
| **Action buttons** | Full width, large | Auto width, medium  | Auto width, normal |
| **Typography**     | 16px base         | 16px base           | 14px base          |

---

## Mobile-Specific Features

### 1. **Native Share Integration**

```javascript
// Share listing to social media
async function shareListing(listing) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: listing.title,
        text: `Check out this ${listing.title} for £${listing.price}`,
        url: listing.url,
      });
    } catch (err) {
      console.log('Share cancelled');
    }
  } else {
    // Fallback: Copy link
    copyToClipboard(listing.url);
    showToast('Link copied to clipboard');
  }
}
```

### 2. **Geolocation for Local Listings**

```javascript
// Auto-fill location for local pickup
async function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocode to get city/postcode
        reverseGeocode(latitude, longitude).then((location) => {
          document.getElementById('location').value = location.city;
        });
      },
      (error) => {
        console.log('Location access denied');
      }
    );
  }
}
```

### 3. **Voice Input for Descriptions**

```javascript
// Voice dictation for notes/descriptions
function startVoiceInput() {
  if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');

      document.getElementById('hint').value = transcript;
    };

    recognition.start();
  } else {
    showToast('Voice input not supported on this device');
  }
}
```

### 4. **Push Notifications**

```javascript
// Request permission
async function enableNotifications() {
  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    // Register service worker for push
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    // Send subscription to backend
    await fetch('/api/push-subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  }
}

// Notification triggers:
// - Item sold
// - New message from buyer
// - Price drop alert
// - Listing about to expire
// - AI processing complete
```

### 5. **Vibration Feedback**

```javascript
// Haptic feedback for actions
function vibrateFeedback(type) {
  if (!navigator.vibrate) return;

  const patterns = {
    success: [50, 30, 50], // Short double pulse
    warning: [100, 50, 100, 50, 100], // Triple pulse
    error: [200], // Long pulse
    click: [10], // Light tap
  };

  navigator.vibrate(patterns[type] || patterns.click);
}

// Usage:
document.getElementById('publishBtn').addEventListener('click', () => {
  vibrateFeedback('success');
  publishListing();
});
```

---

## Accessibility (Mobile Focus)

### Touch Target Sizes

```css
/* Minimum 44x44px touch targets */
.btn,
.input,
.select,
.checkbox {
  min-height: 44px;
  min-width: 44px;
}

/* Spacing between interactive elements */
.btn + .btn {
  margin-top: 12px; /* Prevent accidental taps */
}
```

### Font Scaling

```css
/* Respect user's font size preferences */
html {
  font-size: 16px; /* Base size */
}

body {
  font-size: 1rem; /* Scales with user preference */
}

/* Prevent zoom on input focus (iOS) */
input,
select,
textarea {
  font-size: 16px; /* Minimum to prevent zoom */
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  :root {
    --bg-primary: #000000;
    --text-primary: #ffffff;
    --border-color: #ffffff;
    --accent: #ffff00; /* High contrast yellow */
  }
}
```

### Screen Reader Support

```html
<!-- Descriptive labels for screen readers -->
<button aria-label="Upload photos from gallery">
  <svg>...</svg>
</button>

<!-- Status announcements -->
<div role="status" aria-live="polite">Listing published successfully</div>

<!-- Progress indicators -->
<div role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100">65% complete</div>
```

---

## Mobile Testing Strategy

### Device Coverage

**Priority Devices:**

1. iPhone 14/15 (iOS 17+)
2. iPhone SE (small screen)
3. Samsung Galaxy S23 (Android 13+)
4. Google Pixel 8
5. OnePlus 11

**Screen Sizes to Test:**

- Small (320px - 375px): iPhone SE, older Androids
- Medium (375px - 428px): Most modern phones
- Large (428px+): Pro Max models, foldables

### Test Scenarios

**Camera Functionality:**

- [ ] Camera opens correctly
- [ ] Switch between front/rear camera
- [ ] Flash control works
- [ ] Batch photo capture (10+ photos)
- [ ] Photo quality on device
- [ ] Real-time blur detection
- [ ] Lighting feedback

**Performance:**

- [ ] App loads in <2 seconds (4G)
- [ ] Image upload in <5 seconds per image
- [ ] AI generation in <20 seconds
- [ ] Smooth scrolling (60fps)
- [ ] No memory leaks (use for 30+ min)

**Offline Mode:**

- [ ] Take photos offline
- [ ] Create drafts offline
- [ ] Sync when online
- [ ] Queue indicator works
- [ ] No data loss

**Touch Interactions:**

- [ ] All tap targets >44px
- [ ] Swipe gestures work smoothly
- [ ] No accidental taps
- [ ] Haptic feedback works (where supported)

**Network Conditions:**

- [ ] Works on 4G
- [ ] Works on slow 3G
- [ ] Graceful degradation on 2G
- [ ] Offline mode kicks in appropriately

---

## Implementation Checklist

### Phase 1: Foundation & Navigation (Week 1)

**1.1 Hamburger Menu System**

- [ ] Create hamburger menu overlay component (HTML structure)
- [ ] Implement slide-in animation (CSS transform: translateX)
- [ ] Add SVG icon system (Heroicons v2 or Lucide)
- [ ] Create menu items with proper icons
- [ ] Implement swipe-from-left gesture to open menu
- [ ] Add backdrop overlay with tap-to-close
- [ ] Test menu accessibility (keyboard navigation, screen readers)

**1.2 Floating Action Button (FAB)**

- [ ] Create fixed-position FAB (bottom-right)
- [ ] Implement camera icon with + symbol
- [ ] Add pulse/bounce animation to draw attention
- [ ] Connect FAB to camera workflow
- [ ] Test visibility across all screen sizes
- [ ] Add accessibility label

**1.3 Header Optimization**

- [ ] Redesign header for mobile (remove clutter)
- [ ] Add hamburger button (top-left)
- [ ] Add FAB shortcut icon (top-right)
- [ ] Implement sticky header on scroll
- [ ] Test safe area insets (notched devices)

**1.4 Remove Bottom Tab Bar**

- [ ] Remove existing bottom tab bar CSS/HTML
- [ ] Clean up related JavaScript event handlers
- [ ] Test navigation flow without bottom tabs
- [ ] Verify all features accessible via hamburger menu

---

### Phase 2: Camera & Image Optimization (Week 2)

**2.1 Camera Interface**

- [ ] Implement full-screen camera view
- [ ] Add camera constraint configuration (1920x1080, rear camera)
- [ ] Create camera control buttons (capture, flip, flash)
- [ ] Implement tap-to-focus (if supported)
- [ ] Add photo gallery access
- [ ] Test camera permissions flow

**2.2 Real-Time Quality Feedback**

- [ ] Implement Laplacian blur detection algorithm
- [ ] Add histogram analysis for lighting
- [ ] Create 5-dot quality indicator UI
- [ ] Display real-time warnings (blur, dark, bright)
- [ ] Add rule-of-thirds grid overlay
- [ ] Optimize performance (run checks every 500ms)

**2.3 Image Optimization Pipeline**

- [ ] Create `MobileImageOptimizer` class
- [ ] Implement WebP format detection and conversion
- [ ] Add canvas-based image resizing (max 1200px)
- [ ] Generate thumbnails (200px square, cropped)
- [ ] Replace base64 encoding with Blob URLs
- [ ] Test image compression quality (0.85 for full, 0.7 for thumbs)

**2.4 Batch Capture Mode**

- [ ] Create thumbnail strip UI at bottom of camera
- [ ] Implement multi-photo capture workflow
- [ ] Add tap-to-review individual photos
- [ ] Add swipe-to-delete gesture
- [ ] Save batch to IndexedDB
- [ ] Display photo count (e.g., "Photo 3 of 10")

---

### Phase 3: IndexedDB & Offline Support (Week 2-3)

**3.1 IndexedDB Setup**

- [ ] Create `QuickListDB` class with 4 object stores
  - [ ] `drafts` store (listings in progress)
  - [ ] `images` store (photo blobs)
  - [ ] `cache` store (API responses)
  - [ ] `syncQueue` store (failed uploads to retry)
- [ ] Add indexes (timestamp, status, draftId, expiry)
- [ ] Implement CRUD operations for each store
- [ ] Test IndexedDB capacity (ensure >50MB works)

**3.2 Draft Management**

- [ ] Implement `saveDraft()` function
- [ ] Implement `getAllDrafts()` function
- [ ] Create draft recovery UI (on app startup)
- [ ] Add "Resume Draft" button on camera screen
- [ ] Display draft timestamp and preview
- [ ] Test draft persistence across sessions

**3.3 Image Storage**

- [ ] Save image blobs to IndexedDB (not base64)
- [ ] Link images to draft IDs via index
- [ ] Implement image retrieval and URL.createObjectURL
- [ ] Add image cleanup (delete old images after 30 days)
- [ ] Test storage limits (10 photos × 500KB = 5MB per draft)

**3.4 Sync Queue**

- [ ] Detect online/offline status
- [ ] Add failed uploads to sync queue
- [ ] Implement retry logic with exponential backoff
- [ ] Display sync status indicator in header
- [ ] Show sync queue UI ("3 items pending upload")
- [ ] Trigger background sync when online

---

### Phase 4: Service Worker & PWA (Week 3)

**4.1 Service Worker Enhancement**

- [ ] Update service worker to v2 (bump cache version)
- [ ] Implement network-first strategy for API calls
- [ ] Implement cache-first strategy for images
- [ ] Add offline fallback page
- [ ] Test cache expiration and cleanup
- [ ] Implement background sync event listener

**4.2 Progressive Upload**

- [ ] Create `ProgressiveUploader` class
- [ ] Limit concurrent uploads (max 2 on mobile)
- [ ] Implement upload progress tracking
- [ ] Add cancel upload functionality
- [ ] Display upload progress UI (progress bar)
- [ ] Handle upload failures gracefully

**4.3 Offline Mode UI**

- [ ] Add offline indicator banner
- [ ] Disable online-only features when offline
- [ ] Show "Queued for upload" badges
- [ ] Enable offline photo capture and draft creation
- [ ] Test seamless transition from offline to online

**4.4 PWA Installation**

- [ ] Update manifest.json (already exists, verify)
- [ ] Test "Add to Home Screen" prompt
- [ ] Create install prompt UI (if not installed)
- [ ] Test app icon and splash screen
- [ ] Verify standalone mode works correctly

---

### Phase 5: Mobile UX Enhancements (Week 4)

**5.1 Touch Gestures**

- [ ] Implement swipe-left on listing cards (edit action)
- [ ] Implement swipe-right on listing cards (mark sold)
- [ ] Add pull-to-refresh on listing screen
- [ ] Implement pinch-to-zoom on image viewer
- [ ] Add long-press context menu
- [ ] Test gesture conflicts (e.g., swipe vs. scroll)

**5.2 Collapsible Sections**

- [ ] Create accordion component for long forms
- [ ] Add expand/collapse animations
- [ ] Implement "Tap to view" preview text
- [ ] Save expansion state in session storage
- [ ] Test accessibility (keyboard controls)

**5.3 Action Sheets**

- [ ] Create bottom sheet component (iOS-style)
- [ ] Add slide-up animation
- [ ] Implement backdrop tap-to-close
- [ ] Use for "More Options" menus
- [ ] Test on different screen heights

**5.4 Loading & Skeleton States**

- [ ] Create skeleton loading components
- [ ] Add loading spinners for async operations
- [ ] Implement optimistic UI updates
- [ ] Show progress indicators during AI generation
- [ ] Test loading states on slow connections

**5.5 Empty & Error States**

- [ ] Design empty state illustrations (no listings)
- [ ] Create friendly error messages
- [ ] Add retry buttons for failed operations
- [ ] Implement toast notifications
- [ ] Test error recovery flows

---

### Phase 6: Mobile-Specific Features (Week 4-5)

**6.1 Native Share API**

- [ ] Implement `navigator.share()` for listings
- [ ] Share listing text + URL + image
- [ ] Add fallback (copy link to clipboard)
- [ ] Test on iOS and Android

**6.2 Geolocation**

- [ ] Request location permission
- [ ] Auto-fill location field for local pickup
- [ ] Reverse geocode to city/postcode
- [ ] Add manual location override
- [ ] Test privacy controls

**6.3 Voice Input**

- [ ] Implement `webkitSpeechRecognition` API
- [ ] Add microphone button to description field
- [ ] Show listening indicator with animation
- [ ] Handle speech-to-text errors gracefully
- [ ] Test on supported browsers (Chrome, Safari)

**6.4 Haptic Feedback**

- [ ] Add vibration patterns for different actions
  - [ ] Light tap: Button press
  - [ ] Medium: Toggle switch
  - [ ] Success: Listing published
  - [ ] Warning: Quality issue
  - [ ] Error: Action failed
- [ ] Test on devices with vibration support

**6.5 Push Notifications**

- [ ] Request notification permission
- [ ] Register service worker for push
- [ ] Implement notification triggers:
  - [ ] Item sold
  - [ ] New message from buyer
  - [ ] Listing about to expire
  - [ ] AI processing complete
- [ ] Test notification delivery

---

### Phase 7: Performance Optimization (Week 5)

**7.1 Core Web Vitals**

- [ ] Measure baseline performance (Lighthouse)
- [ ] Optimize Largest Contentful Paint (LCP <2.5s)
- [ ] Optimize First Input Delay (FID <100ms)
- [ ] Minimize Cumulative Layout Shift (CLS <0.1)
- [ ] Optimize Time to Interactive (TTI <2s)

**7.2 Code Splitting**

- [ ] Extract marketing pages from app code (separate HTML files)
- [ ] Load Lottie library only when needed
- [ ] Lazy load images with IntersectionObserver
- [ ] Defer non-critical JavaScript
- [ ] Test bundle size reduction

**7.3 Network Optimization**

- [ ] Enable HTTP/2 server push (if possible)
- [ ] Add resource hints (preconnect, prefetch)
- [ ] Compress API responses (gzip/brotli)
- [ ] Implement request batching
- [ ] Test on 3G network simulation

**7.4 Rendering Performance**

- [ ] Use CSS `will-change` for animations
- [ ] Minimize DOM manipulation
- [ ] Use `requestAnimationFrame` for smooth animations
- [ ] Debounce/throttle scroll and resize events
- [ ] Profile with Chrome DevTools Performance tab

---

### Phase 8: Testing & QA (Week 5-6)

**8.1 Device Testing**

- [ ] iPhone SE (small screen, iOS)
- [ ] iPhone 14/15 (medium, iOS 17+)
- [ ] iPhone 15 Pro Max (large, iOS 17+)
- [ ] Samsung Galaxy S23 (Android 13+)
- [ ] Google Pixel 8 (Android 14+)
- [ ] iPad (tablet form factor)

**8.2 Browser Testing**

- [ ] Safari (iOS)
- [ ] Chrome (iOS)
- [ ] Chrome (Android)
- [ ] Samsung Internet (Android)
- [ ] Firefox (Android)

**8.3 Network Condition Testing**

- [ ] 4G (fast mobile)
- [ ] 3G (slow mobile)
- [ ] 2G (edge cases)
- [ ] Offline mode
- [ ] Intermittent connectivity

**8.4 Accessibility Testing**

- [ ] Screen reader (VoiceOver on iOS, TalkBack on Android)
- [ ] Keyboard navigation
- [ ] Color contrast (WCAG AA compliance)
- [ ] Touch target sizes (min 44x44px)
- [ ] Font scaling (test at 200% zoom)

**8.5 User Acceptance Testing**

- [ ] Recruit 5-10 resellers for beta testing
- [ ] Observe users completing key workflows
- [ ] Collect feedback on pain points
- [ ] Measure task completion time
- [ ] Iterate based on feedback

---

### Phase 9: Deployment & Monitoring (Week 6)

**9.1 Pre-launch Checklist**

- [ ] Run full Lighthouse audit (score >90)
- [ ] Test PWA installation flow
- [ ] Verify analytics tracking
- [ ] Test error logging (Sentry or similar)
- [ ] Review security headers (CSP, CORS)

**9.2 Launch**

- [ ] Deploy to production (Vercel)
- [ ] Monitor server logs for errors
- [ ] Track Core Web Vitals in production
- [ ] Monitor API rate limits and quotas
- [ ] Set up uptime monitoring

**9.3 Post-Launch Monitoring**

- [ ] Track mobile vs desktop usage ratio (target: 70/30)
- [ ] Monitor camera usage rate (target: 80%)
- [ ] Track PWA install rate (target: 30%)
- [ ] Measure listing completion rate (target: 75%)
- [ ] Monitor performance metrics daily

---

## Success Metrics

### Mobile-Specific KPIs

**Engagement:**

- Mobile vs desktop usage ratio (target: 70/30)
- Camera usage rate (target: 80% of listings)
- Offline draft creation rate (target: 40%)

**Performance:**

- Time to interactive (target: <2s on 4G)
- Time to first photo (target: <1s)
- Photo to listing time (target: <2 min)

**Conversion:**

- Mobile listing completion rate (target: 75%)
- PWA install rate (target: 30% of users)
- Mobile publish success rate (target: 95%)

**Retention:**

- Daily active users (mobile) (target: 60%+)
- Return within 7 days (target: 70%+)
- Average sessions per day (target: 3+)

---

## Future Mobile Enhancements

### Near-Term (3-6 months)

- AR preview (see item in buyer's space)
- Smart bundling (scan multiple items, auto-bundle)
- Voice commands ("List this on eBay")
- Widget for quick stats on home screen

### Long-Term (6-12 months)

- Native mobile apps (iOS/Android)
- Apple Watch companion (quick stats, notifications)
- NFC tag scanning (for inventory tracking)
- Advanced AR features (size estimation, virtual try-on)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Author:** QuickList AI Development Team
