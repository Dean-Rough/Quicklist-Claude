# Unified Listing Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken dual-path listing creation (New Item + Photo Dump) with one unified wizard flow that handles 1 or many photos intelligently.

**Architecture:** Rebuild the `newItemView` in index.html as a step-based wizard. Remove `photoDumpView` entirely. Merge both JS code paths into one `wizard.*` state object in app.js. Rewrite wizard CSS from scratch, removing the broken classes.

**Tech Stack:** Vanilla JS (no framework), HTML/CSS in index.html + public/css/styles.css + public/js/app.js, Express.js backend (no changes needed).

**Testing:** No test framework configured. Each task ends with manual browser verification steps. Run `npm run dev` (port 4577) and test in browser.

**Key constraint:** This is a single-file SPA. `index.html` is the source of truth. After changes, run `cp index.html public/index.html` to sync.

---

## Task 1: Clean Up — Remove Broken Wizard Code

Remove all the non-functional wizard code added in the previous session. This gives us a clean slate.

**Files:**
- Modify: `public/css/styles.css` — remove lines ~4547-5025 (wizard flow CSS block added previously)
- Modify: `public/js/app.js` — remove lines ~248-653 (WIZARD FLOW FUNCTIONS block), remove wizard state properties from state object (lines ~58-101)
- Modify: `index.html` — remove the three new modals (itemSelectionModal, imageEnhancementModal, heroPreviewModal ~lines 3163-3358), remove photoDumpWizardProgress indicator (~lines 1847-1893)

**Step 1:** In `styles.css`, delete the second `.wizard-progress` block and everything after it that was added (from line 4547 to ~5025). Keep the first `.wizard-progress` block around line 2791.

**Step 2:** In `app.js`, delete the `// WIZARD FLOW FUNCTIONS` section (from `updateWizardProgress` through `acceptHeroPreview`). Also remove these state properties: `wizardProgress`, `currentBundle`, `photoDumpAnalyzing`, `imageEnhancement`, `itemSelection`, `photoDumpImages`.

**Step 3:** In `index.html`, delete the three modals: `itemSelectionModal`, `imageEnhancementModal`, `heroPreviewModal`. Delete the `photoDumpWizardProgress` div.

**Step 4:** In `app.js`, revert `startPhotoDumpAnalysis` to show the groups step directly (remove the smart branching that calls `openItemSelectionModal`). Revert `savePhotoDumpItem` to save directly (remove the enhancement modal detour).

**Step 5:** Run `npm run lint` to verify no syntax errors.

**Step 6:** Commit: `git commit -m "Remove broken wizard code — clean slate for unified flow"`

**Verify:** App loads without JS errors. New Item flow works as before. Photo Dump view still exists but uses original simple flow.

---

## Task 2: Merge Dashboard Buttons + Create Wizard View Shell

Replace the two creation buttons with one. Create the new wizard view HTML structure.

**Files:**
- Modify: `index.html` — dashboard buttons, add new `createListingView`, remove `photoDumpView`
- Modify: `public/js/app.js` — update `switchAppView` to handle new view name

**Step 1:** In `index.html` dashboard grid, replace the "New Item" and "Photo Dump" buttons with a single "Create Listing" button:

```html
<button class="dashboard-action-btn card" onclick="app.navigateToApp('createListing')">
  <div class="dashboard-icon-wrapper" style="background: var(--accent-indigo, #6366f1); color: white;">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  </div>
  <h2>Create Listing</h2>
  <p>Upload photos and let AI generate your listing.</p>
</button>
```

**Step 2:** In `index.html`, add a new `createListingView` div (after dashboardView, replacing both newItemView and photoDumpView). Structure:

```html
<div id="createListingView" class="hidden">
  <div class="container section" style="padding-top: 1rem;">
    <!-- Back button + title -->
    <div class="wizard-header">
      <button class="btn btn-secondary" onclick="app.navigateToApp('dashboard')">
        <svg><!-- back arrow --></svg>
      </button>
      <h1 class="section-title" style="margin: 0;">Create Listing</h1>
    </div>

    <!-- Wizard progress indicator -->
    <div class="wizard-progress" id="wizardProgress">
      <!-- 4 steps: Upload, Generate, Edit, Export -->
    </div>

    <!-- Step containers (shown/hidden by JS) -->
    <div id="wizardStep-upload"><!-- Step 1 content --></div>
    <div id="wizardStep-analyze" class="hidden"><!-- Step 2 --></div>
    <div id="wizardStep-select" class="hidden"><!-- Step 2b --></div>
    <div id="wizardStep-review" class="hidden"><!-- Step 3 --></div>
    <div id="wizardStep-export" class="hidden"><!-- Step 5 --></div>
  </div>
</div>
```

**Step 3:** In `app.js` `switchAppView`, add `'createListing'` to the views array. Add init call:

```javascript
} else if (view === 'createListing') {
  this.initWizard();
}
```

**Step 4:** Add minimal `initWizard()` stub to app.js that just logs "wizard init".

**Step 5:** Delete the `photoDumpView` div from index.html. Remove `'photoDump'` from `switchAppView` views array.

**Step 6:** Update any slide nav links that reference `newItem` or `photoDump` to reference `createListing`.

**Step 7:** Commit: `git commit -m "Replace New Item + Photo Dump with unified Create Listing view shell"`

**Verify:** Dashboard shows single "Create Listing" button. Clicking it shows empty wizard view. No JS errors. Old New Item and Photo Dump buttons are gone.

---

## Task 3: Build Step 1 — Upload

Build the upload step with image grid, optional hints, and the analyze button.

**Files:**
- Modify: `index.html` — populate `wizardStep-upload` content
- Modify: `public/css/styles.css` — wizard upload styles
- Modify: `public/js/app.js` — wizard state, upload handling, image grid rendering

**Step 1:** Add wizard state to `app.state`:

```javascript
wizard: {
  step: 'upload',
  uploadedImages: [],
  platform: 'vinted',
  hint: '',
  condition: '',
  detectedItems: [],
  selectedItemIds: new Set(),
  generatedListings: [],
  currentListingIndex: 0,
},
```

**Step 2:** Build the upload step HTML in `wizardStep-upload`:
- Drag/drop upload area (reuse existing `.image-uploader` pattern)
- File input (accept="image/*" multiple)
- Uploaded images grid (use `.uploaded-images-grid` class — fix the CSS)
- Optional inputs: item hint, condition, platform selector
- "Analyze Photos" button (disabled until images uploaded)

**Step 3:** Write `initWizard()` — reset wizard state, show upload step, hide others.

**Step 4:** Write `handleWizardUpload(files)` — reuse existing `compressImage()` logic. Store compressed images in `wizard.uploadedImages`. Render grid.

**Step 5:** Write `renderWizardImageGrid()` — thumbnails with remove button, index numbers. Fix the CSS: use `object-fit: cover`, fixed `aspect-ratio: 1`, proper grid gap with no overlaps.

**Step 6:** Write `removeWizardImage(id)` — remove from state, revoke URL, re-render.

**Step 7:** Write `updateAnalyzeButton()` — enable/disable based on image count.

**Step 8:** CSS in styles.css — clean wizard upload grid styles. Fix the thumbnail overlap issue by ensuring:
```css
.wizard-upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}
.wizard-upload-grid img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

**Step 9:** Commit: `git commit -m "Build wizard Step 1: Upload with image grid and optional hints"`

**Verify:** Navigate to Create Listing. Upload 1-5 images. Thumbnails display correctly with no overlaps. Remove button works. Hint/condition/platform inputs work. Analyze button enables when images present.

---

## Task 4: Build Step 2 — Analyze + Smart Branching

The analyze step calls the API and branches based on result count.

**Files:**
- Modify: `index.html` — populate `wizardStep-analyze` content
- Modify: `public/js/app.js` — analysis logic, API calls, branching

**Step 1:** Build analyze step HTML — comedy progress bar, status text, cancel button.

**Step 2:** Write `startWizardAnalysis()`:
- Show analyze step, hide upload step
- Update wizard progress to step 2
- Convert images to base64
- **If 1-2 images:** Call `/api/generate` directly (single item path)
- **If 3+ images:** Call `/api/photo-dump/group` (multi-item path)

**Step 3:** Handle single-item response:
- Store listing in `wizard.generatedListings[0]`
- Skip select step, go directly to review step
- Call `showWizardStep('review')`

**Step 4:** Handle multi-item response:
- Store groups in `wizard.detectedItems`
- Show select step
- Call `showWizardStep('select')`

**Step 5:** Write `showWizardStep(step)` — hides all step divs, shows the target one, updates wizard progress indicator.

**Step 6:** Error handling — on API failure, show toast, return to upload step.

**Step 7:** Commit: `git commit -m "Build wizard Step 2: Analyze with smart single/multi branching"`

**Verify:** Upload 1 image → click Analyze → see progress → listing generated → jumps to review. Upload 5+ images → click Analyze → see progress → shows select step.

---

## Task 5: Build Step 2b — Item Selection (Multi-Item Only)

**Files:**
- Modify: `index.html` — populate `wizardStep-select` content
- Modify: `public/css/styles.css` — item card grid styles
- Modify: `public/js/app.js` — selection logic, generate selected

**Step 1:** Build select step HTML — heading with item count, grid container, action buttons (Select All, Clear, Generate X Listings).

**Step 2:** Write `renderItemSelection()` — render item cards from `wizard.detectedItems`. Each card: thumbnail, AI title, photo count, checkbox visual.

**Step 3:** Write `toggleWizardItemSelection(idx)` — toggle in `wizard.selectedItemIds` Set, update card UI, update button count.

**Step 4:** Write `selectAllWizardItems()` and `deselectAllWizardItems()`.

**Step 5:** Write `generateSelectedWizardItems()`:
- Get selected groups
- Call `/api/photo-dump/generate` with selected groups
- Store results in `wizard.generatedListings`
- Show review step

**Step 6:** CSS — clean item card grid. Consistent card sizing, proper selected state with indigo border, no overlap.

**Step 7:** Commit: `git commit -m "Build wizard Step 2b: Item selection for multi-item flow"`

**Verify:** Upload 5+ images → Analyze → see item cards → select/deselect works → generate selected → moves to review.

---

## Task 6: Build Step 3 — Review & Edit

Reuse the existing listing editor pattern from the old New Item flow.

**Files:**
- Modify: `index.html` — populate `wizardStep-review` content
- Modify: `public/js/app.js` — populate editor, handle edits, multi-item navigation

**Step 1:** Build review step HTML. Reuse the existing output field pattern (outputTitle, outputBrand, outputCategory, outputCondition, outputDescription, outputPrice, outputRRP, outputKeywords). Add item navigation for multi-item: "Item 1 of 3" with prev/next buttons.

**Step 2:** Write `showWizardReview()` — populate all fields from `wizard.generatedListings[wizard.currentListingIndex]`. Show image thumbnails.

**Step 3:** Write `wizardPrevItem()` / `wizardNextItem()` — save current field values back to state, change index, re-populate.

**Step 4:** Write `saveWizardItem()` — collect field values, POST to `/api/listings`, show success, advance to export step (or next item if multi).

**Step 5:** Platform selector — allow switching platform, reformat listing on change (reuse `applyPlatformFormat`).

**Step 6:** Commit: `git commit -m "Build wizard Step 3: Review and edit with multi-item navigation"`

**Verify:** Single item: fields populated, editable, save works. Multi-item: prev/next navigation works, each item has its own fields, save works for each.

---

## Task 7: Build Step 5 — Save & Export

Skip Step 4 (Enhance) for launch — backends not implemented. Go directly from review to export.

**Files:**
- Modify: `index.html` — populate `wizardStep-export` content
- Modify: `public/js/app.js` — export logic, reuse existing download/copy/share functions

**Step 1:** Build export step HTML — success message, export button grid:
- Download ZIP
- Copy All
- Copy Title / Description / Price / Keywords
- Post to eBay (if platform = ebay)
- Post to Vinted (if platform = vinted)
- Share (native/WhatsApp/email)
- "Create Another" button → `initWizard()`
- "View Saved Items" button → `navigateToApp('savedItems')`

**Step 2:** Wire up export buttons to existing functions: `downloadZip()`, `copyAll()`, `shareNative()`, `postToEbay()`, `openVintedAutofill()`.

**Step 3:** If multi-item and more items to review: show "Next Item" button that goes back to review for next item.

**Step 4:** Commit: `git commit -m "Build wizard Step 5: Save and export with all existing export options"`

**Verify:** After saving a listing, export step shows. Download ZIP works. Copy works. Create Another resets wizard. View Saved Items navigates correctly.

---

## Task 8: Remove Old Views + Final Cleanup

Remove the old `newItemView` code paths and clean up dead code.

**Files:**
- Modify: `index.html` — remove `newItemView` HTML (the input sheet, result state, etc.)
- Modify: `public/js/app.js` — remove old `generateListing()`, `openInputSheet()`, `closeInputSheet()`, `showInitialState()` and related functions. Keep utility functions (compressImage, fileToBase64, etc.)
- Modify: `public/css/styles.css` — remove input sheet styles, dead wizard CSS

**Step 1:** Remove `newItemView` div and all its children from index.html (the sheet backdrop, input sheet, initial state, loading state, result state).

**Step 2:** Remove old Photo Dump functions from app.js: `initPhotoDump`, `handlePhotoDumpUpload`, `startPhotoDumpAnalysis`, `renderPhotoDumpGroups`, `generatePhotoDumpListings`, `renderPhotoDumpResults`, `savePhotoDumpItem`, `finalizePhotoDumpItemSave`, `saveAllPhotoDumpListings`, `startNewPhotoDump`, `clearPhotoDump`, `removePhotoDumpImage`, `renderPhotoDumpPreview`.

**Step 3:** Remove old New Item functions that are fully replaced: `openInputSheet`, `closeInputSheet`, `showInitialState`, old `setWizardPhase`. Keep `generateListing` internals (API call logic) — refactor into the wizard flow.

**Step 4:** Remove dead CSS (input sheet styles, old photo dump grid styles).

**Step 5:** Run `npm run lint` — fix any issues.

**Step 6:** `cp index.html public/index.html` to sync.

**Step 7:** Commit: `git commit -m "Remove old New Item and Photo Dump code — unified flow complete"`

**Verify:** Full flow works: Dashboard → Create Listing → Upload → Analyze → (Select if multi) → Review/Edit → Save → Export. No console errors. No dead buttons. Saved Items still works. Settings still works.

---

## Task 9: CSS Polish Pass

Fix spacing, padding, and visual consistency across the wizard.

**Files:**
- Modify: `public/css/styles.css`

**Step 1:** Audit all wizard steps for consistent padding (use `1.5rem` everywhere).

**Step 2:** Ensure wizard progress indicator matches the site's design language (use existing CSS variables: `--accent-indigo`, `--bg-secondary`, `--border-color`, `--radius-bento`).

**Step 3:** Ensure mobile responsiveness — test at 375px, 768px, 1024px widths.

**Step 4:** Ensure image grid thumbnails never overlap — verify `gap`, `grid-template-columns`, and `aspect-ratio` are all correct.

**Step 5:** Commit: `git commit -m "Polish wizard CSS for consistent spacing and mobile responsiveness"`

**Verify:** Test on mobile viewport (375px). Test on tablet (768px). Test on desktop. No overlaps, consistent spacing, readable text, tappable buttons.

---

## Task 10: Smoke Test Full Flow + Deploy

**Step 1:** Test single-image flow end-to-end: Upload 1 photo → Analyze → Review → Save → Export → Create Another.

**Step 2:** Test multi-image flow: Upload 5+ photos → Analyze → Select items → Generate → Review each → Save each → Export.

**Step 3:** Test edge cases: Upload then remove all images. Cancel during analysis. Navigate away and back.

**Step 4:** Test Saved Items still loads and displays correctly.

**Step 5:** Test Settings page still works.

**Step 6:** `cp index.html public/index.html` final sync.

**Step 7:** Commit any fixes.

**Step 8:** Push to production: `git push origin main`

**Verify:** Production site works. No console errors. Both single and multi-item flows complete successfully.
