# Gumroad UI Audit — Design Replication Guide

**Date:** 2026-02-11
**Source URLs:**
- https://gumroad.com (Homepage)
- https://kittomatic.gumroad.com/l/Novabeast (Product page)
- https://gumroad.com/features (Features page)

---

## 1. Visual Hierarchy

### Typography System
| Element | Specs | Quicklist Adaptation |
|---------|-------|---------------------|
| **Font** | ABC Favorit (proprietary geometric sans) | Manrope 800 ✓ |
| **H1** | 72-96px, -0.02em tracking, 1.0 line-height | `clamp(2.5rem, 8vw, 5rem)` |
| **H2** | 48-56px | `clamp(1.75rem, 5vw, 3rem)` |
| **H3** | 32-40px | `1.75rem` |
| **Body** | 18-20px, 1.6 line-height, relaxed | `1.0625rem`, line-height 1.65 ✓ |
| **Weight range** | 400-700 | Need 800 for headings ✓ |

### Color Hierarchy
| Purpose | Gumroad | Notes |
|---------|---------|-------|
| **Primary action** | Black button w/ pink hover | High contrast, unmissable |
| **Secondary action** | Outlined, black border | Clear but less prominent |
| **Accent** | Pink `#FF90E8` | Signature, used sparingly |
| **Text primary** | Pure black `#000000` | Maximum contrast |
| **Text secondary** | Dark gray | Muted but readable |
| **Backgrounds** | `#F4F4F0` warm gray, `#FFFFFF` white | Warm, not sterile |

### Whitespace Usage
- **Hero padding:** 160px top/bottom (massive)
- **Section padding:** 80-120px vertical
- **Card padding:** 32px internal
- **Element gaps:** 24-32px between major elements
- **Generous margins** create breathing room

**Quicklist Action:** Increase padding throughout. Current feels cramped vs Gumroad's airiness.

---

## 2. Visual Style — Signature Patterns

### The "Chunky Button" Effect
```css
/* Gumroad's signature stacked button */
.button-wrapper {
  position: relative;
}
.button-layer-1 {
  position: absolute;
  inset: 0;
  background: #FFD93D; /* yellow */
  border: 1px solid black;
  border-radius: 4px;
}
.button-layer-2 {
  position: absolute;
  inset: 0;
  background: #FF6B6B; /* red */
  border: 1px solid black;
  transform: translate(2px, 2px);
}
.button-main {
  position: relative;
  background: black;
  color: white;
  border: 1px solid black;
  transition: transform 0.15s;
}
.button-main:hover {
  transform: translate(-4px, -4px);
}
```

**Effect:** Creates playful, almost 3D stacked paper look. The shift on hover reveals colorful layers beneath.

### Border Treatment
| Element | Gumroad Style |
|---------|---------------|
| **Cards** | 1px black border, 24px radius |
| **Buttons** | 1px black border always |
| **Inputs** | 1px border, visible |
| **Dividers** | Black, not gray |

**Key insight:** Gumroad uses **black borders everywhere** — makes UI feel bold and intentional, not wishy-washy.

### Hover States
- Buttons: translate up-left, reveal shadow/layers
- Cards: subtle border color change OR slight lift
- Links: underline appears
- All transitions: 150-200ms, ease-out

### Shadows
Gumroad uses **offset shadows** not diffuse glows:
```css
/* Gumroad style */
box-shadow: 4px 4px 0 0 black;

/* NOT this */
box-shadow: 0 10px 30px rgba(0,0,0,0.1);
```

---

## 3. Component Patterns

### Hero Section (Homepage)
```
┌─────────────────────────────────────────┐
│                                         │
│          [decorative coins]             │
│                                         │
│         Go from 0 to $1                 │  ← Massive H1
│                                         │
│   Anyone can earn their first dollar    │  ← Subtitle
│   online. Just start with what you      │
│   know, see what sticks, and get paid.  │
│                                         │
│   [■ Start selling] [🔍 Search...]      │  ← CTA + Search
│                                         │
│         Fork on GitHub ↗                │  ← Subtle link
│                                         │
└─────────────────────────────────────────┘
```

**Key elements:**
1. Floating decorative elements (coins with parallax)
2. Centered, massive headline
3. Two-line value prop
4. Primary CTA + secondary search
5. Social proof/credibility link

### Cards (Feature Cards)
```
┌──────────────────────────────────────┐
│ border: 1px solid black/50           │
│ border-radius: 24px                  │
│ padding: 32px                        │
│ background: white                    │
│                                      │
│  Sell anything                       │  ← Bold H3
│                                      │
│  Video lessons. Monthly subs.        │  ← Body text
│  Whatever! Gumroad was created...    │
│                                      │
│              [IMAGE]                 │  ← Positioned illustration
│                                      │
└──────────────────────────────────────┘
```

### Product Card (Discover/Marketplace)
```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │   [THUMBNAIL]   │ │  ← Square image
│ └─────────────────┘ │
│                     │
│ Product Name        │  ← Bold, truncated
│ @creator            │  ← Muted, linked
│                     │
│ ★★★★★ (123)        │  ← Ratings
│ $29                 │  ← Price, prominent
└─────────────────────┘
```

### Navigation
```
┌────────────────────────────────────────────────────────┐
│ [Logo] [GitHub★]     Discover Blog Pricing Features   │
│                                            [Log in][Start]│
└────────────────────────────────────────────────────────┘
```
- Sticky header
- Black border bottom
- Clear primary CTA (Start selling)
- Hover: pink background on buttons

---

## 4. Accessibility Notes

### What Gumroad Does Well
- High contrast (black on white)
- Large touch targets
- Clear focus states
- Semantic HTML structure
- Readable font sizes

### What Could Improve
- Some decorative elements may confuse screen readers
- Pink-on-white links need careful contrast checking

---

## 5. Motion & Animation

### Parallax
- Decorative elements move on scroll
- Subtle, 0.03-0.05 intensity
- Creates depth without distraction

### Hover Transitions
- Duration: 100-200ms
- Easing: ease-out
- Properties: transform, background-color

### No Excessive Animation
- No auto-playing videos on homepage
- No bouncing elements
- No loading spinners everywhere
- Keeps it fast and focused

---

## 6. Priority Implementation for Quicklist

### High Impact (Do Now)
1. **Increase whitespace** — Hero padding to 120px+, section gaps to 80px
2. **Black borders on cards** — Replace light gray with `#1f2937`
3. **Chunky button hover** — Already implemented ✓
4. **Larger headings** — Push H1 toward 3.5-4rem

### Medium Impact (This Week)
5. **Offset shadows** — Replace diffuse shadows with `4px 4px 0 0`
6. **Hero redesign** — Center layout, bigger text, decorative elements
7. **Stacked button effect** — For primary CTAs (signup, upgrade)

### Nice to Have (Later)
8. **Parallax decorations** — Floating elements in hero
9. **Product card redesign** — Match marketplace style
10. **Dark mode** — Gumroad has excellent dark mode

---

## 7. CSS Variables Update (Recommended)

```css
:root {
  /* Borders - go darker */
  --border-color: #1f2937;      /* Was light gray */
  --border-light: #e5e0d8;      /* For subtle divisions */
  
  /* Shadows - go chunky */
  --shadow-chunky: 4px 4px 0 0 var(--text-primary);
  --shadow-chunky-accent: 4px 4px 0 0 var(--accent);
  
  /* Spacing - go bigger */
  --space-section: 5rem;        /* 80px */
  --space-hero: 8rem;           /* 128px */
  --space-card: 2rem;           /* 32px */
  
  /* Radius - slightly larger */
  --radius-card: 20px;
  --radius-button: 10px;
}
```

---

## 8. Summary

**Gumroad's design DNA:**
1. **Bold typography** — Big, black, confident
2. **Visible borders** — Not shy about structure
3. **Playful interactions** — Hover reveals, stacked layers
4. **Generous whitespace** — Let things breathe
5. **Warm neutrals** — Cream/gray, not stark white
6. **Strategic color** — Pink used sparingly for maximum impact

**Quicklist current state:**
- ✅ Warm cream background
- ✅ Manrope font
- ✅ Chunky button hover effect
- ✅ Coral accent color
- ⚠️ Borders still too light
- ⚠️ Whitespace could be bigger
- ⚠️ Headings could be bolder
- ❌ No stacked button effect
- ❌ No decorative elements

**Next commit should address:** Darker borders, bigger whitespace, larger headings.
