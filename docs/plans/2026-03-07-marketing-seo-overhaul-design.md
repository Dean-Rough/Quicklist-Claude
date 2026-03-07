# Marketing Page SEO & Visual Overhaul Design

**Goal:** Rebuild the marketing landing page with world-class SEO content depth, rich structured data, and polished visuals using available Lottie animations and stock photography.

**Architecture:** All changes are confined to `index.html` (source) and synced to `public/index.html`. No new pages, no server changes. SEO is delivered via structured data JSON-LD, expanded content, and semantic HTML improvements.

**Tech Stack:** Vanilla HTML/CSS/JS, Lottie via `@lottiefiles/lottie-player` CDN (already loaded), existing stock images in `/public/images/`, existing Lottie JSONs in `/public/json_anim/`

---

## Section 1: SEO Meta & Structured Data

**Current state:** 1x SoftwareApplication JSON-LD, 1x WebSite JSON-LD. FAQ has 3 questions with no schema.

**Changes:**
- Add `FAQPage` JSON-LD schema with all 12 FAQ questions/answers (enables Google rich results FAQ dropdowns)
- Add `HowTo` JSON-LD schema for the 3-step process section
- Update `featureList` in SoftwareApplication schema to include all real features (barcode scanning, blur detection, flaw detection, image enhancement, eBay posting, Smart Clipboard)
- Add `aggregateRating` placeholder structure (ready for real data)
- Sub-page `document.title` updates: Photo Tips, Seller Checklist, and Pricing pages each get their own title/description via the existing JS navigation system

---

## Section 2: Hero

**Current:** Static headline + paragraph + 2 CTAs + 2 checkmarks + hero image

**Changes:**
- Headline refined: "Turn Your Clutter Into Cash — In Minutes" (more specific, higher intent)
- Sub-copy expanded to 3 sentences naturally including "Vinted", "eBay", "Gumtree", "UK sellers", "AI listing generator"
- Add third trust signal: "Works in seconds" alongside existing "No credit card" and "5 free listings"
- Platform logos trust bar (new strip directly below hero): Vinted, eBay, Gumtree SVGs from `/public/images/` displayed as "Works with" row

---

## Section 3: "The Problem" Strip (NEW)

Full-bleed visual section between Hero and How It Works. Targets "hate writing listings" / "listing is too time-consuming" search intent.

**Visual:** `stock-overwhelmed.jpg` as full-bleed background with dark overlay
**Copy:** Bold headline ("Most sellers give up before they start") + 2-sentence body about the manual listing problem
**Purpose:** Emotional hook + SEO keyword injection for problem-aware searches

---

## Section 4: How It Works

**Current:** 3 bento cards with emoji fallbacks (📸, ✨, 🚀)

**Changes:**
- Replace emoji fallbacks with Lottie animations:
  - Step 1 (Upload): `scan-to-pay-illustration-in-line-art-style.json`
  - Step 2 (AI): `online-marketplace-website-in-browser-window.json`
  - Step 3 (List): `payment-processed-illustration-in-line-art.json`
- Expand each step description from 2 sentences to 4 — include natural keywords: "barcode", "label scanner", "price suggestion", "marketplace listing", "copy to clipboard"
- Add `HowTo` structured data referencing these 3 steps

---

## Section 5: Features (expanded)

**Current:** 8 bento cards, 1-sentence descriptions

**Changes:**
- Expand every card to 3-4 sentences of natural, keyword-rich copy
- Add Lottie animation or stock image to 3 key cards:
  - "Data-Driven Pricing" card: `growing-deposit-illustration-in-line-art-style.json`
  - "Professional Images" card: `stock-neutral-pile.jpg` as card header image
  - "Multi-Platform Support" card: platform logos (Vinted/eBay/Gumtree SVGs) inline
- Add 2 missing features as new cards: "eBay Direct Posting" and "Smart Clipboard"
- Total: 10 feature cards

**Keyword targets per card:**
- AI Descriptions: "AI product description generator", "marketplace listing copy"
- Pricing: "how to price second hand items UK", "eBay sold listings price research"
- Image tools: "blur detection", "photo enhancement for selling"
- Keywords: "Vinted hashtags", "eBay search keywords"
- Flaw detection: "honest listing", "condition description"
- Stock finder: "product images for listings"
- eBay posting: "post to eBay automatically", "eBay listing tool"
- Smart Clipboard: "copy listing to Vinted", "Gumtree listing copy paste"

---

## Section 6: "Why AI Over Manual Listing" (NEW EDITORIAL)

~250-word editorial section between Features and Audience. Positioned as helpful content, not a sales pitch.

**Visual:** `stock-sorting.jpg` beside the text (split layout on desktop, stacked on mobile)
**Headline:** "Why Smart Sellers Are Switching to AI"
**Copy:** Covers the time cost of manual listing (researching comps, writing copy, finding keywords), what AI changes, and a genuine note about editing the result. Targets: "AI listing generator UK", "how to sell more on Vinted", "is it worth using AI for eBay listings"

---

## Section 7: Target Audience

**Current:** 2 bento cards with `stock-mother-daughter.jpg` and `stock-wardrobe.jpg`

**Changes:**
- Casual Declutterers: swap to `stock-sorting.jpg` (more relatable action shot)
- Power Sellers: swap to `stock-clothes-rail.jpg` (professional rail of clothing)
- Expand bullet points from 4 to 6 per card with keyword-relevant copy

---

## Section 8: FAQ (expanded)

**Current:** 3 questions, no schema, bento grid layout

**Changes:**
- Expand to 12 questions with 3-4 sentence answers each
- Add `FAQPage` JSON-LD referencing all 12 Q&As
- Layout: clean accordion-style within a single full-width bento card, or 2-column grid for desktop

**12 questions targeting real UK search queries:**
1. Is QuickList AI free? (free tier, upgrade)
2. Which marketplaces are supported? (Vinted, eBay, Gumtree)
3. How accurate is the AI? (editable, quality)
4. How do I write a good Vinted listing? (long-tail, practical)
5. What should I write in an eBay listing description? (high volume)
6. How do I price second-hand items in the UK? (pricing intent)
7. Can AI generate eBay listings automatically? (direct intent)
8. How long does it take to create a listing with AI? (time objection)
9. Does it work for all types of items? (scope question)
10. Is the AI listing good enough to post straight away? (quality objection)
11. Can I post directly to eBay from QuickList? (eBay integration)
12. What's the difference between the free and paid plans? (conversion)

---

## Section 9: Final CTA

**Current:** Yellow bento card, basic copy

**Changes:**
- Add `woman-with-shopping-bags-illustration.json` Lottie animation to the left side of the CTA card (desktop split layout)
- Refine headline: "Your Next Sale Starts with One Photo"
- Sub-copy includes "UK's fastest AI listing tool" for geo + intent signal

---

## Implementation Notes

- All Lottie players use the existing `@lottiefiles/lottie-player` CDN already in the page
- Lottie player syntax: `<lottie-player src="/json_anim/filename.json" background="transparent" speed="1" loop autoplay></lottie-player>`
- Stock images: always include `width`, `height`, `loading="lazy"`, `decoding="async"`, descriptive `alt`
- All new JSON-LD goes in `<head>` alongside existing schemas
- Internal links: Photo Tips linked from "professional photos" copy, Pricing linked from FAQ answer 12, Checklist linked from "before you list" copy
- After editing `index.html`, sync to `public/index.html` with `cp index.html public/index.html`

---

## Files Changed

- `index.html` — all content and structured data changes
- `public/index.html` — synced copy
