# Quicklist — Terry PM Brief

## My Role
Project Manager for Quicklist. I own:
- Feature implementation
- Bug fixes
- Deployment
- Testing
- UX decisions (within brand guidelines)

**I should NOT be asking Dean to:**
- Do admin tasks I can do myself
- Make decisions that are obviously my call
- Push commits (I have deploy key access now)

---

## Quick Reference

### URLs
- **Live:** https://quicklist.it.com
- **Repo:** github.com/Dean-Rough/Quicklist-Claude
- **Vercel:** vercel.com/dean-rough/quicklist-claude
- **Clerk:** clerk.com (need Dean for dashboard access)
- **Stripe:** dashboard.stripe.com

### Local Paths
- **VPS:** `/home/terry/clawd/projects/Quicklist-Claude/`
- **NUC:** TBD - check if cloned

### Brand
- **Primary color:** `#0f766e` (teal)
- **Accent:** `#f97316` (orange)
- **Background:** `#f7f2ea` (warm cream)
- **Heading font:** Space Grotesk
- **Body font:** Manrope
- **Button style:** Pill (border-radius: 999px)
- **Card style:** 12px radius, 2rem padding

### Logo
- Location: `/home/terry/clawd/projects/Quicklist-Claude/public/icons/`
- Need: SVG/PNG for Clerk branding upload

### Tech Stack
- Frontend: Vanilla JS (single index.html)
- Backend: Express.js on Vercel Functions
- DB: Neon PostgreSQL
- Auth: Clerk
- Payments: Stripe
- AI: Gemini 2.5 Flash
- Images: Cloudinary

### Asana
- Project GID: `1213106078682622`
- Workspace: `488071067277661`

### Stripe Products
- Casual: `price_1SzOh1PWgvCb6pDhjozYdT2C`
- Pro: `price_1SzOhHPWgvCb6pDhJKqqOkUH`
- Max: `price_1SzOhIPWgvCb6pDhvaKESrKo`

---

## Current State (2026-02-11)

### Done Today
- [x] Export success modal + "Create another" CTA
- [x] Listing score badge (0-100)
- [x] Onboarding tour (3 steps)
- [x] Pricing display for all platforms
- [x] Stock images added to landing page
- [x] OG image (hero-image.jpg)
- [x] Clerk styling (light theme, site fonts, pill buttons)
- [x] Removed fake Overview dashboard
- [x] Git push access via deploy key

### Still Needs Doing
- [ ] Upload logo to Clerk dashboard (needs browser)
- [ ] Hide "Secured by Clerk" branding
- [ ] Test full signup → upgrade flow
- [ ] Test onboarding appears for new users

### Known Issues
- Clerk branding still shows (dashboard setting)
- Google button icon size (Clerk dashboard)

---

## Docs in Repo
- `PRD.md` — Full product requirements
- `PRD-CRITIQUE.md` — Gap analysis
- `MARKET-RESEARCH.md` — Reddit pain points
- `ROADMAP.md` — 12-week plan
- `TEST-CHECKLIST.md` — QA checklist
- `QUICKLIST-AUDIT.md` — Feature audit

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-11 | UK-first market | Dean's in UK, Vinted UK huge, easier to nail one market |
| 2026-02-11 | Pill buttons for Clerk | Match site btn style |
| 2026-02-11 | Remove Overview panel | Not functional, confusing |

---

## Access I Need But Don't Have
- Clerk dashboard (browser-only)
- Stripe dashboard (browser-only)
- Vercel dashboard (can use CLI instead)

**Workaround:** For browser-only admin, I need to either:
1. Ask Dean (last resort)
2. Use Playwright/browser automation (if set up)
3. Accept limitation and document what needs doing
