# Quicklist Improvement Roadmap

**Created:** 2026-02-10  
**Based on:** PRD, Market Research, Critical Review  
**Planning horizon:** 12 weeks

---

## Executive Summary

Quicklist has a **genuine competitive advantage** — photo-to-listing AI that nobody else does well. The market research validates our core value prop. However, we have critical gaps blocking launch (signups, payments) and missing features that high-value users expect (bulk upload, pricing intelligence).

**Goal:** Revenue by Feb 28, 2026 (18 days)

---

## Phase 1: Launch-Ready (Week 1-2)
*Objective: Remove all blockers to first paying customer*

### 🔴 Critical Blockers

| Task | Owner | Status | ETA |
|------|-------|--------|-----|
| Enable Clerk signups | Dean | 🔴 Blocked | Today |
| Push pending commits (export, upsell) | Dean | 🟡 Ready | Today |
| Test Stripe payment flow end-to-end | Dean + Terry | 🟡 Ready | Today |
| Add OG image for social sharing | Terry | 🟡 Todo | Tomorrow |
| Fix any remaining upgrade flow bugs | Terry | 🟡 Needs test | Tomorrow |

### 🟡 Critical UX Fixes

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Add meaningful error messages | High | Low | P1 |
| Add "Listing Score" indicator | Medium | Low | P1 |
| Add success screen after export | Medium | Low | P1 |
| Mobile thumb-zone optimization | Medium | Medium | P2 |

### 🟢 Quick Wins

| Task | Impact | Effort |
|------|--------|--------|
| Add pricing explanation ("Based on X sold...") | High | Low |
| Add platform tone toggle (detailed/casual) | Medium | Medium |
| Add draft auto-save (localStorage) | Medium | Low |

**Week 1-2 Deliverable:** Working product that can accept signups, generate listings, process payments.

---

## Phase 2: Growth Features (Week 3-4)
*Objective: Features that drive retention and upgrades*

### Bulk Upload Flow
**Why:** Research shows bulk sellers are highest-value segment ($30-100/mo willing to pay)  
**What:** Upload multiple photos → get multiple draft listings → batch edit → batch export  
**Effort:** Medium-High (1 week)  
**Dependency:** None

### Pricing Intelligence Display
**Why:** Pricing anxiety is #3 pain point. We generate prices but don't explain why.  
**What:** "Based on 47 similar items sold for £15-25, we suggest £18"  
**Effort:** Medium (need to surface existing pricing data in UI)  
**Dependency:** May need eBay sold data API

### Onboarding Tour
**Why:** 30% first-session bounce rate is common without guidance  
**What:** 3-step tooltip walkthrough on first login  
**Effort:** Low (2-3 hours)  
**Dependency:** None

### "Improve This Listing" Feature
**Why:** Users with stale listings want diagnostics  
**What:** Re-analyze saved listing → suggest improvements (better title, more keywords, price adjustment)  
**Effort:** Medium  
**Dependency:** None

**Week 3-4 Deliverable:** Features that make users stay and upgrade.

---

## Phase 3: Differentiation (Week 5-8)
*Objective: Features competitors don't have*

### Platform-Adaptive Descriptions
**Why:** Same item needs different copy for eBay vs Depop vs Vinted  
**What:** Toggle that changes AI tone:
- eBay = detailed, measurements, technical
- Vinted = casual, friendly, brief
- Depop = aesthetic, trendy, hashtag-heavy

**Effort:** Medium  
**Dependency:** Prompt engineering

### Voice Input
**Why:** Some users want to describe items verbally  
**What:** Microphone button → transcribe → feed to AI → generate listing  
**Effort:** Medium (Web Speech API + integration)  
**Dependency:** None

### Listing Templates
**Why:** Professional sellers want consistency  
**What:** Save a listing as template → apply to future items  
**Effort:** Low-Medium  
**Dependency:** None

### E2E Test Suite
**Why:** Confidence in changes, catch regressions  
**What:** Playwright tests covering all core flows  
**Effort:** Medium (1 week)  
**Dependency:** Stable features

**Week 5-8 Deliverable:** Features that make Quicklist the obvious choice.

---

## Phase 4: Scale (Week 9-12)
*Objective: Features for power users and market expansion*

### Cross-Platform Posting
**Why:** "List once, sell everywhere" is dream workflow  
**What:** Publish to eBay, Vinted, Depop from single interface  
**Effort:** High (platform APIs, auth, inventory sync)  
**Dependency:** Platform API access

### Analytics Dashboard
**Why:** Users want to see what's working  
**What:** Views, conversion rates, pricing trends, best-selling categories  
**Effort:** Medium-High  
**Dependency:** Data collection (start now)

### Mobile App (or PWA Optimization)
**Why:** Research shows mobile-first is critical  
**What:** Either full native app or PWA with offline, push notifications  
**Effort:** High (native) / Medium (PWA)  
**Dependency:** Core product stability

### Style Learning
**Why:** AI that sounds like YOU, not generic  
**What:** Analyze user's past listings → train personalized voice  
**Effort:** High  
**Dependency:** Enough user data

**Week 9-12 Deliverable:** Platform for serious sellers.

---

## Feature Priority Matrix

| Feature | User Impact | Revenue Impact | Effort | Priority |
|---------|-------------|----------------|--------|----------|
| Enable signups | 🔴 Critical | 🔴 Critical | Low | NOW |
| Stripe working | 🔴 Critical | 🔴 Critical | Done | NOW |
| Export dropdowns | High | Medium | Done | ✅ |
| Upsell footer | Medium | High | Done | ✅ |
| Pricing explanation | High | Medium | Low | P1 |
| Error messages | Medium | Low | Low | P1 |
| Bulk upload | Very High | Very High | Medium | P1 |
| Onboarding tour | Medium | Medium | Low | P2 |
| Platform tone toggle | High | Medium | Medium | P2 |
| "Improve listing" | Medium | Medium | Medium | P2 |
| Voice input | Medium | Low | Medium | P3 |
| Templates | Medium | Medium | Low | P3 |
| Cross-platform | Very High | Very High | High | P3 |
| Analytics | Medium | Medium | Medium | P4 |
| Style learning | Medium | Low | High | P4 |

---

## Success Metrics by Phase

### Phase 1 (Launch)
- [ ] 10 signups
- [ ] 1 paying customer
- [ ] 50 listings generated

### Phase 2 (Growth)
- [ ] 100 signups
- [ ] 10 paying customers
- [ ] 5% free→paid conversion
- [ ] 30-day retention >40%

### Phase 3 (Differentiation)
- [ ] 500 signups
- [ ] 50 paying customers
- [ ] NPS >30
- [ ] Featured in 2 reseller communities

### Phase 4 (Scale)
- [ ] 2,000 signups
- [ ] 200 paying customers
- [ ] MRR £2,000+
- [ ] Multi-platform presence

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI descriptions feel generic | Medium | High | Test with users, add style options |
| Gemini API costs spike | Low | Medium | Monitor usage, add caching |
| Competitor copies us | Medium | Medium | Move fast, build community moat |
| Platform TOS issues | Low | High | Review carefully, don't automate posting without consent |
| User churn after trial | Medium | High | Onboarding, email sequences, feature education |

---

## Resource Allocation

**Current team:** Dean (owner) + Terry (AI PM/dev)

**Recommended split:**
- 60% Feature development
- 20% Bug fixes / polish
- 10% User research / validation
- 10% Documentation / marketing

**Need to add:**
- Beta users for feedback (target: 10-20 active testers)
- Content for SEO/marketing (blog posts, launch posts)

---

## Decision Points

### Week 2: Go/No-Go for Launch
- Are payments working?
- Are signups enabled?
- Does core flow work on mobile?
→ If yes: soft launch to r/Flipping, r/VintedUK

### Week 4: Platform Focus Decision
- UK-first (Vinted, eBay, Gumtree) vs US-first (eBay, Poshmark, Mercari)?
- Depends on initial user geography

### Week 6: Mobile Investment Decision
- PWA improvements sufficient or native app needed?
- Depends on user feedback

---

## Appendix: Feature Descriptions

### Bulk Upload Flow (Detailed)
```
User Journey:
1. Click "Bulk Upload" button
2. Select 5-50 photos from camera roll / files
3. AI processes in background (show progress)
4. Present grid of draft listings
5. User can:
   - Edit individual listings
   - Bulk-edit (change platform, category)
   - Dismiss bad ones
   - Select and export
6. Export options: ZIP all, Copy all, Publish selected
```

### Pricing Intelligence (Detailed)
```
Display Format:
┌─────────────────────────────────────────┐
│ 💰 Suggested Price: £18                 │
│                                         │
│ Based on 47 similar items:              │
│ • Sold range: £12 - £28                 │
│ • Average: £19                          │
│ • Fast sales (<7 days): £15             │
│ • Highest sold: £28                     │
│                                         │
│ [Use £18] [Adjust Price]                │
└─────────────────────────────────────────┘
```

### Listing Score (Detailed)
```
Score Components:
- Title length (optimal: 60-80 chars)
- Description completeness (measurements, condition, flaws)
- Keyword presence
- Photo count (optimal: 4-8)
- Photo quality (not blurry)

Display:
🟢 Great Listing (85/100)
🟡 Good - could improve (65/100)
🔴 Needs work (45/100)

Clicking shows specific suggestions.
```

---

*Roadmap is living document. Review weekly. Adjust based on user feedback.*

**Next action:** Dean enables Clerk signups, pushes commits, tests payment flow.
