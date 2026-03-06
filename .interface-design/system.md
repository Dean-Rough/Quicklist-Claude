# QuickList Design System

Extracted from `public/css/styles.css` and `index.html`.
Last critique pass: 31 violations fixed (color, radius, hover, button pattern, gradient).

---

## Direction

Dark bento-grid interface. Flat design — no drop shadows anywhere. Depth comes from borders, background layering, and subtle hover lifts. Color is the primary expressive tool via the bento palette.

---

## Color

### Palette
```
--cream:    #EAE4DA   Primary text on dark; light bento fill
--yellow:   #EAC119   Primary accent — CTAs, focus rings, hover highlights
--pink:     #EAA7C8   Bento variant (warm)
--lavender: #808BC5   Bento variant (cool); alias for accent-purple
--teal:     #9ED6DF   Bento variant; success color
--green:    #245E55   Bento variant (dark green)
--red:      #C63F3E   Error / danger
--dark:     #1e2033   BG primary; text on light surfaces (dark midnight indigo)
--white:    #FFFFFF   Bento variant
```

### Backgrounds (dark layers)
```
--bg-primary:    #1e2033   Page background (dark midnight indigo)
--bg-secondary:  #272a43   Cards, bento-cell, sidebar
--bg-tertiary:   #333656   Form inputs, inactive states
--bg-hover:      #3e4269   Hover state for dark elements
```

### Semantic
```
--text-primary:   var(--cream)
--text-secondary: #EAE4DA
--text-muted:     rgba(234, 228, 218, 0.6)
--border-color:   rgba(234, 228, 218, 0.15)
--border-dark:    rgba(234, 228, 218, 0.3)
--accent:         var(--yellow)
--success:        var(--teal)
--warning:        var(--yellow)
--error:          var(--red)
```

### Usage Rules
- Yellow is the only accent. All CTAs, focus states, and hover highlights use yellow.
- No shadows — ever. `--shadow-soft`, `--shadow-strong`, `--shadow-chunky` are all `none`.
- Bento cells carry the color; dark app elements are always `bg-secondary`/`bg-tertiary`.

---

## Typography

### Fonts
- **Maison** (custom OTF) — body, headings. Weights: 400, 700.
- **Maison Mono** (custom OTF) — nav links, buttons, form inputs, tags.
- **Manrope** (Google Fonts) — fallback / web-safe.

### Scale
```
h1 / hero h1:    clamp(2.5rem, 6vw, 3.5rem)
h2 / .section-title: clamp(1.75rem, 4vw, 2.5rem)
h3:              1.35rem
body:            1rem
small / muted:   0.875rem
form input:      0.95rem  (Maison Mono)
nav link:        0.9rem   (Maison Mono)
button:          0.9rem   (Maison Mono, uppercase)
tag:             0.85rem  (Maison Mono)
```

### Heading Rules
- Font: Maison 700
- Letter-spacing: -0.02em
- Line-height: 1.1
- `text-wrap: balance`

### Body Rules
- Line-height: 1.1
- No margin-top on `<p>`

---

## Spacing

```
--space-xs:  0.5rem   (8px)
--space-sm:  1rem     (16px)
--space-md:  1.5rem   (24px)
--space-lg:  2rem     (32px)
--space-xl:  3rem     (48px)
--space-2xl: 5rem     (80px)
--space-section: 5rem  (section padding top/bottom)
--space-hero:    6rem  (hero vertical padding)
--bento-gap:     16px  (grid gap)
```

Form groups: `margin-bottom: 1.5rem`.
Form labels: `margin-bottom: 0.5rem`.

---

## Radius

```
--radius-sm:    8px    Logo icon, modal-close button
--radius-md:    12px   Form inputs, card-icon, step-image
--radius-lg:    16px   Modal content
--radius-xl:    20px   (same as bento)
--radius-bento: 20px   Cards, buttons, bento cells, tags
--radius-full:  9999px Pill buttons, step-number (50%)
```

---

## Depth

**Flat design. No box-shadows.**

Depth hierarchy:
1. `bg-primary` → `bg-secondary` → `bg-tertiary` (background steps)
2. `1px solid var(--border-color)` on cards and secondary buttons
3. `translateY(-2px)` on hover for buttons and bento cells
4. Bento color variants create visual separation

---

## Bento Grid

```css
.bento-grid:  12-column, gap 16px
.bento-cell:  bg-secondary, radius-bento (20px), padding 1.5rem
```

### Spans
`span-2`, `span-3`, `span-4`, `span-5`, `span-6`, `span-7`, `span-8`, `span-9`, `span-12`

### Color Variants
| Class | BG | Text |
|---|---|---|
| `.bento-cream` | #EAE4DA | #1D1D1B |
| `.bento-yellow` | #EAC119 | #1D1D1B |
| `.bento-pink` | #EAA7C8 | #1D1D1B |
| `.bento-lavender` | #808BC5 | #EAE4DA |
| `.bento-teal` | #9ED6DF | #1D1D1B |
| `.bento-green` | #245E55 | #EAE4DA |
| `.bento-dark` | #2A2A28 + border | #EAE4DA |
| `.bento-red` | #C63F3E | #EAE4DA |
| `.bento-white` | #FFFFFF | #1D1D1B |

### Breakpoints
- `968px`: 6-column; span-2/3/4 → span-3; span-5/7/8/9 → span-6
- `640px`: 1-column; bento-cell padding → 1.25rem

### Container
```
max-width: 1400px; margin: 0 auto; padding: 0 2rem;
```

---

## Buttons

```
Base:      padding 0.75rem 1.5rem | radius-bento (20px) | Maison Mono 700 | uppercase | 0.9rem | letter-spacing 0.02em
Primary:   bg yellow (#EAC119)  | color dark    | hover: bg darken + translateY(-2px)
Secondary: bg bg-tertiary        | color cream   | 1px border | hover: bg-hover + border cream + translateY(-2px)
Small:     padding 0.375rem 0.75rem | 0.875rem
Pill:      radius 9999px | border 1px | bg transparent | hover: no lift, subtle bg
Disabled:  opacity 0.5 | cursor not-allowed | no transform | no shadow
```

---

## Form Inputs

```
.form-input:
  padding: 0.75rem
  background: var(--bg-tertiary)
  border: 1px solid var(--border-color)
  border-radius: 12px (radius-md)
  color: var(--text-primary)
  font-family: Maison Mono
  font-size: 0.95rem

:focus → outline: 2px solid yellow, outline-offset: 2px, border-color: yellow
:valid:not(:placeholder-shown) → border-color: teal (success)
:invalid / .error → border-color: red (error)
[aria-invalid='true'] → border-color: red, no shadow

textarea: resize vertical, min-height 100px
select: -webkit-appearance none, bg-tertiary
```

Focus ring is always **2px solid yellow, 2px offset** — applies to all interactive elements.

---

## Cards

```
.card:
  background: bg-secondary
  border: 1px solid border-color
  border-radius: radius-bento (20px)
  padding: 1.5rem
  hover: border-color darkens to border-dark

.card-featured:
  border: 1px solid yellow (no shadow)
  hover: translateY(-2px)

.card-icon:
  48x48, bg accent-light (yellow 15%), color yellow
  border-radius: 12px
```

---

## Tags

```
background: rgba(234, 193, 25, 0.15)
color: var(--yellow)
padding: 0.5rem 1rem
border-radius: 20px (radius-bento)
font: Maison Mono 0.85rem 400
```

---

## Icons

- Default: 24×24 SVG stroke (`currentColor`, stroke-width 2)
- Mobile menu: 20×20
- Inline action buttons: 16×16
- Always inline SVG — no icon font

---

## Interactions

```
Hover lift:    translateY(-2px) — primary/secondary buttons, bento cells, featured cards
Transition:    0.15s ease (buttons) / 0.2s ease (cards, nav, borders)
Focus ring:    2px solid yellow, 2px offset (global)
Active states: No scale — lift only
```

---

## Header

```
position: sticky, top: 0, z-index 1000
background: bg-primary, backdrop-filter blur(16px)
border-bottom: 1px solid border-color
content: max-width 1400px, padding 1rem 2rem
nav links: Maison Mono 0.9rem, cream, hover → yellow
```

---

## Modals

```
Overlay: rgba(0,0,0,0.8), z-index 2000
Content: bg-secondary, border-radius 16px, padding 2rem, max-width 500px
         border: 1px solid border-color
Header:  1.5rem title, 700; close button 32×32, radius 8px
```

---

## Anti-Patterns (what this system does NOT do)

- No drop shadows anywhere
- No gradients on UI elements (hero background uses subtle radial gradient as texture only)
- No indigo/purple as primary — that was the old theme; yellow is the accent now
- No `box-shadow` on focus — only `outline`
- No Tailwind utility classes — raw CSS custom properties only
- No CSS-in-JS — single external stylesheet at `public/css/styles.css`
