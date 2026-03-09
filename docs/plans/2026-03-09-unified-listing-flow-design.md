# Unified Listing Creation Flow — Design Document

**Date:** 2026-03-09
**Status:** Approved for implementation

## Problem

QuickList has two completely separate listing creation flows that share no code:

- **New Item**: Input sheet slides up, single-item generation, full edit/export but no wizard progress or enhancement step
- **Photo Dump**: Separate page, multi-item grouping, but broken CSS, stub edit/enhance functions, no export options

Users get a fundamentally different experience depending on which button they press. Neither flow is complete on its own.

### Current Flow Issues

| Issue | Impact |
|-------|--------|
| Photo Dump CSS broken (class mismatches, overlapping thumbnails) | Non-functional UI |
| Photo Dump "Edit" button is a stub | Users can't edit generated listings |
| Enhancement modal has no backend calls | Options shown but nothing happens |
| Hero generation uses placeholder image | Feature appears broken |
| New Item has no wizard progress indicator | No sense of where user is in flow |
| New Item has no enhancement step | Missing feature parity |
| No export options in Photo Dump | Can't download/copy/share |
| Two separate upload components | Duplicate code, inconsistent UX |
| Two separate review/edit experiences | Confusing for users |

## Design: One Flow, Smart Branching

Replace both flows with a single unified wizard. The app adapts based on what the user uploads.

### Flow Diagram

```
[Dashboard] → "Create Listing" button
                    ↓
            ┌─── STEP 1: UPLOAD ───┐
            │ Drag/drop or select   │
            │ Optional: item hint   │
            │ Optional: condition   │
            │ Platform selector     │
            └──────────┬────────────┘
                       ↓
            ┌─── STEP 2: ANALYZE ──┐
            │ Comedy progress bar   │
            │ AI groups photos      │
            └──────────┬────────────┘
                       ↓
              ┌── 1 item? ──┐
              │              │
            [yes]          [no]
              │              │
              ↓              ↓
         Auto-generate   STEP 2b: SELECT
              │          │ Item cards grid  │
              │          │ Check/uncheck    │
              │          │ "Generate X"     │
              │          └────────┬─────────┘
              │                   ↓
              └───────┬───────────┘
                      ↓
            ┌─── STEP 3: REVIEW & EDIT ──┐
            │ Full listing editor          │
            │ Title, desc, brand, price   │
            │ Keywords, category          │
            │ Platform reformatting       │
            │ Image reordering            │
            │ (If multi: item navigation) │
            └──────────┬──────────────────┘
                       ↓
            ┌─── STEP 4: ENHANCE (optional) ──┐
            │ Main image selector               │
            │ Fix blurry toggle                 │
            │ Remove background toggle          │
            │ Generate hero toggle              │
            │   → Hero preview sub-step         │
            │ "Skip" always available            │
            └──────────┬───────────────────────┘
                       ↓
            ┌─── STEP 5: SAVE & EXPORT ──┐
            │ Save to library             │
            │ Download ZIP                │
            │ Copy to clipboard           │
            │ Post to eBay/Vinted         │
            │ Share (native/WhatsApp)     │
            │ "Create Another" button     │
            └─────────────────────────────┘
```

### Dashboard Changes

**Before:**
- New Item button
- Photo Dump button
- Saved Items button
- Settings button
- Help button

**After:**
- **Create Listing** button (primary, replaces both New Item and Photo Dump)
- Saved Items button
- Settings button
- Help button

### Step Details

#### Step 1: Upload

Full-page view (not a slide-up sheet). Contains:

- Large drag/drop upload area (accepts 1 or many images)
- "Select Photos" button + camera option on mobile
- Uploaded images grid (thumbnails, remove button, index number)
- **Optional inputs below the grid:**
  - Item name/model hint (text input + voice)
  - Condition info (text input + voice)
  - Platform selector (Vinted/eBay/Gumtree)
- "Analyze Photos" button (enabled when >= 1 image uploaded)
- Wizard progress indicator at top showing Step 1 active

**Single image:** Same flow. AI just gets one image to work with.
**Many images:** Same flow. AI groups them in Step 2.

Client-side image compression runs on upload (existing code, works well).

#### Step 2: Analyze

- Comedy progress bar with rotating messages (reuse existing)
- Wizard progress shows Step 2 active
- API call: If 1 image, call `/api/generate` directly. If multiple, call `/api/photo-dump/group` then branch.

**Single item path:** AI returns listing directly → skip to Step 3 with listing populated.

**Multi-item path:** AI returns groups → show Step 2b.

#### Step 2b: Select Items (multi-item only)

- Grid of detected items with AI-generated titles
- Thumbnail from first photo in each group
- Photo count per item
- Checkbox selection (all selected by default)
- "Select All" / "Clear" buttons
- "Generate X Listings" button
- Info: "Unselected items saved as drafts"

After selection: generate listings for selected items, save unselected as drafts (images only, no credit used).

#### Step 3: Review & Edit

The same full editor regardless of how user got here. Fields:

- Title (with character counter)
- Brand
- Category
- Condition
- Description (with character counter)
- Price + RRP
- Keywords/tags
- Platform selector (reformat on change)
- Image gallery with reorder/delete

**If multiple items:** Navigation between items (prev/next or tabs). Current item number shown: "Item 1 of 3".

"Save Item" button per item → triggers Step 4 for that item.

#### Step 4: Enhance (optional)

Modal overlay. Shows after user clicks "Save Item" from Step 3.

- Main image selector (click thumbnail to set as primary)
- Enhancement toggles:
  - Fix Blurry Images (default on)
  - Remove Background (default off)
  - Generate Hero Image (default off)
- If hero selected: background style + lighting dropdowns
- "Skip" button (saves without enhancement)
- "Apply" button (applies enhancements then saves)

Hero sub-flow: Comedy progress → preview → accept/regenerate/reject.

**Note:** Enhancement backends are not yet implemented. For launch, this step should either be hidden or clearly marked as "coming soon". Do not show non-functional toggles.

#### Step 5: Save & Export

After enhancement (or skip), item is saved to DB. User sees:

- Success confirmation
- Export options:
  - Download ZIP (images + text file)
  - Copy All (formatted for platform)
  - Copy individual fields
  - Post to eBay (if connected)
  - Post to Vinted (bookmarklet)
  - Share (native share / WhatsApp / email)
- "Create Another" button → returns to Step 1
- "View Saved Items" button → navigates to Saved Items

If multiple items: after saving one item, auto-advance to next item's Step 3.

### What Gets Removed

- `photoDumpView` as a separate HTML view
- The input sheet slide-up pattern
- Duplicate upload/preview rendering code
- All wizard flow code we just added (CSS, JS, HTML modals) — will be rebuilt cleanly
- The `currentBundle`, `photoDumpAnalyzing` state properties that are unused
- `editPhotoDumpItem` stub function

### What Gets Kept

- Clerk auth (no changes)
- Marketing pages (no changes)
- Saved Items view (no changes)
- Settings view (no changes)
- Server-side API endpoints (`/api/generate`, `/api/photo-dump/group`, `/api/photo-dump/generate`, `/api/listings`)
- Client-side image compression (`compressImage()`)
- Comedy progress messages
- Platform formatting logic
- ZIP download logic
- Clipboard/share logic
- Image editor modal (crop/rotate)
- Barcode/label scanner

### CSS Approach

Remove all wizard-specific CSS added recently (480 lines in styles.css). Rebuild using existing design system variables and patterns. Key classes needed:

- `.wizard-container` — full-page wizard wrapper
- `.wizard-progress` — step indicator (rebuild cleanly)
- `.wizard-step-content` — content area for current step
- `.upload-grid` — responsive image thumbnail grid (fix the overlap issues)
- `.item-select-grid` — item selection cards
- `.listing-editor` — reuse existing output field patterns
- `.enhance-panel` — enhancement options

### State Structure

```javascript
state: {
  // Existing (keep)
  isAuthenticated, currentView, user, token, savedListings, etc.

  // Unified wizard state (replaces all wizard/photoDump/bundle state)
  wizard: {
    step: 'upload' | 'analyze' | 'select' | 'review' | 'enhance' | 'export',
    uploadedImages: [],           // Compressed image objects
    platform: 'vinted',          // Selected platform
    hint: '',                    // Item name hint
    condition: '',               // Condition info
    detectedItems: [],           // AI-grouped items (multi-item)
    selectedItemIds: new Set(),  // Which items to generate
    generatedListings: [],       // Generated listing objects
    currentListingIndex: 0,      // Which listing being edited
    enhancement: {
      mainImageIndex: 0,
      fixBlurry: true,
      removeBackground: false,
      generateHero: false,
      heroBackground: 'neutral',
      heroLighting: 'soft',
      heroPreview: null,
    },
  },
}
```

### Success Criteria

1. User can upload 1 photo and get a listing (same as today's New Item, but cleaner)
2. User can upload 20 photos and get multiple listings (same as today's Photo Dump, but working)
3. Both paths feel like the same product
4. No broken buttons, no stub functions, no "coming soon" toasts
5. Export works the same way regardless of entry path
6. CSS is clean — no overlapping thumbnails, consistent padding/spacing
7. Wizard progress indicator works and is accurate
8. Enhancement step is either functional or hidden (no fake toggles)
