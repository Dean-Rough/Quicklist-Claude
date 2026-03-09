# QuickList AI - Wizard Flow Redesign Plan

## Executive Summary

Complete redesign of the listing generation flow to implement a clear, wizard-based progression with separate modals for complex tasks. This improves UX, reduces confusion, and adds new features like bundle saving and hero image preview.

---

## Current Problems

1. ❌ **No clear progression** - Users don't know what step they're on
2. ❌ **Multiple items poorly handled** - Detection exists but UX is confusing
3. ❌ **Image editing inline** - Enhancement options scattered
4. ❌ **No hero preview** - Users can't see before committing
5. ❌ **Can't save without generating** - Wastes credits for bundles
6. ❌ **No visual feedback** - Wizard phases not clear

---

## New Wizard Flow

### Overview

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Upload & Analysis                             │
│  User uploads → Auto-compress → Analyze for items       │
└─────────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────┴──────────────┐
         │                             │
    [1 item]                    [Multiple items]
         │                             │
         ↓                             ↓
┌─────────────────┐      ┌──────────────────────────────┐
│ PHASE 2A:       │      │ PHASE 2B:                    │
│ Auto-generate   │      │ Item Selection Modal         │
│ listing         │      │ • Thumbnails with titles     │
└─────────────────┘      │ • Select items to generate   │
         │               │ • Save bundle (free)         │
         │               └──────────────────────────────┘
         │                             │
         └──────────────┬──────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: Listing Edit                                  │
│  Edit details → "Save Item" button → Proceed            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: Image Enhancement Modal                       │
│  • Select main image                                    │
│  • Enhancement options (blur fix, background, hero)     │
│  • Hero preview with comedy ticker                      │
│  • Export options                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Phase Specifications

### PHASE 1: Upload & Analysis

**Location:** Main "New Item" view

**UI Components:**
- Upload dropzone (existing)
- Compression progress toast
- Analysis loading state
- Item count badge

**Flow:**
```javascript
1. User uploads images
2. Compress images (existing functionality)
3. Create preview thumbnails
4. Auto-analyze images via API call
5. Detect number of items
6. Route to Phase 2A or 2B
```

**New API Endpoint Required:**
```
POST /api/analyze-images
Input: { images: base64[], fast: true }
Output: {
  itemCount: number,
  items: [{ title, imageIndices, confidence }]
}
```

**State Changes:**
```javascript
currentBundle: {
  id: null,
  images: [],
  analyzedItems: [],
  status: 'analyzing'
}
```

---

### PHASE 2A: Single Item (Auto-generate)

**No UI changes needed** - automatically call existing `generateListing()` function

**Flow:**
```javascript
if (analyzedItems.length === 1) {
  this.generateListing();
  // Proceeds to Phase 3 automatically
}
```

---

### PHASE 2B: Multiple Items Selection Modal

**Modal Design:**
```html
┌──────────────────────────────────────────────────────────┐
│  📦 Multiple Items Detected (3 items)        [✕]         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Select items to generate listings:                      │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   [img 1]   │  │   [img 2]   │  │   [img 3]   │    │
│  │             │  │             │  │             │    │
│  │ Nike Air Max│  │ Adidas Tee  │  │ Baseball Cap│    │
│  │ 3 photos    │  │ 2 photos    │  │ 1 photo     │    │
│  │             │  │             │  │             │    │
│  │ [✓] Select  │  │ [✓] Select  │  │ [ ] Select  │    │
│  │ Generate →  │  │ Generate →  │  │ Generate →  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💾 Save entire image bundle to Saved Items       │  │
│  │    (Free - no generation credits used)           │  │
│  │    [✓] Save bundle                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  [Cancel]              [Generate Selected (2 items)]     │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Each item card shows:
  - Primary thumbnail image
  - Detected title
  - Photo count
  - Checkbox to select
  - Individual "Generate" button
- Bottom checkbox: Save entire bundle (free operation)
- "Generate Selected" shows count
- Can generate one, some, or all items

**New Components:**
- `ItemCard` - Individual item display
- `ItemSelectionModal` - Container modal

**Flow:**
```javascript
showItemSelectionModal(analyzedItems) {
  1. Display modal with item cards
  2. User selects items
  3. Options:
     a) Click individual "Generate" → Phase 3 for that item
     b) Check items + click "Generate Selected" → Queue generation
     c) Check "Save bundle" → Save to DB (free)
  4. Modal closes, proceeds to Phase 3 for first item
}
```

**Database Schema Addition:**
```sql
CREATE TABLE image_bundles (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  images JSONB,
  analyzed_items JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### PHASE 3: Listing Edit

**Location:** Existing result view

**Changes:**
- Add wizard progress indicator at top
- Replace export buttons section with:
  - "Save & Exit" (secondary)
  - "Save Item & Enhance Images →" (primary, large)

**New HTML:**
```html
<!-- Add to top of result view -->
<div class="wizard-progress">
  <div class="wizard-step completed">Upload</div>
  <div class="wizard-step completed">Generate</div>
  <div class="wizard-step active">Edit Listing</div>
  <div class="wizard-step">Enhance Images</div>
</div>

<!-- Replace existing action buttons -->
<div class="listing-edit-actions">
  <button class="btn btn-secondary" onclick="app.saveAndExit()">
    💾 Save & Exit
  </button>
  <button class="btn btn-primary btn-lg" onclick="app.proceedToImageEnhancement()">
    ✨ Save Item & Enhance Images →
  </button>
</div>
```

**Flow:**
```javascript
proceedToImageEnhancement() {
  1. Validate listing fields
  2. Save listing to DB
  3. Show success toast
  4. Open Image Enhancement Modal (Phase 4)
}
```

---

### PHASE 4: Image Enhancement Modal

**Modal Design:**
```html
┌──────────────────────────────────────────────────────────┐
│  ✨ Image Enhancement                          [✕]       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Select Main Image:                                      │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐              │
│  │ [img] │ │ [img] │ │ [img] │ │ [img] │              │
│  │  [★]  │ │  [ ]  │ │  [ ]  │ │  [ ]  │              │
│  └───────┘ └───────┘ └───────┘ └───────┘              │
│                                                          │
│  Enhancement Options:                                    │
│  ┌────────────────────────────────────────────────┐    │
│  │ [✓] Fix blurry images automatically            │    │
│  │                                                 │    │
│  │ [ ] Remove background (studio mode)            │    │
│  │     Creates clean product photos                │    │
│  │                                                 │    │
│  │ [ ] Generate hero image (Pro)                  │    │
│  │     ┌─────────────────────────────────────┐   │    │
│  │     │ Background: [Neutral Gray      ▼]   │   │    │
│  │     │ Lighting:   [Soft Shadow       ▼]   │   │    │
│  │     └─────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [Cancel]  [Preview Changes]  [Apply & Continue →]      │
└──────────────────────────────────────────────────────────┘
```

**Flow:**
```javascript
openImageEnhancementModal() {
  1. Show modal
  2. User selects main image (set as first in array)
  3. User selects enhancement options
  4. If "Generate hero image" checked:
     a) Show comedy progress modal
     b) Call hero generation API
     c) Show hero preview modal
     d) User accepts or retries
  5. Apply all enhancements
  6. Show export options
}
```

---

### Hero Image Generation Flow

**Step 1: Comedy Progress Modal**
```html
┌──────────────────────────────────────────────────────────┐
│  🎬 Generating Hero Image...                             │
│                                                          │
│  Digging out the cameras...                             │
│  ███████████████░░░░░░░░ 75%                            │
│                                                          │
│  Expected time: ~30 seconds                              │
│                                                          │
│  [Cancel Generation]                                     │
└──────────────────────────────────────────────────────────┘
```

**Comedy Messages:**
```javascript
heroImageMessages: [
  "🎬 Digging out the cameras...",
  "💡 Adjusting the studio lights...",
  "🎨 Setting up the backdrop...",
  "📐 Positioning the product perfectly...",
  "📷 Checking the angles...",
  "⚙️ Adjusting the exposure...",
  "✨ Adding professional polish...",
  "🧹 Removing the fingerprints...",
  "📏 Straightening the shot...",
  "📰 Adding that magazine quality...",
  "💎 Making it pop...",
  "🎭 Studio magic in progress...",
  "🔍 Zooming in for detail...",
  "🎪 Rolling out the red carpet...",
  "🌟 Sprinkling some stardust...",
  "🎯 Getting it pixel-perfect...",
  "🖼️ Framing like a pro...",
  "🎨 Touching up the colors...",
  "✂️ Cropping to perfection...",
  "🎬 And... action!"
]
```

**Step 2: Hero Preview Modal**
```html
┌──────────────────────────────────────────────────────────┐
│  🖼️ Hero Image Preview                         [✕]       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                │    │
│  │                                                │    │
│  │          [Enhanced Hero Image Display]         │    │
│  │               (Full size preview)              │    │
│  │                                                │    │
│  │                                                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Background: Neutral Gray  |  Lighting: Soft Shadow     │
│                                                          │
│  [✕ Discard]  [← Try Different Style]  [✓ Keep & Use]  │
└──────────────────────────────────────────────────────────┘
```

**Flow:**
```javascript
async generateHeroImage() {
  1. Show comedy progress modal
  2. Start message cycler
  3. Call API: POST /api/enhance-image
  4. On success:
     - Hide progress modal
     - Show preview modal with result
  5. User options:
     - Keep: Add to images array, mark as main
     - Try Different: Regenerate with new settings
     - Discard: Close modal, return to enhancement
}
```

---

## State Management

### New State Structure

```javascript
state: {
  // ... existing state ...

  // Wizard state
  wizardPhase: 'upload', // upload, analysis, itemSelection, listingEdit, imageEnhancement
  wizardProgress: {
    upload: 'completed',
    generate: 'active',
    edit: 'pending',
    enhance: 'pending'
  },

  // Bundle state
  currentBundle: {
    id: null,
    images: [], // compressed image files
    analyzedItems: [], // [{ title, imageIndices, confidence }]
    selectedItemIndices: new Set(),
    savedToDb: false
  },

  // Image enhancement state
  imageEnhancement: {
    isOpen: false,
    mainImageIndex: 0,
    options: {
      fixBlurry: true, // default on
      removeBackground: false,
      generateHero: false,
      heroBackground: 'neutral',
      heroLighting: 'soft'
    },
    heroPreview: null,
    heroGenerating: false,
    heroProgress: 0
  }
}
```

---

## API Endpoints

### New Endpoints Required

#### 1. Analyze Images (Fast)
```
POST /api/analyze-images
Headers: Authorization: Bearer <token>
Body: {
  images: string[], // base64 images
  fast: boolean // quick analysis, no full listing
}
Response: {
  itemCount: number,
  items: [{
    title: string,
    imageIndices: number[],
    confidence: 'high' | 'medium' | 'low'
  }]
}
```

#### 2. Save Image Bundle
```
POST /api/bundles
Headers: Authorization: Bearer <token>
Body: {
  images: string[], // base64 or Cloudinary URLs
  analyzedItems: object[]
}
Response: {
  bundleId: number,
  message: 'Bundle saved successfully'
}
```

#### 3. Generate Hero Image (Already exists, needs comedy progress)
```
POST /api/enhance-image
Headers: Authorization: Bearer <token>
Body: {
  image: string, // base64
  background: string,
  lighting: string
}
Response: {
  enhancedImage: string, // base64 or URL
  settings: { background, lighting }
}
```

---

## Component Structure

### New Components to Create

```
components/
├── WizardProgress.js         # Progress indicator
├── ItemSelectionModal.js     # Phase 2B modal
├── ItemCard.js               # Individual item in selection
├── ImageEnhancementModal.js  # Phase 4 modal
├── HeroPreviewModal.js       # Hero image preview
└── ComedyProgressModal.js    # Reusable progress with messages
```

---

## CSS Requirements

### New Classes Needed

```css
/* Wizard Progress */
.wizard-progress {
  display: flex;
  justify-content: space-between;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-bento);
  margin-bottom: 2rem;
}

.wizard-step {
  flex: 1;
  text-align: center;
  padding: 1rem;
  position: relative;
  opacity: 0.5;
}

.wizard-step.active {
  opacity: 1;
  font-weight: 700;
  color: var(--accent-indigo);
}

.wizard-step.completed {
  opacity: 1;
  color: var(--color-success);
}

/* Item Selection Modal */
.item-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.item-card {
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-bento);
  padding: 1rem;
  text-align: center;
  transition: all 0.2s;
}

.item-card.selected {
  border-color: var(--accent-indigo);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.item-card-thumbnail {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.item-card-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.item-card-meta {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

/* Image Enhancement Modal */
.main-image-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.main-image-option {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.main-image-option.selected {
  border-color: var(--accent-indigo);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.main-image-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.main-image-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--accent-indigo);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 1.25rem;
}

.enhancement-options {
  background: var(--bg-tertiary);
  padding: 1.5rem;
  border-radius: var(--radius-bento);
  margin: 1.5rem 0;
}

.enhancement-option {
  margin-bottom: 1.5rem;
}

.enhancement-option:last-child {
  margin-bottom: 0;
}

.hero-settings {
  margin-left: 2rem;
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

/* Hero Preview Modal */
.hero-preview-container {
  width: 100%;
  max-width: 800px;
  margin: 2rem auto;
  text-align: center;
}

.hero-preview-image {
  width: 100%;
  max-height: 600px;
  object-fit: contain;
  border-radius: var(--radius-bento);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.hero-preview-meta {
  margin-top: 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Comedy Progress */
.comedy-progress-modal {
  text-align: center;
  padding: 3rem;
}

.comedy-progress-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  animation: pulse 2s infinite;
}

.comedy-progress-message {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  min-height: 2rem;
  color: var(--accent-indigo);
}

.comedy-progress-bar {
  width: 100%;
  height: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  overflow: hidden;
  margin: 2rem 0;
}

.comedy-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-indigo), #8b5cf6);
  border-radius: 6px;
  transition: width 0.3s ease;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

---

## Implementation Order

### Phase 1: Foundation (Day 1)
1. ✅ Create `WIZARD_FLOW_PLAN.md` (this document)
2. 🔲 Update state structure
3. 🔲 Create CSS for all new components
4. 🔲 Add wizard progress indicator HTML

### Phase 2: Item Selection (Day 1-2)
5. 🔲 Create `ItemSelectionModal` component
6. 🔲 Create `ItemCard` component
7. 🔲 Add database schema for `image_bundles`
8. 🔲 Create `/api/analyze-images` endpoint
9. 🔲 Create `/api/bundles` endpoint
10. 🔲 Wire up upload → analysis → modal flow

### Phase 3: Image Enhancement (Day 2-3)
11. 🔲 Create `ImageEnhancementModal` component
12. 🔲 Add main image selection UI
13. 🔲 Add enhancement options UI
14. 🔲 Wire up "Save Item & Enhance Images" button

### Phase 4: Hero Preview (Day 3)
15. 🔲 Create `ComedyProgressModal` component
16. 🔲 Add hero generation comedy messages
17. 🔲 Create `HeroPreviewModal` component
18. 🔲 Wire up hero generation flow
19. 🔲 Add retry/discard/keep logic

### Phase 5: Testing & Polish (Day 4)
20. 🔲 Test single item flow
21. 🔲 Test multiple items flow
22. 🔲 Test bundle saving (no credit deduction)
23. 🔲 Test hero generation + preview
24. 🔲 Test all cancel/back flows
25. 🔲 Polish animations and transitions
26. 🔲 Mobile responsive testing

---

## Success Criteria

✅ **User can upload images and see clear progression**
✅ **Multiple items show in modal with thumbnails**
✅ **Can save bundle without generating (free)**
✅ **Can select which items to generate**
✅ **Clear "Save Item & Enhance" button after editing**
✅ **Image enhancement modal with main image selection**
✅ **Hero generation shows comedy progress**
✅ **Hero preview shows before committing**
✅ **Can retry hero with different settings**
✅ **All phases work on mobile**

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API latency for analysis | HIGH | Add loading states, use fast analysis mode |
| Hero generation takes too long | MEDIUM | Show comedy messages, add cancel option |
| Complex state management | HIGH | Use clear state structure, add logging |
| Mobile modal UX | MEDIUM | Test early, use responsive grids |
| Bundle DB storage | LOW | Use Cloudinary URLs instead of base64 |

---

## Future Enhancements

- Batch hero generation for multiple images
- AI-powered main image selection
- Background removal preview
- Save enhancement presets
- Undo/redo for edits
- Keyboard shortcuts for wizard navigation

---

## Notes

- Keep existing functionality working during migration
- Add feature flags for gradual rollout
- Log wizard progression for analytics
- A/B test comedy messages for engagement

---

**Document Version:** 1.0
**Last Updated:** 2026-03-09
**Status:** Ready for Implementation
