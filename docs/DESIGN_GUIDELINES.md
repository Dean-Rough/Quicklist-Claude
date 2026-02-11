# QuickList AI - Design Guidelines

## Icon Usage Policy

### ✅ Allowed: Flat SVG Icons Only

All icons in the application **MUST** use flat SVG icons. This ensures:

- Consistent visual language across the app
- Proper scaling at all sizes
- Accessibility (screen readers can describe icons)
- Theme compatibility (icons adapt to color schemes)
- Professional appearance

### ❌ Prohibited: Emoji Icons

**Never use emoji icons** (📱, 💰, ✉️, etc.) in the UI because:

- Inconsistent rendering across platforms (iOS, Android, Windows render emojis differently)
- Accessibility issues (hard for screen readers to interpret)
- Unprofessional appearance
- Cannot be styled or themed
- Poor scaling (fuzzy at different sizes)

## Icon Implementation

### Standard Icon Format

Use inline SVG with these attributes:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <!-- path data -->
</svg>
```

### Common Icon Sizes

- **Small inline icons**: 16x16px (in text, buttons)
- **Medium icons**: 24x24px (in cards, headers)
- **Large icons**: 48x48px (empty states, placeholders)
- **Extra large**: 64x64px (hero sections, major CTAs)

### Icon Library

We use **Feather Icons** style for consistency. Common icons:

**Search**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="11" cy="11" r="8"></circle>
  <path d="m21 21-4.35-4.35"></path>
</svg>
```

**Check/Success**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"></circle>
  <path d="m9 12 2 2 4-4"></path>
</svg>
```

**Error/Close**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="15" y1="9" x2="9" y2="15"></line>
  <line x1="9" y1="9" x2="15" y2="15"></line>
</svg>
```

**Camera**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path
    d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
  ></path>
  <circle cx="12" cy="13" r="4"></circle>
</svg>
```

**Money/Price**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
</svg>
```

**Arrow/Next**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M5 12h14"></path>
  <path d="m12 5 7 7-7 7"></path>
</svg>
```

**Mail/Messages**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
  <polyline points="22,6 12,13 2,6"></polyline>
</svg>
```

**Package/Box**:

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path
    d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  ></path>
</svg>
```

## Layout Guidelines

### Container Padding

All main content sections **MUST** use the `.container` class:

```html
<div class="container section">
  <!-- content -->
</div>
```

This ensures:

- Consistent max-width (1400px)
- Proper horizontal padding (2rem on desktop, 1rem on mobile)
- Aligned with the rest of the UI

### Grid Consistency

All grid layouts should align with the container padding:

```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
```

**Never** apply edge-to-edge styles unless it's:

- Hero sections
- Navigation bars
- Full-width backgrounds (with content inside containers)

## Color Usage

### Primary Colors

- `--accent-indigo`: Primary brand color
- `--success`: Success states, positive feedback
- `--warning`: Warning states, caution
- `--error`: Error states, destructive actions

### Text Colors

- `--text-primary`: Main text
- `--text-secondary`: Supporting text
- `--text-muted`: De-emphasized text

### Background Colors

- `--bg-primary`: Main background
- `--bg-secondary`: Card backgrounds
- `--bg-tertiary`: Nested elements
- `--bg-hover`: Interactive hover states

## Spacing

Use consistent spacing multipliers:

- `0.25rem` (4px) - Tiny gaps
- `0.5rem` (8px) - Small gaps
- `1rem` (16px) - Standard gaps
- `1.5rem` (24px) - Medium gaps
- `2rem` (32px) - Large gaps
- `3rem` (48px) - Extra large gaps

## Typography

### Font Sizes

- `0.75rem` - Small labels
- `0.875rem` - Secondary text
- `1rem` - Body text
- `1.125rem` - Large body
- `1.25rem` - Subheadings
- `1.5rem` - Headings
- `2rem` - Large headings
- `2.5rem` - Hero headings

### Font Weights

- `400` - Regular
- `500` - Medium
- `600` - Semibold
- `700` - Bold

## Enforcement

When adding new features:

1. ✅ Check: Are you using SVG icons?
2. ✅ Check: Is content inside a `.container`?
3. ✅ Check: Are you using CSS variables for colors?
4. ✅ Check: Are you using consistent spacing?

**If you find emoji icons in the codebase, replace them immediately with SVG equivalents.**
