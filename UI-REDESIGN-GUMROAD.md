# Quicklist UI Redesign — Gumroad-Inspired

## Design Analysis: What Makes Gumroad Work

### Typography
- **Font**: ABC Favorit (geometric sans) → We'll use **Manrope** everywhere
- **Headings**: Massive (6xl-8xl), bold, tight tracking
- **Body**: Relaxed line-height, 18-20px base
- **No second font** — one font, weight variations only

### Color Palette
Gumroad uses high-contrast with playful accents:

| Role | Gumroad | Quicklist Adaptation |
|------|---------|---------------------|
| Background | `#F4F4F0` (warm gray) | `#f7f2ea` (cream) ✓ keep |
| Surface | `#FFFFFF` | `#FFFFFF` |
| Text | `#000000` | `#1a1a2e` |
| Accent | `#FF90E8` (pink) | `#0f766e` (teal) or go pink? |
| Border | `#242423` (near-black) | `#e5e0d8` → make darker |
| Hover accent | Pink + yellow/red layers | Teal with shadow |

### Signature UI Patterns

1. **Chunky buttons with hover lift**
   ```css
   .btn-chunky {
     border: 2px solid #1a1a2e;
     border-radius: 8px;
     transition: transform 0.15s, box-shadow 0.15s;
   }
   .btn-chunky:hover {
     transform: translate(-2px, -2px);
     box-shadow: 4px 4px 0 0 #1a1a2e;
   }
   ```

2. **Cards with visible borders**
   - White background
   - 1-2px dark border (not light gray)
   - Large radius (16-24px)
   - Generous padding (32px)

3. **Pill buttons for secondary actions**
   - `border-radius: 9999px`
   - Border on hover only

4. **Layered/stacked button effect** (their signature)
   - Multiple colored layers behind the button
   - Shifts on hover to reveal layers

---

## Implementation Plan

### Phase 1: Typography Reset

**Remove Space Grotesk. Manrope only.**

```css
:root {
  --font-family: 'Manrope', system-ui, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

h1 { font-size: 3.5rem; }  /* 56px */
h2 { font-size: 2.5rem; }  /* 40px */
h3 { font-size: 1.75rem; } /* 28px */

body {
  font-family: var(--font-family);
  font-weight: 400;
  font-size: 1.125rem; /* 18px */
  line-height: 1.6;
}
```

### Phase 2: Color & Border Updates

```css
:root {
  /* Keep cream background */
  --bg-primary: #f7f2ea;
  --bg-secondary: #ffffff;
  
  /* Darken borders for Gumroad feel */
  --border-color: #1a1a2e;
  --border-light: #e5e0d8;
  
  /* Accent stays teal (or switch to pink?) */
  --accent: #0f766e;
  --accent-hover: #0d5c56;
  
  /* Text */
  --text-primary: #1a1a2e;
  --text-secondary: #64748b;
}
```

### Phase 3: Button Overhaul

**Primary button — chunky with lift:**
```css
.btn-primary {
  background: var(--accent);
  color: white;
  border: 2px solid var(--text-primary);
  border-radius: 10px;
  padding: 0.875rem 1.75rem;
  font-weight: 700;
  font-size: 1.125rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary:hover {
  transform: translate(-3px, -3px);
  box-shadow: 3px 3px 0 0 var(--text-primary);
}
```

**Secondary button — outlined pill:**
```css
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 2px solid var(--border-light);
  border-radius: 9999px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
}

.btn-secondary:hover {
  border-color: var(--text-primary);
  background: var(--bg-primary);
}
```

### Phase 4: Card Redesign

```css
.card {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-light);
  border-radius: 20px;
  padding: 2rem;
  transition: border-color 0.2s;
}

.card:hover {
  border-color: var(--text-primary);
}

/* Featured card variant */
.card-featured {
  border: 2px solid var(--text-primary);
  box-shadow: 6px 6px 0 0 var(--accent);
}
```

### Phase 5: Form Inputs

```css
input, textarea, select {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  font-size: 1.125rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.1);
  outline: none;
}
```

### Phase 6: Hero Section

Gumroad uses:
- Huge text (8xl)
- Centered layout
- Decorative floating elements
- Search bar prominent

```css
.hero h1 {
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.hero-subtitle {
  font-size: 1.25rem;
  max-width: 32rem;
  margin: 0 auto;
  color: var(--text-secondary);
}
```

---

## Quick Wins (Do First)

1. ✅ Remove Space Grotesk from `<head>`
2. ✅ Set Manrope as only font
3. ✅ Increase heading font-weight to 800
4. ✅ Increase heading sizes
5. ✅ Add chunky button hover effect
6. ✅ Darken card borders slightly

## Color Decision Needed

**Option A: Keep Teal** (`#0f766e`)
- Professional, trust-building
- Differentiated from Gumroad

**Option B: Go Pink** (`#FF90E8`)
- More playful, memorable
- Direct Gumroad vibe
- Might be too close to copying

**Recommendation:** Keep teal accent but adopt the *interaction patterns* (chunky buttons, visible borders, hover lifts). The teal is actually nice and differentiates Quicklist.

---

## Files to Modify

1. `index.html` — Remove Space Grotesk font link
2. `public/css/styles.css` — All the CSS changes
3. `public/js/app.js` — Update Clerk appearance config (remove Space Grotesk)
