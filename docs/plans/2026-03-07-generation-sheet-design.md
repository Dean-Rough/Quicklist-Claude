# Generation Flow Redesign — Slide-up Input Sheet

**Date:** 2026-03-07
**Status:** Approved

## Overview

Replace the always-visible two-panel input layout with a slide-up sheet. The result view owns the full screen at all times. Input is summoned on demand, used once, then dismissed. Loading gets a full-viewport comedy cycling text treatment.

---

## States

### 1. Idle
- Result area fills the screen showing an empty-state placeholder
- FAB button (`+`) bottom-right (mobile) / "New Listing" button top-right (desktop) opens the sheet
- If a listing is already loaded (e.g. navigated back from saved items), result stays visible

### 2. Sheet Open
- Sheet slides up from bottom, covering ~85vh
- Backdrop (rgba dark overlay) fades in over result area
- Sheet contains: image uploader, item hint, condition info, platform select, listing style select, Generate button
- × button top-right dismisses without generating
- Tapping backdrop dismisses (with confirm if images are loaded)
- Sheet content scrolls internally

### 3. Loading
- Generate button hit: sheet animates closed (translateY 100%), backdrop fades out
- Full-viewport loading state appears immediately
- Comedy cycling text, centred, h2-size, crossfades every 2.5s
- Thin animated progress bar underneath text
- Cancel button (appears after 3s)
- Replaces existing step-by-step progress list entirely

### 4. Result
- Loading fades out, result fills screen
- Header contains small "Re-generate" button (pencil icon) that re-opens sheet pre-filled with last inputs
- Platform switcher, copy, save, share actions as now

### Saved Item Flow
- `loadListing()` goes directly to state 4, skipping the sheet
- "Re-generate" in the header opens the sheet if user wants to re-run

---

## Comedy Loading Messages

Cycle through these at 2.5s per message with a CSS crossfade:

1. "Squinting at your photos..."
2. "Checking what it's going for on eBay..."
3. "Running the numbers..."
4. "Polishing the description..."
5. "Wiping the marks off..."
6. "Arguing with the pricing algorithm..."
7. "Adding a sprinkle of charm..."
8. "Nearly there, just buffing it up..."

---

## Sheet Behaviour

- **Animation:** `transform: translateY(100%)` to `translateY(0)`, 300ms ease-out. Backdrop opacity 0 to 0.5 simultaneously.
- **Dismiss animation:** reverse — translateY(100%), 250ms ease-in
- **Scroll:** sheet body scrolls internally with `-webkit-overflow-scrolling: touch`
- **Mobile keyboard:** sheet uses `max-height: 85dvh` so it shrinks when keyboard is present
- **Re-open:** sheet slides back up pre-populated with last platform/style/hint. Images remain in state.
- **Discard confirm:** if `uploadedImages.length > 0` and user dismisses, show confirm dialog before clearing

---

## Implementation Scope

### HTML (`index.html`)
- Remove `input-panels-container` from its current position in `newItemView`
- Add `#inputSheet` div: fixed bottom, full-width, `z-index: 1000`, `border-radius: 20px 20px 0 0`
- Add `#sheetBackdrop` div: fixed full-screen, `z-index: 999`, `background: rgba(0,0,0,0.5)`, hidden by default
- Add FAB `#newListingFab` button: fixed bottom-right
- Replace `#loadingState` content with single comedy-text div + progress bar
- Add `Re-generate` button to result header

### CSS (`public/css/styles.css`)
- `.input-sheet`: fixed, bottom 0, width 100%, max-height 85dvh, border-radius top, overflow hidden, transform translateY(100%), transition 300ms ease-out, z-index 1000
- `.input-sheet.open`: transform translateY(0)
- `.sheet-backdrop`: fixed, inset 0, z-index 999, background rgba dark, opacity 0, pointer-events none, transition opacity 300ms
- `.sheet-backdrop.open`: opacity 1, pointer-events auto
- `.new-listing-fab`: fixed, bottom 24px, right 24px, width 56px, height 56px, border-radius 50%, z-index 998
- `.comedy-text`: large centred text, fade animation
- `.generation-progress-bar`: thin bar, animated width or shimmer

### JS (`public/js/app.js`)
- `openInputSheet()`: add `.open` to sheet and backdrop, trap focus
- `closeInputSheet(confirm)`: remove `.open`, optionally confirm if images loaded
- `startGeneration()`: call `closeInputSheet()` then existing generate logic
- `showLoadingScreen()`: replace progress steps with comedy text cycler (`setInterval` 2500ms, CSS transition)
- `clearCycler()`: clear interval on generation complete/cancel
- `loadListing()`: skip sheet, go straight to result state, no change to sheet
- FAB click → `openInputSheet()`
- Re-generate button → `openInputSheet()` pre-filled

---

## What Does NOT Change

- All existing generate API logic (`callGeminiAPI`, `generateListing`, etc.)
- Result display (`displayListing`, output fields, platform switcher)
- Save / copy / share / eBay post actions
- Saved items view
- Auth flow
