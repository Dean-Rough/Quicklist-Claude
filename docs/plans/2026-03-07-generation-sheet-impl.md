# Generation Sheet — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the always-visible two-panel input form with a slide-up sheet, a full-viewport comedy loading screen, and a clean result view that appears after generation.

**Architecture:** The `input-panels-container` HTML block is moved into a new `#inputSheet` fixed element. A `#sheetBackdrop` overlay sits behind it. The `generated-listing-container` becomes the default full-screen view. JS methods `openInputSheet()` / `closeInputSheet()` drive all transitions. Comedy cycling text replaces the progress-step list inside `loadingState`.

**Tech Stack:** Vanilla JS, CSS transitions (no libraries), existing Express/Clerk/Gemini backend untouched.

---

### Task 1: Add sheet + backdrop HTML to `index.html`

**Files:**
- Modify: `index.html` (around line 808 — start of `#newItemView`)

**What to do:**

Inside `#newItemView`, immediately after the opening `<div id="newItemView">` tag, add the sheet backdrop and the input sheet wrapper. Move the entire `<div class="input-panels-container">` block (lines ~812–1001) **inside** the new `#inputSheet` div. Do NOT delete it — just relocate it.

Add this structure around it:

```html
<!-- Sheet backdrop -->
<div id="sheetBackdrop" onclick="app.closeInputSheet(true)"></div>

<!-- Input sheet -->
<div id="inputSheet">
  <div class="sheet-header">
    <span class="sheet-title">New Listing</span>
    <button class="sheet-close-btn" type="button" onclick="app.closeInputSheet(true)" aria-label="Close">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="sheet-body">
    <!-- EXISTING input-panels-container goes here -->
    <div class="input-panels-container">
      ... (existing content, unchanged)
    </div>
  </div>
</div>
```

**After the sheet, also add the FAB button** (inside `#newItemView`, outside the sheet):

```html
<!-- FAB: open new listing sheet -->
<button id="newListingFab" class="new-listing-fab" type="button" onclick="app.openInputSheet()" aria-label="New listing">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
</button>
```

**Verify:** Page still renders (no JS errors). Input form is now invisible by default (sheet is closed). FAB is visible.

**Commit:**
```bash
git add index.html
git commit -m "refactor(sheet): move input panels into slide-up sheet HTML"
```

---

### Task 2: Add sheet + FAB CSS to `public/css/styles.css`

**Files:**
- Modify: `public/css/styles.css` (append to end, before any final `@media` blocks)

Add these rules:

```css
/* ============================================
   INPUT SHEET
   ============================================ */

#sheetBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease;
}

#sheetBackdrop.open {
  opacity: 1;
  pointer-events: auto;
}

#inputSheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 88dvh;
  background: var(--bg-primary);
  border-radius: 20px 20px 0 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 300ms ease-out;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.25);
}

#inputSheet.open {
  transform: translateY(0);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sheet-title {
  font-weight: 700;
  font-size: 1.1rem;
}

.sheet-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  border-radius: 6px;
}

.sheet-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sheet-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  /* Remove padding from panels-container when inside sheet */
}

.sheet-body .input-panels-container {
  padding: 1rem 1.5rem 2rem;
}

/* ============================================
   NEW LISTING FAB
   ============================================ */

.new-listing-fab {
  position: fixed;
  bottom: 28px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-indigo);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 998;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.new-listing-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.new-listing-fab:active {
  transform: scale(0.96);
}

/* Hide FAB when sheet is open */
.new-listing-fab.hidden {
  display: none;
}

/* ============================================
   COMEDY LOADING SCREEN
   ============================================ */

.comedy-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 2rem;
}

.comedy-loading-text {
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 2rem;
  min-height: 3em;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comedy-loading-text span {
  transition: opacity 400ms ease;
}

.comedy-loading-text span.fade-out {
  opacity: 0;
}

.comedy-loading-text span.fade-in {
  opacity: 1;
}

.comedy-progress-bar {
  width: min(320px, 80vw);
  height: 3px;
  background: var(--bg-tertiary);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 2.5rem;
}

.comedy-progress-bar-fill {
  height: 100%;
  background: var(--accent-indigo);
  border-radius: 99px;
  width: 0%;
  animation: comedyProgress 28s linear forwards;
}

@keyframes comedyProgress {
  0%   { width: 0% }
  40%  { width: 55% }
  70%  { width: 75% }
  90%  { width: 88% }
  100% { width: 93% }
}

/* ============================================
   RESULT HEADER — Re-generate button
   ============================================ */

.regenerate-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}
```

Also **update** `.generated-listing-container` so it fills the screen properly when the input panels are gone:

```css
.generated-listing-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 2rem 6rem 2rem; /* extra bottom for FAB clearance */
}
```

**Verify:** No visual change yet (sheet still hidden). FAB not visible because JS hasn't opened it.

**Commit:**
```bash
git add public/css/styles.css
git commit -m "feat(sheet): add sheet, FAB, and comedy loading CSS"
```

---

### Task 3: Add `openInputSheet()` and `closeInputSheet()` to `public/js/app.js`

**Files:**
- Modify: `public/js/app.js` (add methods near `showInitialState`, around line 2288)

Add these two methods after `showInitialState()`:

```javascript
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
```

**Verify manually:** Open browser, click FAB → sheet slides up. Click × or backdrop → sheet slides down.

**Commit:**
```bash
git add public/js/app.js
git commit -m "feat(sheet): add openInputSheet / closeInputSheet methods"
```

---

### Task 4: Close sheet when Generate is hit; replace loading screen with comedy text

**Files:**
- Modify: `public/js/app.js`
  - `generateListing()` around line 2008 — add `this.closeInputSheet()` at the start
  - `animateProgressSteps()` around line 2674 — replace with comedy cycler
  - `showInitialState()` around line 2230 — clear comedy cycler interval
  - `cancelGeneration()` — already calls `showInitialState()`, no change needed

**Step 1: In `generateListing()`, close the sheet before showing loading**

Find the block that starts loading (around line 2014):
```javascript
// Show loading state
initialState.classList.add('hidden');
resultState.classList.add('hidden');
loadingState.classList.remove('hidden');
```

Add `this.closeInputSheet();` immediately before that block:
```javascript
// Close input sheet
this.closeInputSheet();

// Show loading state
initialState.classList.add('hidden');
...
```

**Step 2: Replace `animateProgressSteps()` with `startComedyCycler()`**

Delete the entire `animateProgressSteps()` method and replace with:

```javascript
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

  // Show cancel after 4s
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
```

**Step 3: Replace `this.animateProgressSteps()` call in `generateListing()`**

Find: `this.animateProgressSteps();`
Replace with: `this.startComedyCycler();`

**Step 4: Call `clearComedyCycler()` in `showInitialState()`**

In `showInitialState()`, after clearing progress timeouts, add:
```javascript
this.clearComedyCycler();
```

Also replace the `loadingState.innerHTML` reset block in `showInitialState()` — it currently rebuilds the progress steps HTML. Change it to reset to a blank state:

```javascript
loadingState.innerHTML = '';
```

(The comedy cycler rebuilds it fresh each time generation starts.)

**Verify:** Click FAB → sheet opens. Upload image, hit Generate → sheet closes, comedy text appears and cycles. Cancel → returns to empty result.

**Commit:**
```bash
git add public/js/app.js
git commit -m "feat(sheet): close sheet on generate, comedy loading screen"
```

---

### Task 5: Add "Re-generate" button to result header; wire to `openInputSheet()`

**Files:**
- Modify: `index.html` (result header around line 1089)
- Modify: `public/js/app.js` — `loadListing()` to ensure sheet stays closed

**Step 1: Add Re-generate button in `index.html`**

Find the output-actions div (around line 1089):
```html
<div class="output-actions" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap">
```

Add as the first button inside it:
```html
<button class="btn btn-secondary btn-small regenerate-btn" type="button" onclick="app.openInputSheet()">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  Re-generate
</button>
```

**Step 2: Ensure `loadListing()` never opens the sheet**

`loadListing()` (around line 5110) already calls `this.navigateToApp('newItem')` and then `this.displayListing()`. No change needed — the sheet starts closed. Verify `openInputSheet()` is NOT called anywhere in `loadListing()`.

**Step 3: Pre-fill sheet inputs when Re-generate is clicked**

The sheet already contains the original form inputs (`#itemHint`, `#conditionInfo`, `#platformSelectInput`, `#personalitySelect`). They retain their values naturally — no extra work needed.

**Verify:** After generation, result shows "Re-generate" button. Click it → sheet slides up with previous values intact. Close without generating → sheet closes, result still visible.

**Commit:**
```bash
git add index.html public/js/app.js
git commit -m "feat(sheet): add Re-generate button to result header"
```

---

### Task 6: Hide FAB when result is showing; show FAB on empty state

**Files:**
- Modify: `public/js/app.js`
  - `showInitialState()` — show FAB
  - After result shown in `generateListing()` — hide FAB
  - `loadListing()` — hide FAB (result is showing)

The FAB should be **visible** when no listing is generated (idle/empty state) and **hidden** when result is visible (Re-generate button serves that role instead).

In `showInitialState()`, add at the end:
```javascript
const fab = document.getElementById('newListingFab');
if (fab) fab.classList.remove('hidden');
```

After the result is revealed in `generateListing()` (after `resultState.classList.remove('hidden')`):
```javascript
const fab = document.getElementById('newListingFab');
if (fab) fab.classList.add('hidden');
```

In `loadListing()`, after `this.displayListing(listing)`:
```javascript
const fab = document.getElementById('newListingFab');
if (fab) fab.classList.add('hidden');
```

**Verify:** On fresh load → FAB visible. Generate listing → FAB disappears, Re-generate appears. Open saved item → FAB hidden.

**Commit:**
```bash
git add public/js/app.js
git commit -m "feat(sheet): hide FAB when result visible"
```

---

### Task 7: Sync `public/` and push

**Files:**
- `public/index.html` — copy from `index.html`
- `public/css/styles.css` — already edited in place (it IS the public file)
- `public/js/app.js` — already edited in place

```bash
cp index.html public/index.html
git add public/index.html
git commit -m "chore: sync public/index.html"
git push origin main
```

**Verify on Vercel:** Open the deployed URL. New Listing view shows empty result area + FAB. FAB opens sheet. Generate → comedy text → result. Saved items open directly to result.

---

## What Is NOT Changed
- All Gemini/eBay/Stripe API logic
- Auth flow
- Saved items view
- Settings / profile views
- Any backend (`server.js`, `api/`, `middleware/`)
