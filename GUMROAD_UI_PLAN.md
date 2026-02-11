# Gumroad-Inspired UI Redesign Plan

> Analysis of Gumroad's design language and a concrete plan to adopt its best patterns into QuickList's marketing pages, while keeping our warm brand identity and integrating our existing Lottie animations.

---

## Part 1: Gumroad Design DNA — What Makes It Work

### 1.1 Visual Identity

| Element | Gumroad | QuickList Current | Proposed Change |
|---------|---------|-------------------|-----------------|
| **Background** | Clean white (`#fff`) | Warm cream (`#f7f2ea`) | Keep cream — it's warmer and differentiates us. Shift cards to pure white for contrast |
| **Accent** | Pink/magenta `rgb(255, 144, 232)` | Coral `#FF7A5C` | Keep coral as primary. Add a secondary pink `#FF90E8` for highlights/tags only |
| **Typography** | "ABC Favorit" (geometric sans) | "Manrope" (geometric sans) | Keep Manrope — it's a strong match. Increase heading boldness to 900 |
| **Borders** | Dark, visible, intentional | Warm gray `#d1ccc4` | Move to darker borders `#1f2937` on key cards (already have `--border-dark`) |
| **Shadows** | Almost none — flat + borders | Soft blurs + chunky offset | Reduce blur shadows. Double down on chunky offset shadows (already started) |
| **Corners** | Subtle rounding (8-12px) | 12-20px | Slightly reduce to 10-14px for a tighter, more "Gumroad" feel |

### 1.2 Key Gumroad Patterns to Steal

1. **The "Boxed Grid" Layout** — Cards sit in a visible grid with strong borders. No floating-in-space feel. Everything has a clear container.

2. **Asymmetrical Masonry** — Not a uniform grid. Some cards span 2 columns, some are tall, some are short. Creates visual rhythm and hierarchy.

3. **Decorative Stickers/Tags** — Small, rotated pill badges ("Easy!", "Free", price tags) scattered on sections. Playful personality layer.

4. **The Three-Step Flow** — Icons/illustrations → label → description, laid out horizontally. Clean, scannable.

5. **Testimonial Carousel** — Real creator quotes with avatar, name, and product category. Social proof with personality.

6. **Bold Section Headings with Subtext** — All-caps category label above the main heading. Creates hierarchy without visual clutter.

7. **Hover = Chunky Lift** — Cards/buttons translate up-left on hover with offset box-shadow appearing. Already partially implemented in QuickList.

8. **Generous Whitespace** — Sections breathe. No cramming. 80-120px between major sections.

---

## Part 2: Asymmetrical Masonry Grid System

### 2.1 The Layout Concept

Replace the current uniform `grid-3` and `grid-2` with a masonry-style grid where cards have varying sizes and visual weight.

```
┌──────────────────┬─────────┐
│                  │         │
│   LARGE CARD     │  SMALL  │
│   (2 col span)   │  CARD   │
│                  │         │
├─────────┬────────┴─────────┤
│         │                  │
│  SMALL  │   LARGE CARD     │
│  CARD   │   (2 col span)   │
│         │                  │
├─────────┼─────────┬────────┤
│  MEDIUM │  MEDIUM │ MEDIUM │
│  CARD   │  CARD   │  CARD  │
└─────────┴─────────┴────────┘
```

### 2.2 CSS Implementation

```css
/* Masonry-style feature grid */
.grid-masonry {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: minmax(180px, auto);
  gap: 1.25rem;
}

.grid-masonry .card-wide {
  grid-column: span 2;
}

.grid-masonry .card-tall {
  grid-row: span 2;
}

.grid-masonry .card-feature {
  grid-column: span 2;
  grid-row: span 2;
}

@media (max-width: 768px) {
  .grid-masonry {
    grid-template-columns: 1fr;
  }
  .grid-masonry .card-wide,
  .grid-masonry .card-tall,
  .grid-masonry .card-feature {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

### 2.3 Features Section — New Masonry Layout

Current: 8 uniform cards in a 3-column grid.
Proposed: Asymmetrical grid where key features get more visual weight.

```
┌───────────────────────┬──────────────┐
│  AI-Powered            │  Optimized   │
│  Descriptions          │  Titles      │
│  [Lottie: step2-anim]  │              │
│  card-wide             │              │
├──────────────┬─────────┴──────────────┤
│  Data-Driven │  Professional Images   │
│  Pricing     │  [Lottie: scan-anim]   │
│              │  card-wide             │
├──────────────┼──────────────┬─────────┤
│  Keywords &  │  Flaw        │ Stock   │
│  Hashtags    │  Detection   │ Image   │
├──────────────┴──────────────┴─────────┤
│  Multi-Platform Support               │
│  [Full width banner with platform     │
│   logos: Vinted, eBay, Gumtree]       │
│  card-wide (3 col span)              │
└───────────────────────────────────────┘
```

**Key idea**: The two most compelling features (AI Descriptions, Professional Images) get large cards with embedded Lottie animations. The bottom banner spans full width showing platform logos.

---

## Part 3: Animation & Interaction Plan

### 3.1 Scroll-Triggered Card Entrances

Cards animate in as they enter the viewport. Staggered timing creates a "cascade" effect.

```css
/* Base state - cards start invisible and shifted down */
.card[data-animate] {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

/* Animated state - triggered by IntersectionObserver */
.card[data-animate].is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger delays for grid children */
.grid-masonry .card:nth-child(1) { transition-delay: 0ms; }
.grid-masonry .card:nth-child(2) { transition-delay: 80ms; }
.grid-masonry .card:nth-child(3) { transition-delay: 160ms; }
.grid-masonry .card:nth-child(4) { transition-delay: 240ms; }
.grid-masonry .card:nth-child(5) { transition-delay: 320ms; }
.grid-masonry .card:nth-child(6) { transition-delay: 400ms; }
.grid-masonry .card:nth-child(7) { transition-delay: 480ms; }
.grid-masonry .card:nth-child(8) { transition-delay: 560ms; }
```

**JS (extend existing IntersectionObserver pattern):**

```javascript
// Reuse the lazy animation observer pattern already in app.js
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      cardObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

document.querySelectorAll('.card[data-animate]').forEach(card => {
  cardObserver.observe(card);
});
```

### 3.2 Card Hover Interactions (Gumroad-Style)

```css
/* Enhanced hover - chunky lift with color accent border */
.card-interactive {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.card-interactive:hover {
  transform: translate(-4px, -4px);
  box-shadow: 4px 4px 0 0 var(--accent);
  border-color: var(--text-primary);
}

/* Different accent colors per card for visual variety */
.card-interactive:nth-child(3n+1):hover { box-shadow: 4px 4px 0 0 var(--accent); }
.card-interactive:nth-child(3n+2):hover { box-shadow: 4px 4px 0 0 var(--accent-mint); }
.card-interactive:nth-child(3n+3):hover { box-shadow: 4px 4px 0 0 var(--accent-yellow); }
```

### 3.3 Lottie Animation Integration in Feature Cards

The large masonry cards embed Lottie animations that play on scroll-enter (already supported by the lazy loading system).

**Concept**: Feature cards with a split layout — text on one side, animation on the other.

```html
<!-- Example: AI Descriptions feature card -->
<div class="card card-wide card-interactive card-split" data-animate>
  <div class="card-split-text">
    <span class="card-tag">Core Feature</span>
    <h3>AI-Powered Descriptions</h3>
    <p>Marketplace-ready descriptions in the style buyers respond to.</p>
  </div>
  <div class="card-split-visual">
    <div id="feature-anim-1" class="card-lottie"></div>
  </div>
</div>
```

```css
.card-split {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2.5rem;
}

.card-split-text {
  flex: 1;
}

.card-split-visual {
  flex: 0 0 200px;
  height: 160px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}
```

### 3.4 Decorative Floating Tags (Gumroad Stickers)

Small, rotated pill badges that add personality.

```css
.tag-float {
  display: inline-block;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 700;
  border: 1.5px solid var(--text-primary);
  position: absolute;
  transform: rotate(-3deg);
  background: var(--accent-yellow);
  color: var(--text-primary);
  box-shadow: 2px 2px 0 0 var(--text-primary);
  z-index: 2;
}

.tag-float--mint { background: var(--accent-mint); }
.tag-float--coral { background: var(--accent); color: white; }
.tag-float--blue { background: var(--accent-blue); color: white; }
```

**Placement ideas:**
- "AI Magic" tag rotated on the hero section
- "Free!" tag on the pricing section
- "New" tag on newly launched features
- "Fast" tag near the 3-step flow

### 3.5 Parallax-Lite on Decorative Elements

Subtle mouse-follow parallax on floating tags and decorative elements (not the main content).

```javascript
// Light parallax on decorative elements only
document.addEventListener('mousemove', (e) => {
  const tags = document.querySelectorAll('.tag-float');
  const x = (e.clientX / window.innerWidth - 0.5) * 2;
  const y = (e.clientY / window.innerHeight - 0.5) * 2;

  tags.forEach((tag, i) => {
    const depth = (i % 3 + 1) * 4; // 4px, 8px, or 12px movement
    tag.style.transform = `rotate(${tag.dataset.rotate || -3}deg) translate(${x * depth}px, ${y * depth}px)`;
  });
});
```

---

## Part 4: Section-by-Section Redesign

### 4.1 Header

**Current**: Solid coral background, white text, logo animation.
**Change**: Keep this. It's bold and distinctive. Minor tweak: add a subtle `border-bottom: 2px solid var(--text-primary)` for the Gumroad "boxed" feel.

### 4.2 Hero Section

**Current**: 2-column grid, gradient text heading, hero Lottie animation.
**Changes**:
- Add 2-3 floating tags ("AI Powered", "Free to Start", "Instant Results") scattered around the hero, slightly rotated
- Reduce the gradient background complexity — let the Lottie animation be the visual star
- Make the CTA buttons slightly larger with more prominent chunky hover
- Add a subtle entrance animation: heading slides in from left, Lottie fades in from right

```css
.hero-text {
  animation: slideInLeft 0.8s ease-out;
}

.hero-image-container {
  animation: fadeInRight 0.8s ease-out 0.2s both;
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
```

### 4.3 "How It Works" Section

**Current**: 3 equal steps in a row with Lottie animations, number badges, text.
**Changes**:
- Convert to an alternating left/right layout (Gumroad features page style)
- Step 1: Animation left, text right
- Step 2: Text left, animation right
- Step 3: Animation left, text right
- Larger animation containers (fill the visual half)
- Add connecting line/arrow between steps
- Each step gets a colored accent border (coral, mint, yellow)

```css
.step-alternating {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  padding: 3rem 0;
  border-bottom: 1px solid var(--border-color);
}

.step-alternating:nth-child(even) {
  direction: rtl; /* Flip layout for alternating */
}

.step-alternating:nth-child(even) > * {
  direction: ltr; /* Reset text direction */
}

.step-alternating .step-visual {
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 4/3;
  background: var(--bg-tertiary);
  border: 2px solid var(--text-primary);
  box-shadow: 6px 6px 0 0 var(--accent);
}

.step-alternating:nth-child(2) .step-visual {
  box-shadow: 6px 6px 0 0 var(--accent-mint);
}

.step-alternating:nth-child(3) .step-visual {
  box-shadow: 6px 6px 0 0 var(--accent-yellow);
}
```

### 4.4 Features Section (The Big Masonry Redesign)

**Current**: 8 uniform cards in a `grid-3`.
**Changes**: Full masonry grid as described in Part 2. Key cards get Lottie animations. All cards get scroll-triggered entrance animations and interactive hover.

### 4.5 Target Audience Section

**Current**: 2 cards with stock photos, bullet lists.
**Changes**:
- Make each card a "card-featured" with dark border + colored offset shadow
- Casual Declutterers: coral shadow, with casual-seller Lottie animation replacing stock photo
- Power Sellers: mint shadow, with power-seller Lottie animation replacing stock photo
- Add floating tags: "Weekend Sellers" on casual card, "Full Time" on power card

### 4.6 FAQ Section

**Current**: 3 cards in a 2-column grid.
**Changes**:
- Convert to accordion-style (Gumroad uses expandable content)
- Single column, clean borders between items
- Click to expand/collapse with smooth height animation
- Plus/minus icon rotates on toggle

```css
.faq-item {
  border-bottom: 1.5px solid var(--border-color);
  padding: 1.5rem 0;
}

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 700;
  font-size: 1.2rem;
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  color: var(--text-secondary);
}

.faq-item.active .faq-answer {
  max-height: 200px;
  padding-top: 1rem;
}

.faq-toggle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease, background 0.3s ease;
}

.faq-item.active .faq-toggle {
  transform: rotate(45deg);
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
```

### 4.7 Final CTA Section

**Current**: Coral gradient card with white text and button.
**Changes**:
- Keep the gradient but add a dark border around the entire card
- Add floating tags around it ("Start Free", "No Credit Card")
- Make the button white with dark border + chunky hover
- Add a subtle pulse animation on the button to draw attention

```css
.cta-card {
  border: 2px solid var(--text-primary);
  box-shadow: 8px 8px 0 0 var(--text-primary);
  position: relative;
  overflow: visible; /* Allow floating tags to overflow */
}

.cta-btn-pulse {
  animation: gentlePulse 3s ease-in-out infinite;
}

@keyframes gentlePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(255, 255, 255, 0); }
}
```

### 4.8 New Section: Social Proof / Testimonials

Add a Gumroad-style testimonial carousel between Features and Target Audience.

```html
<section class="section" aria-labelledby="testimonials-title">
  <div class="container">
    <span class="section-label">TRUSTED BY SELLERS</span>
    <h2 id="testimonials-title" class="section-title">What Sellers Are Saying</h2>
    <div class="testimonial-track">
      <div class="testimonial-card">
        <p class="testimonial-quote">"Listed 30 items in an hour. Usually takes me all weekend."</p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">JD</div>
          <div>
            <strong>Jane D.</strong>
            <span>Vinted Seller</span>
          </div>
        </div>
      </div>
      <!-- More cards... -->
    </div>
  </div>
</section>
```

```css
.testimonial-track {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 1rem 0 2rem;
  -webkit-overflow-scrolling: touch;
}

.testimonial-card {
  flex: 0 0 350px;
  scroll-snap-align: start;
  background: var(--bg-secondary);
  border: 2px solid var(--text-primary);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: 4px 4px 0 0 var(--accent);
}

.testimonial-card:nth-child(2) { box-shadow: 4px 4px 0 0 var(--accent-mint); }
.testimonial-card:nth-child(3) { box-shadow: 4px 4px 0 0 var(--accent-yellow); }
.testimonial-card:nth-child(4) { box-shadow: 4px 4px 0 0 var(--accent-blue); }

.testimonial-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
```

---

## Part 5: Updated Design Tokens

### 5.1 CSS Variable Changes

```css
:root {
  /* Backgrounds — keep warm, slightly brighter */
  --bg-primary: #f7f2ea;        /* No change — warm cream stays */
  --bg-secondary: #ffffff;       /* No change */
  --bg-tertiary: #f0e8dc;        /* Slightly warmer */
  --bg-hover: #e7dbc9;           /* No change */

  /* Accent palette — add Gumroad pink as secondary */
  --accent: #FF7A5C;             /* Primary coral — no change */
  --accent-hover: #E8694D;
  --accent-light: rgba(255, 122, 92, 0.12);
  --accent-pink: #FF90E8;        /* NEW — Gumroad-inspired pink for tags/highlights */
  --accent-mint: #6BCB8E;
  --accent-yellow: #FFD93D;
  --accent-blue: #5B89B5;

  /* Borders — darker by default (Gumroad influence) */
  --border-color: #c4bfb7;       /* Slightly darker warm gray */
  --border-dark: #1f2937;        /* No change — used for emphasis */
  --border-card: 1.5px solid var(--border-color);
  --border-bold: 2px solid var(--text-primary);

  /* Radius — tighter (Gumroad influence) */
  --radius-sm: 6px;              /* Was 8px */
  --radius-md: 10px;             /* Was 12px */
  --radius-lg: 14px;             /* Was 16px */
  --radius-xl: 18px;             /* Was 20px */
  --radius-full: 9999px;

  /* Shadows — less blur, more chunky offset */
  --shadow-soft: 0 8px 24px rgba(15, 23, 42, 0.06);   /* Lighter */
  --shadow-strong: 0 16px 48px rgba(15, 23, 42, 0.12); /* Lighter */
  --shadow-chunky: 4px 4px 0 0 var(--text-primary);     /* No change */
  --shadow-chunky-accent: 4px 4px 0 0 var(--accent);    /* NEW */
  --shadow-chunky-lg: 6px 6px 0 0 var(--text-primary);  /* NEW — for larger cards */
}
```

### 5.2 Typography Updates

```css
/* Slightly bolder headings — Gumroad uses very bold type */
h1, .hero h1 { font-weight: 900; } /* Was 800 */
h2, .section-title { font-weight: 800; } /* No change */
h3 { font-weight: 700; } /* Was inherited */

/* Add section label style (Gumroad's all-caps category labels) */
.section-label {
  display: block;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.75rem;
}
```

---

## Part 6: Lottie Animation Integration Map

### 6.1 Current Animations and Proposed Placement

| Animation File | Current Use | New Use |
|---------------|-------------|---------|
| `online-marketplace-website-in-browser-window` | Hero section | Hero section (keep, larger) |
| `scan-to-pay-illustration-in-line-art-style` | Step 1 | Step 1 (alternating layout) + Features "Professional Images" card |
| `online-shopping-time-line-art-illustration` | Step 2 | Step 2 (alternating layout) |
| `shopping-receipt-illustration-in-line-art-style` | Step 3 | Step 3 (alternating layout) |
| `woman-buys-handbag-online-line-art` | Casual seller card | Target Audience — Casual card (replace stock photo) |
| `online-furniture-shopping-line-art-illustration` | Power seller card | Target Audience — Power card (replace stock photo) |
| `payment-processed-illustration-in-line-art` | Unused | Features — "Data-Driven Pricing" masonry card |
| `product-rating-line-art-illustration` | Unused | Features — "Honest Flaw Detection" card or Testimonials section |
| `growing-deposit-illustration-in-line-art-style` | Unused | Final CTA section background decoration |
| `Quicklist Anim White Trimed` | Logo (header) | Keep |
| `Quicklist Anim Black Trimed` | Unused | Use in footer or secondary header contexts |

### 6.2 Animation Behavior Upgrades

1. **Play on hover for feature cards**: When a user hovers a masonry card with a Lottie animation, the animation plays from the beginning. On mouse leave, it pauses at the current frame.

2. **Speed sync with scroll**: For the hero animation, subtly adjust playback speed based on scroll position. Faster when scrolling, normal when idle.

3. **Entrance coordination**: When a card with a Lottie animation enters the viewport, the card slides in first, then the animation starts playing 200ms after the card is visible.

```javascript
// Enhanced lazy animation with hover control
function initFeatureAnimations() {
  document.querySelectorAll('.card-lottie').forEach(container => {
    const anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: false, // Don't autoplay — wait for visibility
      path: container.dataset.animPath
    });

    // Play when visible
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => anim.play(), 200); // Delay for card entrance
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.3 });

    observer.observe(container);

    // Hover: restart from beginning
    container.closest('.card')?.addEventListener('mouseenter', () => {
      anim.goToAndPlay(0, true);
    });
  });
}
```

---

## Part 7: Implementation Order

### Phase 1 — Foundation (Design Tokens + Grid)
1. Update CSS variables (colors, borders, radius, shadows)
2. Add `.section-label` typography class
3. Build `.grid-masonry` system with responsive breakpoints
4. Add `.card-interactive` hover styles
5. Add `.card-split` layout for animation+text cards

### Phase 2 — Hero + How It Works
6. Add hero entrance animations (slide in)
7. Add floating tag system (`.tag-float`)
8. Convert "How It Works" to alternating left/right layout
9. Enlarge step animation containers

### Phase 3 — Features Section Masonry
10. Restructure features HTML to masonry grid
11. Assign card sizes (wide, tall, feature)
12. Embed Lottie animations in large feature cards
13. Add scroll-triggered entrance animations
14. Wire up hover-play for card Lottie animations

### Phase 4 — Social Proof + Polish
15. Build testimonial carousel section
16. Convert FAQ to accordion
17. Add floating tags to hero and CTA sections
18. Replace stock photos with Lottie animations in Target Audience
19. Add mouse-follow parallax on decorative elements

### Phase 5 — CTA + Final Touches
20. Restyle final CTA with bold border + chunky shadow
21. Add pulse animation to CTA button
22. Integrate unused Lottie animations (payment, rating, deposit)
23. Accessibility pass — ensure all animations respect `prefers-reduced-motion`
24. Mobile responsive testing and adjustments

---

## Part 8: What NOT to Change

- **Warm cream background** — This differentiates QuickList from Gumroad's plain white. Keep the warmth.
- **Coral accent color** — It's already strong and recognizable. Don't switch to Gumroad's pink as primary.
- **Manrope font** — Excellent geometric sans-serif that matches Gumroad's ABC Favorit aesthetic.
- **Chunky offset shadow pattern** — Already started, just needs to be applied more consistently.
- **Single-file architecture** — All changes stay within `index.html` + `styles.css` + `app.js`.
- **Lottie animation library** — Already loaded and working well. Just expand its usage.
- **Performance patterns** — Keep IntersectionObserver lazy loading, `prefers-reduced-motion` support, and visibility-change pausing.

---

## Appendix: Gumroad Page Analysis Details

### gumroad.com (Homepage)
- White background, dark text, minimal color
- "ABC Favorit" font (geometric sans-serif, WOFF2)
- Large bold hero: "Go from 0 to $1"
- Card-based product discovery grid
- Decorative SVG coin illustrations
- Rounded CTA buttons with arrow icons
- Accordion sections for expandable content
- Mobile hamburger with transform animations

### kittomatic.gumroad.com/l/Novabeast (Product Page)
- Single-column content layout
- Pink/magenta accent: `rgb(255, 144, 232)`
- Video carousel with thumbnail navigation
- Prominent price display ($35)
- Pink "Add to cart" CTA button
- Clean horizontal dividers between sections
- Blockquote containers for important notices
- Structured data for pricing/availability

### gumroad.com/features (Features Page)
- "Built for new beginnings" hero
- Three-step horizontal flow (Account → Product → Sell)
- Category icons for use cases
- Alternating text/illustration feature blocks
- All-caps section labels above headings
- Testimonial carousel with navigation dots
- Handwritten-style decorative stickers ("Easy", "Price tag")
- Consistent custom SVG illustration style
