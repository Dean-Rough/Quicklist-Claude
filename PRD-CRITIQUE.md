# PRD Critical Review — Gaps & Blind Spots

**Reviewer:** Terry (PM)  
**Date:** 2026-02-10  
**Verdict:** PRD is solid foundation but has significant UX flow gaps and missing market-validated features

---

## 1. Flow Gaps Identified

### 1.1 ❌ No Draft Auto-Save
**Current:** User generates listing → must manually save or export
**Risk:** Lost work if browser crashes, tab closed, or user gets distracted
**Fix:** Auto-save drafts to localStorage + DB every 30 seconds

### 1.2 ❌ No "Resume Where You Left Off"
**Current:** No session continuity
**Risk:** Users with ADHD (common in reseller community) lose context
**Fix:** On login, show "Continue with [Item Name]?" modal if draft exists

### 1.3 ❌ Weak Error Recovery in Generation Flow
**Current:** If AI fails, user sees generic error
**Risk:** User doesn't know if it's their photos, the AI, or the network
**Fix:** Specific error states: "Photos too blurry", "Couldn't identify item - try adding more angles", "Server busy, try again"

### 1.4 ❌ No Onboarding Walkthrough
**Current:** User lands on empty dashboard, figures it out
**Risk:** Confusion → bounce. Research shows 30% of new users abandon on first session
**Fix:** 3-step tooltip tour: "1. Upload photos → 2. AI generates → 3. Export to sell"

### 1.5 ❌ Missing "What Happens Next?" After Export
**Current:** User downloads ZIP or copies text, then... nothing
**Risk:** Dead end. No loop back to engagement
**Fix:** Success screen with: "Listing copied! Now post on eBay → [Open eBay]" + "Create another listing" CTA

### 1.6 ❌ No Feedback Loop on Listing Quality
**Current:** User generates listing, has no idea if it's good
**Risk:** Low-quality listings → low sales → user blames tool
**Fix:** "Listing Score" (like Yoast SEO) — shows title length, keyword density, description completeness

---

## 2. Missing Features (Market-Validated)

### 2.1 🔴 CRITICAL: No Pricing Intelligence Display
**Research says:** Pricing anxiety is top-3 pain point
**Current:** We generate a price but don't show WHY
**Fix:** Show "Based on 47 similar items sold for £15-25, we suggest £18"

### 2.2 🔴 CRITICAL: No Bulk/Batch Flow
**Research says:** Bulk sellers are highest-value users (willing to pay $30-100/mo)
**Current:** Single item at a time only
**Fix:** "Bulk Upload" mode — upload 20 photos, get 20 draft listings

### 2.3 🟡 HIGH: No Cross-Platform Adaptation
**Research says:** Platform-specific descriptions increase sales
**Current:** Same description for all platforms
**Fix:** Toggle: eBay (detailed) / Vinted (casual) / Depop (aesthetic) — AI adapts tone

### 2.4 🟡 HIGH: No "Why Isn't This Selling?" Feature
**Research says:** Users want diagnostics on stale listings
**Current:** No analytics or improvement suggestions
**Fix:** Re-analyze saved listing → suggest improvements

### 2.5 🟢 MEDIUM: No Voice Input
**Research says:** Some users want to describe items verbally
**Current:** Text/photo only
**Fix:** "Describe your item" voice button → transcribe → feed to AI

### 2.6 🟢 MEDIUM: No Templates / Style Learning
**Research says:** Professional sellers want consistency
**Current:** Each listing starts fresh
**Fix:** "Use my style" toggle — AI learns from previous listings

---

## 3. Assumption Risks

### 3.1 ⚠️ Assumption: Users want ZIP downloads
**Reality check:** Research shows mobile-first users want copy/paste or direct platform posting
**Status:** ✅ We just fixed this (added Copy/Share dropdowns)

### 3.2 ⚠️ Assumption: Three pricing tiers is right
**Reality check:** Research shows $30+/mo is pain point. Our Pro at £9.99 is competitive.
**Status:** ✅ Good pricing, but consider annual discount

### 3.3 ⚠️ Assumption: Users will find the upgrade button
**Reality check:** Buried in dashboard. Need ambient upsell.
**Status:** ✅ We just added sticky footer

### 3.4 ⚠️ Assumption: Gemini descriptions are good enough
**Reality check:** Research warns about "generic AI voice"
**Status:** 🟡 Need to test with real users. May need fine-tuning or style injection.

### 3.5 ⚠️ Assumption: Desktop-first is fine
**Reality check:** "I want to list while watching TV" — mobile-first is critical
**Status:** 🟡 PWA exists but UX not optimized for thumb-zone

---

## 4. Technical Debt Concerns

### 4.1 Single-File Frontend (5600 lines)
**Risk:** Unmaintainable, hard to test, slow to load
**When to fix:** Before adding bulk features
**Fix:** Split into modules, add build step

### 4.2 Base64 Image Storage
**Risk:** DB bloat, slow queries
**Status:** Migrating to Cloudinary (partially done)
**Fix:** Complete migration, remove base64 fallback

### 4.3 No E2E Tests
**Risk:** Regressions on every change
**Fix:** Playwright test suite (we just created checklist)

### 4.4 Clerk Signups Disabled
**Risk:** No new users can sign up
**Status:** 🔴 CRITICAL — must fix immediately

---

## 5. Competitive Blind Spots

### 5.1 List Perfectly / Vendoo
**They have:** Cross-platform posting, inventory sync
**We don't have:** Any crossposting yet
**Gap severity:** 🟡 HIGH — but they're expensive ($30+/mo)

### 5.2 eBay Mobile App
**They have:** Photo-based listing with AI assist
**We have:** Better AI, more platforms
**Gap severity:** 🟢 LOW — we're genuinely better

### 5.3 ChatGPT Manual Workflow
**They have:** Free, powerful AI
**We have:** Integration, no copy-paste
**Gap severity:** 🟢 LOW — convenience wins

### 5.4 PrimeLister
**They have:** Bulk tools, inventory management
**We don't have:** Bulk upload
**Gap severity:** 🟡 HIGH for bulk sellers

---

## 6. Recommendations (Priority Order)

### Immediate (This Week)
1. ✅ Enable Clerk signups
2. ✅ Push pending commits (export options, upsell footer)
3. Add basic error states with helpful messages
4. Add "Listing Score" badge (simple: Good/Needs Work)

### Short-Term (2 Weeks)
5. Add draft auto-save
6. Add onboarding tooltip tour
7. Show pricing intelligence ("Based on X sold items...")
8. Mobile UX optimization pass

### Medium-Term (1 Month)
9. Bulk upload flow (batch mode)
10. Platform-adaptive descriptions (tone toggle)
11. "Improve this listing" feature for saved items
12. E2E test suite

### Long-Term (Quarter)
13. Cross-platform posting (start with eBay API)
14. Voice input
15. Style learning / templates
16. Analytics dashboard

---

## 7. Questions for Dean

1. **Bulk upload priority:** Is this Week 2 or Month 1? Research says it's high value.
2. **Platform focus:** eBay + Vinted + Gumtree or switch to eBay + Poshmark + Mercari (US market)?
3. **Mobile investment:** Full native app eventually, or PWA-only?
4. **AI voice:** Should we test current output with real users before launch?

---

*Critical review complete. PRD is 70% there — gaps identified are fixable.*
