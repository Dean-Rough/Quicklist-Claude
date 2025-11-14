# QuickList AI - Mobile-First Implementation Tasks

## Task Status Legend

- **pending**: Available for claiming
- **claimed**: Assigned to an agent
- **in_progress**: Currently being worked on
- **intervention_required**: Needs human input
- **completed**: Ready for review/merge

---

## Task 1: Bottom Tab Navigation Component

**Status**: claimed
**Priority**: HIGH
**Assigned to**: agent-bottom-nav
**Tmux session**: agent-bottom-nav
**Branch**: feature/mobile-bottom-nav

### Description

Implement mobile-first bottom tab navigation with 5 tabs: Scan (camera), Listings, Dashboard, Messages, Profile. Must be fixed to bottom on mobile, thumb-friendly (44x44px tap targets), with badge support and responsive breakpoints.

### Acceptance Criteria

- [ ] Bottom nav component created
- [ ] 5 tabs with icons and labels
- [ ] Active state styling
- [ ] Badge support for counts/notifications
- [ ] Responsive (bottom on mobile, adapt for tablet/desktop)
- [ ] ARIA labels for accessibility
- [ ] Smooth transitions

### Files to Create/Modify

- `public/components/mobile-nav.js` or similar
- CSS for mobile navigation
- Integration with main layout

---

## Task 2: Camera Interface Component

**Status**: claimed
**Priority**: HIGH
**Assigned to**: agent-camera
**Tmux session**: agent-camera
**Branch**: feature/mobile-camera

### Description

Create mobile-optimized camera interface using getUserMedia API with guided capture, real-time quality feedback (blur/lighting detection), batch photo mode, and thumbnail preview strip.

### Acceptance Criteria

- [ ] Camera component with getUserMedia
- [ ] Overlay guides for framing
- [ ] Real-time quality indicators (blur, lighting)
- [ ] Batch capture (multiple photos)
- [ ] Thumbnail strip with review/delete
- [ ] Front/rear camera flip
- [ ] Photo counter display
- [ ] Proper permission handling

### Files to Create/Modify

- `public/components/camera-capture.js`
- Camera utilities for quality detection
- Integration with listing creation flow

---

## Task 3: PWA Infrastructure

**Status**: claimed
**Priority**: HIGH
**Assigned to**: agent-pwa
**Tmux session**: agent-pwa
**Branch**: feature/pwa-setup

### Description

Implement Progressive Web App infrastructure: service worker, manifest.json, offline caching, background sync for drafts, and push notification setup.

### Acceptance Criteria

- [ ] Service worker created with install/activate handlers
- [ ] App shell caching strategy
- [ ] manifest.json with proper icons and config
- [ ] Offline photo storage (IndexedDB)
- [ ] Background sync for draft listings
- [ ] Sync status indicator UI
- [ ] Add to home screen prompt
- [ ] Push notification permission request

### Files to Create/Modify

- `service-worker.js`
- `manifest.json`
- Offline storage utilities
- Push notification handlers

---

## Task 4: Swipeable Listing Cards

**Status**: pending
**Priority**: MEDIUM
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/swipeable-cards

### Description

Create swipeable listing card component with touch gestures: swipe left for edit, swipe right for mark sold, tap for details, long press for action sheet.

### Acceptance Criteria

- [ ] Swipeable card component
- [ ] Touch gesture handlers (swipe, tap, long-press)
- [ ] Reveal actions on swipe with color coding
- [ ] Smooth animations (60fps)
- [ ] Action sheet modal for more options
- [ ] Haptic feedback integration
- [ ] Card layout with photo, title, price, platform badges

### Files to Create/Modify

- `public/components/listing-card.js`
- Touch gesture utilities
- Action sheet modal component
- CSS for swipe animations

---

## Task 5: Mobile Listing Creation Wizard

**Status**: pending
**Priority**: HIGH
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/mobile-wizard

### Description

Implement 4-step mobile listing creation wizard: (1) Photo capture, (2) AI processing with progress, (3) Review/edit with collapsible sections, (4) Publish with platform selection.

### Acceptance Criteria

- [ ] 4-step wizard component with progress indicator
- [ ] Step 1: Photo options (take/upload/barcode, recent drafts)
- [ ] Step 2: AI processing progress with real-time updates
- [ ] Step 3: Collapsible sections for review/edit
- [ ] Step 4: Platform toggles and pricing strategy
- [ ] Wizard navigation (back/next, validation)
- [ ] Draft auto-save functionality
- [ ] Mobile-optimized form controls

### Files to Create/Modify

- `public/components/listing-wizard.js`
- Wizard step components
- Collapsible section component
- Integration with existing AI processing

---

## Task 6: Mobile Image Optimization Pipeline

**Status**: pending
**Priority**: MEDIUM
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/image-optimization

### Description

Implement mobile-specific image optimization: resize to 1200px max, 85% compression, 200px thumbnails, WebP format, lazy loading with IntersectionObserver, and client-side processing.

### Acceptance Criteria

- [ ] Image resize utility (1200px max for mobile)
- [ ] Compression to 85% quality
- [ ] Thumbnail generation (200px)
- [ ] WebP conversion with fallbacks
- [ ] Lazy loading with IntersectionObserver
- [ ] Blur-up loading technique
- [ ] IndexedDB caching for processed images
- [ ] Quality analysis (blur, brightness detection)
- [ ] Batch processing support

### Files to Create/Modify

- `public/utils/image-optimizer.js`
- Lazy loading component/utility
- Image quality analyzer
- Cache management utilities

---

## Task 7: Mobile-First CSS Framework

**Status**: claimed
**Priority**: HIGH
**Assigned to**: agent-mobile-css
**Tmux session**: agent-mobile-css
**Branch**: feature/mobile-css

### Description

Create mobile-first CSS architecture with proper breakpoints, adaptive layouts, touch-optimized controls, dark mode support, and accessibility features.

### Acceptance Criteria

- [ ] Mobile-first base styles (16px font, full-width buttons)
- [ ] Responsive breakpoints (mobile/tablet/desktop/large)
- [ ] Adaptive component styles (nav, cards, forms, images)
- [ ] Min 44x44px touch targets
- [ ] Dark mode with CSS custom properties
- [ ] High contrast mode support
- [ ] Safe area insets for notched phones
- [ ] Prevent zoom on input focus (iOS)
- [ ] Touch-action and scroll-snap utilities

### Files to Create/Modify

- `public/styles/mobile.css` or CSS module system
- CSS custom properties for theming
- Responsive utility classes
- Component-specific mobile styles

---

## Task 8: Mobile-Specific Native Features

**Status**: pending
**Priority**: MEDIUM
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/mobile-native

### Description

Implement mobile-specific Web APIs: Share API, Geolocation, Web Speech for voice input, Vibration API for haptic feedback, and barcode scanner integration.

### Acceptance Criteria

- [ ] Web Share API integration with fallback
- [ ] Geolocation with reverse geocoding
- [ ] Voice input for descriptions (Web Speech API)
- [ ] Haptic feedback patterns (Vibration API)
- [ ] Barcode scanner (camera-based with QuaggaJS)
- [ ] Device detection utilities
- [ ] Feature detection and progressive enhancement
- [ ] Proper permission handling for all features

### Files to Create/Modify

- `public/utils/native-features.js`
- Share utility
- Geolocation utility
- Voice input component
- Haptic feedback utility
- Barcode scanner component

---

## Task 9: Collapsible Sections Component

**Status**: pending
**Priority**: MEDIUM
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/collapsible-sections

### Description

Create reusable collapsible section component for mobile forms and content, with smooth animations, tap to expand/collapse, and proper ARIA attributes.

### Acceptance Criteria

- [ ] Collapsible section component
- [ ] Smooth expand/collapse animations
- [ ] Mobile-friendly tap targets
- [ ] ARIA attributes for accessibility
- [ ] Support for icons and badges
- [ ] Character count preview when collapsed
- [ ] Nested collapsible support

### Files to Create/Modify

- `public/components/collapsible-section.js`
- CSS for animations
- Reusable across wizard and detail pages

---

## Task 10: Mobile Dashboard & Analytics

**Status**: pending
**Priority**: LOW
**Assigned to**: -
**Tmux session**: -
**Branch**: feature/mobile-dashboard

### Description

Create mobile-optimized dashboard with swipeable stat cards, revenue metrics, active listings count, pending messages, and quick action buttons.

### Acceptance Criteria

- [ ] Mobile dashboard layout
- [ ] Swipeable stat cards
- [ ] Revenue today/week/month cards
- [ ] Active listings widget
- [ ] Pending messages widget
- [ ] Quick action buttons
- [ ] Pull-to-refresh functionality
- [ ] Loading skeletons

### Files to Create/Modify

- `public/components/mobile-dashboard.js`
- Dashboard widgets
- Stat card components
- Integration with existing analytics

---

## Task 11: Server Modularization & Type Safety

**Status**: pending
**Priority**: MEDIUM
**Assigned to**: -
**Branch**: feature/server-modules

### Description

Break the 5k-line `server.js` monolith into focused modules (auth, listings, images, AI generation, marketplace integrations). Introduce lightweight typing (JSDoc or TypeScript) for request/response shapes to make auditing and regression testing easier.

### Acceptance Criteria

- [ ] Extract routers/controllers per domain
- [ ] Shared middleware/helpers moved to `/lib` or `/utils`
- [ ] Type definitions for key payloads (generation request, listing rows, Cloudinary responses)
- [ ] Existing endpoints continue to work (smoke tests)
- [ ] Lint/test suite updated to cover new structure

### Files to Create/Modify

- `server.js` (split into multiple modules)
- New `/routes` or `/controllers` directory
- Shared typing utilities

---

## Task 12: Auth & CSP Hardening

**Status**: pending
**Priority**: HIGH
**Assigned to**: -
**Branch**: feature/auth-hardening

### Description

Reduce exposure of API tokens and tighten client security. Move off `localStorage` for auth tokens (use Clerk session cookies) and restore a strict Content Security Policy without `'unsafe-inline'/'unsafe-eval'`. Add automated e2e tests to ensure login/logout flows still work.

### Acceptance Criteria

- [ ] Clerk configured to issue HttpOnly cookies; SPA updated to rely on `getToken()` only when needed
- [ ] CSP meta tag re-enabled with explicit `script-src`/`style-src` allowlists
- [ ] Inline event handlers removed/replaced with bound listeners
- [ ] Regression tests confirm listing creation still works after CSP/token changes

### Files to Create/Modify

- `index.html` (CSP + client auth handling)
- Auth utilities
- New test specs

---

## Notes

- All tasks should follow mobile-first design principles
- Use the existing codebase structure (appears to be vanilla JS in public/)
- Test on real mobile devices (iOS Safari, Android Chrome)
- Ensure 44x44px minimum touch targets
- Implement proper error handling and loading states
- Add appropriate analytics tracking
- Update main index.html to integrate new components

## Dependencies

- Task 5 (Wizard) depends on Task 2 (Camera)
- Task 4 (Swipeable Cards) benefits from Task 8 (Haptic feedback)
- Task 7 (CSS) should be done early as foundation for others
