# Post-Auth UI Fixes — UI/UX Pro Max Audit

**Date:** 2026-02-12
**Target:** Dashboard/App interface (post-login)

## Current Issues Identified

### 1. Font Inconsistency 🔴
- CSS @font-face declares `Maison` and `Maison Mono`
- Body actually uses `Manrope` (Google Fonts)
- Some components reference both
- **Fix:** Standardize on ONE font family

### 2. Typography Chaos 🔴
- Multiple font-size declarations (0.85rem, 0.875rem, 0.9rem, 0.95rem, 1rem)
- Inconsistent weights (400, 500, 600, 700, 800)
- **Fix:** Establish type scale

### 3. Spacing Inconsistency 🟡
- Mix of inline styles and CSS variables
- Inconsistent margins/padding
- **Fix:** Use spacing scale exclusively

### 4. Color System 🟡
- Old coral palette mixed with new dark theme
- Multiple fallback values
- **Fix:** Remove legacy color references

---

## Design System Cleanup

### Typography Scale (Manrope only)
```css
/* Remove Maison @font-face declarations */
/* Standardize on Manrope */

--font-body: 'Manrope', system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', 'SF Mono', monospace;

/* Type Scale */
--text-xs: 0.75rem;    /* 12px - captions */
--text-sm: 0.875rem;   /* 14px - labels, small text */
--text-base: 1rem;     /* 16px - body */
--text-lg: 1.125rem;   /* 18px - emphasized body */
--text-xl: 1.25rem;    /* 20px - section headers */
--text-2xl: 1.5rem;    /* 24px - card titles */
--text-3xl: 2rem;      /* 32px - page titles */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Form Components (Dashboard)
```css
.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.form-input {
  font-family: var(--font-body);
  font-size: var(--text-base);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-color);
  background: var(--bg-tertiary);
}

.form-input:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-light);
}
```

### Button Consistency
```css
.btn {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
}

.btn-small {
  font-size: var(--text-xs);
  padding: 0.5rem 1rem;
}
```

---

## Mobile-Specific Fixes

### iOS Scroll Issue
```css
/* Already in CSS but may need reinforcement */
html, body {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
  height: 100%;
}

/* Remove any position:fixed that might trap scroll */
#appView {
  position: relative; /* NOT fixed */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

### Mobile Grid
```css
@media (max-width: 768px) {
  .input-panels-container {
    flex-direction: column;
    gap: 1rem;
  }
  
  .bento-cell {
    padding: 1rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
}
```

---

## Implementation Priority

1. **Fix font declarations** — Remove Maison, use Manrope only
2. **Consolidate type scale** — Use variables not raw values
3. **Fix iOS scroll** — Check for scroll-blocking CSS
4. **Clean inline styles** — Move to CSS classes
5. **Mobile grid alignment** — Consistent padding/gaps

---

## Files to Modify

1. `public/css/styles.css` — Remove @font-face for Maison, consolidate type scale
2. `public/index.html` — Remove inline styles, use classes
3. `public/js/app.js` — Check for scroll-blocking JS
