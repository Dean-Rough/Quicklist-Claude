# Marketing Page SEO & Visual Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the marketing landing page with deep SEO content, rich structured data (FAQPage + HowTo schemas), Lottie animations, and polished stock photography across all sections.

**Architecture:** All changes are in `index.html` (source of truth). After all tasks, sync with `cp index.html public/index.html`. No server changes. New sections slot between existing ones using HTML comments as landmarks. Lottie web component added via CDN script tag.

**Tech Stack:** Vanilla HTML/CSS, `@lottiefiles/lottie-player` web component (CDN), existing stock images at `/public/images/`, existing Lottie JSONs at `/public/json_anim/`

---

## Context for every task

- Edit `index.html` (root of repo), NOT `public/index.html` — sync happens at the end
- CSS lives in `public/css/styles.css` — add new classes there when needed
- The marketing page sections are inside `<main id="marketingView">` → `<div id="homeView">`
- Existing section order: Hero → How It Works → Features → Target Audience → FAQ → Final CTA
- After every task: open `http://localhost:4577` and confirm the section looks correct visually, no console errors
- Run dev server with `npm run dev` (port 4577)

---

## Task 1: Add lottie-player CDN + FAQPage and HowTo JSON-LD to `<head>`

**Files:**
- Modify: `index.html` — in `<head>`, after the existing `</script>` that closes the WebSite JSON-LD block (around line 107)

**Step 1: Add lottie-player script tag**

Find this line in `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
```

Add immediately after it:
```html
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js" defer></script>
```

**Step 2: Add FAQPage JSON-LD**

Find the closing `</script>` of the WebSite JSON-LD block (the one with `"@type": "WebSite"`). Add this new script block immediately after it:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is QuickList AI free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, QuickList AI has a free tier that gives you 5 listings per month with no credit card required. You can upgrade to Casual (£4.99/month), Pro (£9.99/month), or Max (£19.99/month) for more listings and premium features like image enhancement, real-time market data, and direct eBay posting."
        }
      },
      {
        "@type": "Question",
        "name": "Which marketplaces does QuickList AI support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "QuickList AI currently generates optimised listings for Vinted, eBay, and Gumtree. Each platform gets a tailored listing — different tone, format, and keyword strategy to match what buyers on that platform expect. More platforms are on the roadmap."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate is the AI-generated listing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Very accurate for brand names, categories, conditions, and pricing — especially when your photos include labels or tags. The AI reads barcodes and product codes automatically. Every field is editable before you post, so you can always tweak the copy to match your voice."
        }
      },
      {
        "@type": "Question",
        "name": "How do I write a good Vinted listing?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A strong Vinted listing needs a clear title with the brand name and size, an honest condition description, and the right hashtags so buyers can find it. QuickList AI generates all of this from your photos automatically — including platform-specific hashtags that match Vinted's search algorithm."
        }
      },
      {
        "@type": "Question",
        "name": "What should I write in an eBay listing description?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "eBay listings perform best with a keyword-rich title (80 characters), a structured description covering condition, measurements, and any flaws, and the correct item specifics. QuickList AI generates all of this from your photos, including suggested item specifics and a competitive price based on recent eBay sold listings."
        }
      },
      {
        "@type": "Question",
        "name": "How do I price second-hand items in the UK?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The most reliable method is checking recently sold listings — not just asking prices — on eBay and Vinted. QuickList AI does this automatically and gives you a price suggestion based on what items like yours have actually sold for. You can always adjust the price before posting."
        }
      },
      {
        "@type": "Question",
        "name": "Can AI generate eBay listings automatically?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. QuickList AI generates a complete eBay listing from your photos — title, description, condition, price, category, and keywords. With a Pro or Max plan you can post directly to eBay without leaving the app."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to create a listing with QuickList AI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "About 30–60 seconds per item from photo upload to finished listing. That includes AI analysis, description generation, price research, and keyword optimisation. Compare that to 10–15 minutes of manual research and writing per item."
        }
      },
      {
        "@type": "Question",
        "name": "Does QuickList AI work for all types of items?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "QuickList AI works best for clothing, electronics, books, homeware, toys, and branded goods — anything with identifiable labels, barcodes, or product codes. It handles general items too, though the more information visible in the photos, the more detailed the listing."
        }
      },
      {
        "@type": "Question",
        "name": "Is the AI-generated listing good enough to post straight away?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Most of the time, yes — especially for standard branded items. The AI identifies the product, writes the description, and suggests a competitive price. Some sellers post directly; others do a quick read-through and tweak a sentence or two. Either way it's far faster than starting from scratch."
        }
      },
      {
        "@type": "Question",
        "name": "Can I post directly to eBay from QuickList AI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, with a Pro or Max plan. Connect your eBay account once and QuickList AI can post listings directly without you needing to copy and paste anything. For Vinted and Gumtree, use the Smart Clipboard feature to copy your listing with one tap and paste it straight into the app."
        }
      },
      {
        "@type": "Question",
        "name": "What is the difference between the free and paid plans?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The free plan gives 5 listings per month — enough to try the app and list occasional items. Paid plans unlock more listings per month, real-time market pricing data, AI image enhancement, blur detection and fixing, hero image generation, and direct eBay posting. See the Pricing page for a full comparison."
        }
      }
    ]
  }
</script>
```

**Step 3: Add HowTo JSON-LD**

Immediately after the FAQPage script block, add:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Create a Marketplace Listing with AI",
    "description": "Turn product photos into professional listings for Vinted, eBay, and Gumtree in three steps using QuickList AI.",
    "totalTime": "PT1M",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Upload Your Photos",
        "text": "Take photos of your item from different angles and upload them to QuickList AI. The AI reads labels, tags, barcodes, and care instructions automatically — no special setup needed.",
        "url": "https://quicklist.it.com/#how-it-works"
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "AI Generates Everything",
        "text": "The AI identifies your product, writes a professional description, suggests a competitive price based on real sold listings, and generates the best keywords for your chosen platform.",
        "url": "https://quicklist.it.com/#how-it-works"
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Download and List",
        "text": "Review your listing, make any edits, then download everything as a ZIP file or use Smart Clipboard to paste directly into Vinted, eBay, or Gumtree.",
        "url": "https://quicklist.it.com/#how-it-works"
      }
    ]
  }
</script>
```

**Step 4: Update SoftwareApplication featureList**

Find the existing `SoftwareApplication` JSON-LD (around line 71). Replace the `featureList` array with:

```json
"featureList": [
  "AI-Powered Descriptions",
  "Optimized Titles and Categories",
  "Data-Driven Pricing from Real Sold Listings",
  "Professional Image Enhancement",
  "Blur Detection and Fixing",
  "Hero Image Generation",
  "Honest Flaw and Damage Detection",
  "Stock Image Finder",
  "Label and Barcode Scanner",
  "Keywords and Hashtags",
  "Direct eBay Posting",
  "Smart Clipboard for Vinted and Gumtree",
  "Multi-Platform Support (Vinted, eBay, Gumtree)"
]
```

**Step 5: Verify**

Open `http://localhost:4577`. No visible change expected — this is head-only.
Check browser console for JSON parse errors.
Paste the page URL into Google's Rich Results Test: `https://search.google.com/test/rich-results` — should show FAQPage and HowTo eligible.

**Step 6: Commit**

```bash
git add index.html
git commit -m "feat(seo): add FAQPage + HowTo JSON-LD and lottie-player CDN"
```

---

## Task 2: Hero section — copy refresh + platform logos trust bar

**Files:**
- Modify: `index.html` — Hero section (inside `<section class="hero">`)

**Step 1: Update hero headline and sub-copy**

Find and replace the `<h1>` and `<p>` in the hero:

Replace:
```html
<h1>Turn Your Clutter Into Cash with AI</h1>
<p>
  Stop staring at that overflowing drawer. QuickList AI transforms your photos into
  professional marketplace listings in seconds. Perfect for Vinted, eBay, and Gumtree.
</p>
```

With:
```html
<h1>Turn Your Clutter Into Cash — In Minutes</h1>
<p>
  QuickList AI is the UK's fastest AI listing generator for Vinted, eBay, and Gumtree.
  Upload a photo, get a complete professional listing with a competitive price, the right
  keywords, and an honest description. No writing, no research, no hassle.
</p>
```

**Step 2: Add third trust signal**

Find the trust signals `<div>` (the flex row with "No credit card required" and "5 free listings per month"). Add a third item:

```html
<div style="display: flex; align-items: center; gap: 0.5rem">
  <span style="color: var(--success); font-weight: 600"><svg width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      style="display: inline-block; vertical-align: middle">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg></span>
  <span style="color: var(--text-secondary)">Ready to list in under a minute</span>
</div>
```

**Step 3: Add platform logos trust bar after the hero section**

Find the closing `</section>` of the hero section. Insert this new section immediately after it:

```html
<!-- Platform logos trust bar -->
<div class="platform-trust-bar" aria-label="Supported marketplaces">
  <span class="platform-trust-label">Works with</span>
  <div class="platform-trust-logos">
    <img src="/images/logo-vinted.svg" alt="Vinted" width="80" height="28" loading="lazy" decoding="async" />
    <img src="/images/logo-ebay.svg" alt="eBay" width="60" height="28" loading="lazy" decoding="async" />
    <img src="/images/logo-gumtree.svg" alt="Gumtree" width="90" height="28" loading="lazy" decoding="async" />
  </div>
</div>
```

**Step 4: Add CSS for platform-trust-bar**

Open `public/css/styles.css`. At the end of the file, add:

```css
/* Platform trust bar */
.platform-trust-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 1.25rem 1.5rem;
  background: var(--surface);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.platform-trust-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.platform-trust-logos {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.platform-trust-logos img {
  opacity: 0.65;
  filter: grayscale(1);
  transition: opacity 0.2s, filter 0.2s;
}

.platform-trust-logos img:hover {
  opacity: 1;
  filter: grayscale(0);
}
```

**Step 5: Verify**

Load `http://localhost:4577`. Check:
- Hero headline reads "Turn Your Clutter Into Cash — In Minutes"
- Three trust signals show below CTA buttons
- Platform logos bar appears below the hero with Vinted, eBay, Gumtree logos
- No broken image icons (logos exist at `/public/images/`)

**Step 6: Commit**

```bash
git add index.html public/css/styles.css
git commit -m "feat(marketing): refresh hero copy and add platform logos trust bar"
```

---

## Task 3: New "The Problem" strip

**Files:**
- Modify: `index.html` — insert new section between platform logos bar and How It Works

**Step 1: Insert the section**

Find the `<!-- How It Works -->` comment (or the `<section class="section" aria-labelledby="how-it-works-title">`). Insert this section immediately before it:

```html
<!-- The Problem Strip -->
<section class="problem-strip" aria-label="Why listing takes so long">
  <div class="problem-strip-bg" style="background-image: url('/images/stock-overwhelmed.jpg')" role="img" aria-label="Person overwhelmed by items to sell"></div>
  <div class="problem-strip-overlay">
    <div class="container">
      <h2 class="problem-strip-headline">Most sellers give up before they start</h2>
      <p class="problem-strip-body">
        Writing a good listing means researching prices, finding the right keywords,
        describing every flaw honestly, and doing it all again for the next item. For most
        people, it's easier to just keep the stuff. QuickList AI does the hard part for
        you — in seconds.
      </p>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

In `public/css/styles.css`, after the platform-trust-bar styles, add:

```css
/* Problem strip */
.problem-strip {
  position: relative;
  overflow: hidden;
  min-height: 320px;
  display: flex;
  align-items: center;
}

.problem-strip-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 30%;
  filter: brightness(0.45) saturate(0.7);
}

.problem-strip-overlay {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 4rem 0;
}

.problem-strip-headline {
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  color: #fff;
  margin-bottom: 1rem;
  max-width: 700px;
}

.problem-strip-body {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.85);
  max-width: 600px;
  line-height: 1.7;
}
```

**Step 3: Verify**

Load `http://localhost:4577`. Scroll below the platform bar. The full-bleed image section should appear with a dark overlay and white headline copy. Check mobile view — headline should be readable at small widths.

**Step 4: Commit**

```bash
git add index.html public/css/styles.css
git commit -m "feat(marketing): add problem strip section with full-bleed stock photo"
```

---

## Task 4: How It Works — Lottie animations + expanded copy

Add `id="how-it-works"` to the section for HowTo JSON-LD anchor, swap emoji fallbacks for Lottie animations, and expand step descriptions.

**Files:**
- Modify: `index.html` — `<section aria-labelledby="how-it-works-title">`

**Step 1: Add section id**

Find:
```html
<section class="section" aria-labelledby="how-it-works-title">
```

Replace with:
```html
<section class="section" id="how-it-works" aria-labelledby="how-it-works-title">
```

**Step 2: Replace Step 1 animation fallback and expand copy**

Find the Step 1 bento cell. Locate the `<div id="step1-animation" ...>` block and its `<h3>` / `<p>`:

Replace the full Step 1 `<div id="step1-animation" ...>...</div>` with:
```html
<div id="step1-animation" class="step-image" style="height: 260px; width: 100%; margin-bottom: 1.5rem;">
  <lottie-player
    src="/json_anim/scan-to-pay-illustration-in-line-art-style-2025-10-20-04-28-23-utc.json"
    background="transparent"
    speed="0.8"
    style="width: 100%; height: 260px;"
    loop
    autoplay
    aria-label="Scanning item illustration">
  </lottie-player>
</div>
```

Replace the Step 1 `<h3>` and `<p>`:
```html
<h3>Upload Your Photos</h3>
<p>
  Take photos of your item from different angles — front, back, labels, and any
  flaws. QuickList AI reads brand labels, size tags, barcodes, and product codes
  automatically, so the more you show the camera, the more detailed your listing
  will be. No special lighting or backgrounds required.
</p>
```

**Step 3: Replace Step 2 animation fallback and expand copy**

Replace the full Step 2 `<div id="step2-animation" ...>...</div>` with:
```html
<div id="step2-animation" class="step-image" style="height: 260px; width: 100%; margin-bottom: 1.5rem;">
  <lottie-player
    src="/json_anim/online-marketplace-website-in-browser-window-2025-11-05-04-21-50-utc.json"
    background="transparent"
    speed="0.8"
    style="width: 100%; height: 260px;"
    loop
    autoplay
    aria-label="AI processing illustration">
  </lottie-player>
</div>
```

Replace the Step 2 `<h3>` and `<p>`:
```html
<h3>AI Generates Everything</h3>
<p>
  Our AI identifies your product, writes a marketplace-ready description, and
  suggests a competitive price based on what similar items have recently sold for
  on eBay and Vinted. It also generates platform-specific keywords and hashtags
  to maximise your listing's visibility — all in under a minute.
</p>
```

**Step 4: Replace Step 3 animation fallback and expand copy**

Replace the full Step 3 `<div id="step3-animation" ...>...</div>` with:
```html
<div id="step3-animation" class="step-image" style="height: 260px; width: 100%; margin-bottom: 1.5rem;">
  <lottie-player
    src="/json_anim/payment-processed-illustration-in-line-art-2025-10-20-04-29-39-utc.json"
    background="transparent"
    speed="0.8"
    style="width: 100%; height: 260px;"
    loop
    autoplay
    aria-label="Completed listing illustration">
  </lottie-player>
</div>
```

Replace the Step 3 `<h3>` and `<p>`:
```html
<h3>List in Seconds</h3>
<p>
  Review your professional listing, make any edits, then use Smart Clipboard to
  copy it directly into Vinted, eBay, or Gumtree with one tap. Or download
  everything as a ZIP file including your enhanced photos. Pro and Max users can
  post directly to eBay without leaving the app.
</p>
```

**Step 5: Verify**

Load `http://localhost:4577`. Scroll to How It Works. Three Lottie animations should play in the bento cards. Check mobile. If a Lottie fails to load (wrong filename), check filenames in `/public/json_anim/` match exactly.

**Step 6: Commit**

```bash
git add index.html
git commit -m "feat(marketing): add Lottie animations and expanded copy to How It Works"
```

---

## Task 5: Features — expanded copy, 2 new cards, visual accents

**Files:**
- Modify: `index.html` — `<section aria-labelledby="features-title">`

**Step 1: Replace the entire features bento grid**

Find the `<div class="bento-grid">` inside the features section (after `<h2 id="features-title">`). Replace the entire bento-grid div (8 cards) with this 10-card version:

```html
<div class="bento-grid">
  <div class="bento-cell bento-span-4 bento-cream">
    <h3>AI-Powered Descriptions</h3>
    <p>
      QuickList AI writes marketplace-ready descriptions in the style that buyers on
      each platform respond to — conversational for Vinted, detailed and keyword-rich
      for eBay, local and direct for Gumtree. Every description is editable, so you
      can add your personal touch before posting.
    </p>
  </div>
  <div class="bento-cell bento-span-4 bento-green">
    <h3>Optimized Titles &amp; Categories</h3>
    <p>
      A strong title is the biggest factor in whether your listing gets found. Our AI
      generates titles that hit the character limits, include the brand name and key
      attributes, and match how buyers actually search. Categories are assigned
      automatically based on your item.
    </p>
  </div>
  <div class="bento-cell bento-span-4 bento-teal">
    <div style="margin-bottom: 1rem; height: 120px; overflow: hidden; border-radius: 8px;">
      <lottie-player
        src="/json_anim/growing-deposit-illustration-in-line-art-style-2025-10-20-04-38-50-utc.json"
        background="transparent"
        speed="0.7"
        style="width: 100%; height: 120px;"
        loop
        autoplay
        aria-label="Pricing data illustration">
      </lottie-player>
    </div>
    <h3>Data-Driven Pricing</h3>
    <p>
      Stop guessing and stop undercharging. QuickList AI pulls real sold-listing data
      from eBay and Vinted to suggest the right price for your item's condition, brand,
      and category. Price too high and it won't sell; too low and you're leaving money
      behind — the AI finds the sweet spot.
    </p>
  </div>
  <div class="bento-cell bento-span-6 bento-pink">
    <img src="/images/stock-neutral-pile.jpg"
      alt="Items laid out ready to photograph for selling"
      width="800" height="200"
      loading="lazy" decoding="async"
      style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />
    <h3>Professional Image Tools</h3>
    <p>
      Good photos sell faster. QuickList AI detects blurry images and offers to fix
      them, enhances colours and contrast, and can generate clean hero product images
      using AI. You can also find official manufacturer stock images to supplement
      your own photos — all from inside the app.
    </p>
  </div>
  <div class="bento-cell bento-span-6 bento-lavender">
    <h3>Keywords &amp; Hashtags</h3>
    <p>
      Each platform has its own search algorithm. QuickList AI generates platform-specific
      keywords for eBay item specifics and Vinted hashtags that match real search behaviour,
      so your listing appears in more searches without any extra effort on your part.
    </p>
  </div>
  <div class="bento-cell bento-span-4 bento-yellow">
    <h3>Honest Flaw Detection</h3>
    <p>
      The AI identifies visible damage, stains, wear, and imperfections from your photos
      and includes them in the listing automatically. Honest descriptions reduce returns,
      protect your seller rating, and build trust with buyers — especially important on
      Vinted where buyer feedback matters.
    </p>
  </div>
  <div class="bento-cell bento-span-4 bento-cream">
    <h3>Stock Image Finder</h3>
    <p>
      For branded items, QuickList AI automatically searches for official manufacturer
      product images to supplement your own photos. Clean product shots alongside your
      real photos give buyers the full picture and make your listing stand out in search
      results.
    </p>
  </div>
  <div class="bento-cell bento-span-4 bento-green">
    <h3>Multi-Platform Support</h3>
    <p>
      One photo, three listings. QuickList AI generates separately optimised listings for
      Vinted, eBay, and Gumtree — each formatted, toned, and keyworded for that specific
      platform's audience. Switch between platforms instantly without re-entering any
      information.
    </p>
  </div>
  <div class="bento-cell bento-span-6 bento-teal">
    <h3>Direct eBay Posting</h3>
    <p>
      Connect your eBay account once and post listings directly from QuickList AI without
      copying and pasting. Your photos, title, description, price, and category are all
      submitted to eBay automatically. Available on Pro and Max plans — the fastest way
      to list on eBay in the UK.
    </p>
  </div>
  <div class="bento-cell bento-span-6 bento-pink">
    <h3>Smart Clipboard</h3>
    <p>
      For Vinted and Gumtree, Smart Clipboard formats your listing for each platform and
      copies it to your clipboard with one tap. Open the app, paste, and you're done.
      QuickList AI even reminds you of the right fields to fill in for each platform so
      nothing gets missed.
    </p>
  </div>
</div>
```

**Step 2: Verify**

Load `http://localhost:4577`. Scroll to features. Should now show 10 cards. The Pricing card should have a Lottie animation above the heading. The Professional Images card should have a stock photo. Check mobile stacking.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat(marketing): expand features to 10 cards with full copy, Lottie and stock image accents"
```

---

## Task 6: New "Why AI Over Manual Listing" editorial section

**Files:**
- Modify: `index.html` — insert between features section closing `</section>` and Target Audience section

**Step 1: Insert the section**

Find the closing `</section>` of the features section. Insert immediately after it:

```html
<!-- Why AI editorial section -->
<section class="section why-ai-section" aria-labelledby="why-ai-title">
  <div class="container">
    <div class="why-ai-grid">
      <div class="why-ai-image">
        <img src="/images/stock-sorting.jpg"
          alt="Seller sorting through items to list online"
          width="800" height="600"
          loading="lazy" decoding="async"
          style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" />
      </div>
      <div class="why-ai-content">
        <h2 id="why-ai-title">Why Smart Sellers Are Switching to AI</h2>
        <p>
          Listing one item manually takes around 10–15 minutes when you factor in
          researching the right price, writing a description that sounds professional,
          figuring out which keywords will get your item found, and uploading the photos.
          Do that ten times and you've lost two hours.
        </p>
        <p>
          AI listing generators don't replace your judgement — they remove the tedious
          parts. QuickList AI reads your photos, researches the market, and produces a
          complete draft in under a minute. You review it, adjust anything that doesn't
          sound right, and post. Most sellers find they spend about 30 seconds editing
          rather than 10 minutes writing.
        </p>
        <p>
          For UK sellers on Vinted, eBay, and Gumtree, the difference adds up fast. More
          listings in less time means more chances to sell — and consistent, well-written
          listings tend to sell faster and for more than rushed ones.
        </p>
        <p>
          Need tips on getting better photos for your listings?
          <a onclick="app.navigateTo('photoTips')" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">
            Read our photography guide
          </a>
          or check the
          <a onclick="app.navigateTo('checklist')" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">
            seller checklist
          </a>
          before you start.
        </p>
        <button class="btn btn-primary" onclick="app.showAuthModal()" style="margin-top: 1.5rem;">
          Try It Free
        </button>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

In `public/css/styles.css`, add:

```css
/* Why AI section */
.why-ai-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.why-ai-image {
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
}

.why-ai-content h2 {
  margin-bottom: 1.5rem;
}

.why-ai-content p {
  color: var(--text-secondary);
  line-height: 1.75;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .why-ai-grid {
    grid-template-columns: 1fr;
  }

  .why-ai-image {
    aspect-ratio: 16 / 9;
  }
}
```

**Step 3: Verify**

Load `http://localhost:4577`. Scroll to the new section. On desktop: two-column layout with image left, text right. On mobile: image stacked above text. Internal links to Photo Tips and Checklist should work (clicking navigates to those pages).

**Step 4: Commit**

```bash
git add index.html public/css/styles.css
git commit -m "feat(marketing): add Why AI editorial section with internal links"
```

---

## Task 7: Target Audience — image swap + expanded bullets

**Files:**
- Modify: `index.html` — `<section aria-labelledby="target-audience-title">`

**Step 1: Swap Casual Declutterers image and expand bullets**

Find the Casual Declutterers bento card. Replace its `<img>` tag:

Old:
```html
<img src="/images/stock-mother-daughter.jpg" alt="Mother and daughter sorting through clothes together" ...
```

New:
```html
<img src="/images/stock-sorting.jpg"
  alt="Person sorting through items to sell online"
  width="1280" height="853" decoding="async"
  style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 1.5rem;"
  loading="lazy" />
```

Replace the Casual Declutterers `<ul>`:
```html
<ul style="list-style: none; padding: 0">
  <li>Got stuff to sell but hate writing descriptions</li>
  <li>Want to make money without hours of research</li>
  <li>Need quick, professional listings that actually sell</li>
  <li>Selling on Vinted, eBay, or Gumtree occasionally</li>
  <li>Want accurate pricing without checking sold listings manually</li>
  <li>Looking for an easy way to clear a wardrobe or house</li>
</ul>
```

**Step 2: Swap Power Sellers image and expand bullets**

Find the Power Sellers bento card. Replace its `<img>` tag:

Old:
```html
<img src="/images/stock-wardrobe.jpg" alt="Colorful clothes hanging on a rail ready to sell" ...
```

New:
```html
<img src="/images/stock-clothes-rail.jpg"
  alt="Organised clothes rail ready for listing and selling"
  width="1280" height="853" decoding="async"
  style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 1.5rem;"
  loading="lazy" />
```

Replace the Power Sellers `<ul>`:
```html
<ul style="list-style: none; padding: 0">
  <li>Process tens or hundreds of items efficiently</li>
  <li>Maintain consistent listing quality across all items</li>
  <li>Save hours of manual research and writing per week</li>
  <li>Scale your resale business without hiring extra help</li>
  <li>Post to eBay directly without copy-pasting</li>
  <li>Use real market data to price competitively and sell faster</li>
</ul>
```

**Step 3: Verify**

Load `http://localhost:4577`. Scroll to audience section. New stock photos should display. Six bullets per card.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat(marketing): update audience section images and expand bullet copy"
```

---

## Task 8: FAQ — expand to 12 questions with accordion layout

**Files:**
- Modify: `index.html` — `<section aria-labelledby="faq-title">`

**Step 1: Add FAQ CSS**

In `public/css/styles.css`, add:

```css
/* FAQ accordion */
.faq-accordion {
  max-width: 860px;
  margin: 0 auto;
}

.faq-item {
  border-bottom: 1px solid var(--border-color);
}

.faq-item:first-child {
  border-top: 1px solid var(--border-color);
}

.faq-item summary {
  list-style: none;
  cursor: pointer;
  padding: 1.25rem 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-item summary::after {
  content: '';
  width: 20px;
  height: 20px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-size: contain;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.faq-item[open] summary::after {
  transform: rotate(180deg);
}

.faq-item .faq-answer {
  padding: 0 0 1.25rem;
  color: var(--text-secondary);
  line-height: 1.75;
  font-size: 1rem;
}
```

**Step 2: Replace the FAQ section content**

Find the entire FAQ section (from `<section class="section" aria-labelledby="faq-title">` to its closing `</section>`). Replace it entirely with:

```html
<!-- FAQ -->
<section class="section" aria-labelledby="faq-title">
  <div class="container">
    <h2 id="faq-title" class="section-title">Frequently Asked Questions</h2>
    <p style="text-align: center; color: var(--text-secondary); font-size: 1.1rem; max-width: 800px; margin: 0 auto 3rem;">
      Everything you need to know about QuickList AI. Can't find your answer?
      <a onclick="app.showAuthModal()" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">Sign up free</a>
      and try it for yourself.
    </p>
    <div class="faq-accordion">

      <details class="faq-item">
        <summary>Is QuickList AI free?</summary>
        <div class="faq-answer">
          Yes, QuickList AI has a free tier that gives you 5 listings per month with no credit card required.
          You can upgrade to Casual (£4.99/month), Pro (£9.99/month), or Max (£19.99/month) for more listings
          and premium features like image enhancement, real-time market data, and direct eBay posting.
          See the <a onclick="app.navigateTo('pricing')" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">pricing page</a> for a full comparison.
        </div>
      </details>

      <details class="faq-item">
        <summary>Which marketplaces does QuickList AI support?</summary>
        <div class="faq-answer">
          QuickList AI currently generates optimised listings for Vinted, eBay, and Gumtree. Each platform
          gets a tailored listing — different tone, format, and keyword strategy to match what buyers on
          that platform expect. More platforms are on the roadmap.
        </div>
      </details>

      <details class="faq-item">
        <summary>How accurate is the AI-generated listing?</summary>
        <div class="faq-answer">
          Very accurate for brand names, categories, conditions, and pricing — especially when your photos
          include labels or tags. The AI reads barcodes and product codes automatically. Every field is
          editable before you post, so you can always tweak the copy to match your voice.
        </div>
      </details>

      <details class="faq-item">
        <summary>How do I write a good Vinted listing?</summary>
        <div class="faq-answer">
          A strong Vinted listing needs a clear title with the brand name and size, an honest condition
          description, and the right hashtags so buyers can find it. QuickList AI generates all of this
          from your photos automatically — including platform-specific hashtags that match Vinted's search
          algorithm. Read our <a onclick="app.navigateTo('photoTips')" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">photography tips</a> for better input photos.
        </div>
      </details>

      <details class="faq-item">
        <summary>What should I write in an eBay listing description?</summary>
        <div class="faq-answer">
          eBay listings perform best with a keyword-rich title (80 characters), a structured description
          covering condition, measurements, and any flaws, and the correct item specifics. QuickList AI
          generates all of this from your photos, including suggested item specifics and a competitive
          price based on recent eBay sold listings.
        </div>
      </details>

      <details class="faq-item">
        <summary>How do I price second-hand items in the UK?</summary>
        <div class="faq-answer">
          The most reliable method is checking recently sold listings — not just asking prices — on eBay
          and Vinted. QuickList AI does this automatically and gives you a price suggestion based on what
          items like yours have actually sold for. You can always adjust the price before posting.
        </div>
      </details>

      <details class="faq-item">
        <summary>Can AI generate eBay listings automatically?</summary>
        <div class="faq-answer">
          Yes. QuickList AI generates a complete eBay listing from your photos — title, description,
          condition, price, category, and keywords. With a Pro or Max plan you can post directly to eBay
          without leaving the app.
        </div>
      </details>

      <details class="faq-item">
        <summary>How long does it take to create a listing?</summary>
        <div class="faq-answer">
          About 30–60 seconds per item from photo upload to finished listing. That includes AI analysis,
          description generation, price research, and keyword optimisation. Compare that to 10–15 minutes
          of manual research and writing per item.
        </div>
      </details>

      <details class="faq-item">
        <summary>Does QuickList AI work for all types of items?</summary>
        <div class="faq-answer">
          QuickList AI works best for clothing, electronics, books, homeware, toys, and branded goods —
          anything with identifiable labels, barcodes, or product codes. It handles general items too,
          though the more information visible in your photos, the more detailed the listing.
        </div>
      </details>

      <details class="faq-item">
        <summary>Is the AI listing good enough to post straight away?</summary>
        <div class="faq-answer">
          Most of the time, yes — especially for standard branded items. The AI identifies the product,
          writes the description, and suggests a competitive price. Some sellers post directly; others do
          a quick read-through and tweak a sentence or two. Either way it's far faster than starting from
          scratch.
        </div>
      </details>

      <details class="faq-item">
        <summary>Can I post directly to eBay from QuickList AI?</summary>
        <div class="faq-answer">
          Yes, with a Pro or Max plan. Connect your eBay account once and QuickList AI can post listings
          directly without you needing to copy and paste anything. For Vinted and Gumtree, use the Smart
          Clipboard feature to copy your listing with one tap and paste it straight into the app.
        </div>
      </details>

      <details class="faq-item">
        <summary>What is the difference between the free and paid plans?</summary>
        <div class="faq-answer">
          The free plan gives 5 listings per month — enough to try the app and list occasional items.
          Paid plans unlock more listings per month, real-time market pricing data, AI image enhancement,
          blur detection and fixing, hero image generation, and direct eBay posting. See the full
          <a onclick="app.navigateTo('pricing')" style="cursor: pointer; color: var(--accent-teal); text-decoration: underline;">pricing comparison</a>.
        </div>
      </details>

    </div>
  </div>
</section>
```

**Step 3: Verify**

Load `http://localhost:4577`. Scroll to FAQ. Should show 12 accordion items, all closed. Click one — it should expand and show a chevron rotation. Check that internal links (Photo Tips, Pricing) navigate correctly.

**Step 4: Commit**

```bash
git add index.html public/css/styles.css
git commit -m "feat(marketing): expand FAQ to 12 questions with native accordion and internal links"
```

---

## Task 9: Final CTA — Lottie + refined copy

**Files:**
- Modify: `index.html` — `<section aria-label="Call to action">`

**Step 1: Replace the Final CTA section content**

Find the existing `<section aria-label="Call to action">` block. Replace the inner `bento-cell` content:

Old (inside the yellow bento cell):
```html
<h2 style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--dark)">
  Ready to Turn Clutter into Cash?
</h2>
<p style="...">
  Take a photo and let our AI do the rest. Your first listing takes about a minute.
</p>
```

Replace the entire yellow bento cell content with:
```html
<div class="cta-split">
  <div class="cta-animation" aria-hidden="true">
    <lottie-player
      src="/json_anim/new/woman-with-shopping-bags-illustration-2025-10-20-04-38-51-utc.json"
      background="transparent"
      speed="0.8"
      style="width: 100%; height: 280px;"
      loop
      autoplay>
    </lottie-player>
  </div>
  <div class="cta-text">
    <h2 style="font-size: 2.25rem; margin-bottom: 1rem; color: var(--dark)">
      Your Next Sale Starts with One Photo
    </h2>
    <p style="font-size: 1.25rem; color: rgba(29, 29, 27, 0.8); margin-bottom: 2rem; line-height: 1.6;">
      Join UK sellers who are listing faster and selling more with AI.
      Take a photo — your first listing is ready in under a minute.
    </p>
    <button class="btn" style="font-size: 1.1rem; padding: 1rem 2rem; background: var(--dark); color: var(--cream);"
      onclick="app.showAuthModal()" aria-label="Start creating listings with QuickList AI">
      Get Started Now — It's Free
    </button>
    <p style="margin-top: 1.5rem; color: rgba(29, 29, 27, 0.6); font-size: 0.9rem">
      No credit card required &bull; 5 free listings per month &bull; Cancel anytime
    </p>
  </div>
</div>
```

**Step 2: Add CSS**

In `public/css/styles.css`, add:

```css
/* Final CTA split layout */
.cta-split {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 2rem;
  align-items: center;
  text-align: left;
}

.cta-animation {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .cta-split {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .cta-animation {
    display: none;
  }
}
```

**Step 3: Verify**

Load `http://localhost:4577`. Scroll to bottom CTA. On desktop: Lottie animation on left, text and button on right. On mobile: animation hidden, text centred. Button works.

**Step 4: Commit**

```bash
git add index.html public/css/styles.css
git commit -m "feat(marketing): refresh final CTA with Lottie animation and updated copy"
```

---

## Task 10: Sub-page document.title updates in app.js

Each marketing sub-page (Photo Tips, Seller Checklist, Pricing) currently shares the same browser tab title. Add dynamic title updates.

**Files:**
- Modify: `public/js/app.js` — `navigateTo` function at line ~5823

**Step 1: Add title map and update call**

Find the `navigateTo` function body. After `window.scrollTo(0, 0);` and before the closing `},`, add:

```javascript
const titles = {
  home: 'QuickList AI - AI-Powered Listing Generator for Vinted, eBay & Gumtree',
  photoTips: 'Photography Tips for Better Listings | QuickList AI',
  checklist: 'Seller Checklist: Get Ready to List | QuickList AI',
  pricing: 'Pricing Plans | QuickList AI - Free, Casual, Pro & Max',
};
document.title = titles[view] || titles.home;
```

**Step 2: Verify**

Open `http://localhost:4577`. Navigate to Photo Tips via the nav link. Browser tab title should change to "Photography Tips for Better Listings | QuickList AI". Navigate to Pricing — tab should change to "Pricing Plans | QuickList AI - Free, Casual, Pro & Max".

**Step 3: Commit**

```bash
git add public/js/app.js
git commit -m "feat(seo): add dynamic document.title updates for marketing sub-pages"
```

---

## Task 11: Sync to public/ and deploy

**Files:**
- Sync: `index.html` → `public/index.html`

**Step 1: Sync the file**

```bash
cp index.html public/index.html
```

**Step 2: Verify sync**

```bash
diff index.html public/index.html
```

Expected: no output (files are identical).

**Step 3: Final visual check**

Load `http://localhost:4577` and do a full scroll-through of the marketing page:
- [ ] Hero: updated headline, 3 trust signals, platform logos bar
- [ ] Problem strip: full-bleed stock photo with dark overlay and white text
- [ ] How It Works: 3 Lottie animations playing, expanded copy
- [ ] Features: 10 cards, Lottie on pricing card, stock image on image tools card
- [ ] Why AI editorial: 2-column image + text layout
- [ ] Target Audience: updated photos, 6 bullets each
- [ ] FAQ: 12 accordion items, expand/collapse working, internal links working
- [ ] Final CTA: Lottie animation (desktop), updated headline
- [ ] No console errors
- [ ] Mobile: all sections stack correctly

**Step 4: Commit and push**

```bash
git add public/index.html
git commit -m "chore: sync index.html to public/"
git push origin main
```

Vercel will auto-deploy on push to main. Check the Vercel dashboard for deployment status.

---

## Verification Summary

| Task | Visual check | SEO check |
|------|-------------|-----------|
| 1 | No change in UI | Rich Results Test shows FAQPage + HowTo |
| 2 | Hero headline updated, logos bar visible | Keywords in h1 and p |
| 3 | Full-bleed problem strip | Problem-aware keywords in copy |
| 4 | Lottie animations playing in step cards | Expanded keyword-rich copy |
| 5 | 10 feature cards, visual accents | Long-form copy per feature |
| 6 | 2-column editorial section, internal links work | Informational keyword copy |
| 7 | New stock photos in audience cards | Expanded bullets |
| 8 | 12 FAQ accordions expand/collapse | FAQ content matches JSON-LD |
| 9 | Lottie in CTA on desktop | Geo keyword "UK sellers" in copy |
| 10 | Tab title changes on sub-page navigation | Sub-page titles crawlable |
| 11 | Full scroll-through passes | Deploy confirmed on Vercel |
