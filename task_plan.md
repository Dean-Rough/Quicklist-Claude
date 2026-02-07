# Quicklist — UX + Growth Push (PM Plan)

## Goal
Ship a cleaner, faster Quicklist flow that supports **bulk photo dumps → auto split into items**, clarifies **Pro vs Max**, and reduces analysis latency (actual + perceived). Keep changes shippable in small PRs.

## Current context (known)
- Repo: `/home/terry/clawd/projects/QLC-Quicklist-Claude`
- Frontend is mostly **single-file** `index.html` + CSS vars in `public/css/styles.css`.
- Current palette: cream background `#f7f2ea`, teal primary `#0f766e`, orange secondary `#f97316`.
- Gemini key issue fixed in Vercel; Quicklist works again.

## Phases

### Phase 0 — Baseline + decide “what’s live” (today)
- [ ] Confirm whether `main` is what Vercel prod is running.
- [ ] Check remote branches/PRs: `feature/phase1-quality-tools`, `claude/quicklist-ai-app-*`.
- [ ] Run local checks: lint/format/build.
- [ ] Decide whether to deploy a small PR (UI-only) today.

### Phase 1 — UX audit (current flow) + pain points
- [ ] Map current user flow: landing → auth → new item → upload photos → analysis → listing output → export/marketplace.
- [ ] Identify “slow as fuck” spots:
  - network requests (AI calls)
  - image upload/processing
  - market research
  - pricing lookups
  - serial vs parallel steps
- [ ] Document current gating for Pro/Max features (what is disabled + why).

### Phase 2 — Bulk photo dump → auto split items (MVP)
**Decision:** Implement a batch-friendly top-level flow: **Catalogue → New Batch → Review Groups → Generate → Export → Archive**.

- [ ] Add **Catalogue / Item Browser** as the default post-login landing.
  - Shows items/drafts with status: Draft / Generated / Exported / Archived.
  - Filters + search.
- [ ] Add **New Batch** flow:
  - user uploads 10–50 photos
  - system clusters into groups (items)
  - user confirms/edits groups
  - then runs analysis per group
- [ ] MVP clustering heuristic:
  - time proximity + basic similarity (hash/embedding)
  - allow manual merge/split
- [ ] Screens:
  - Catalogue
  - New Batch (upload)
  - Review Groups (grid)
  - Generate (per group)
  - Export
  - Archive

### Phase 3 — Pro vs Max clarity
- [ ] Define feature matrix:
  - Pro: batch processing, enhancement, blur fix, etc.
  - Max: priority queue, higher limits, extra “styles/personality”, etc.
- [ ] Update pricing page copy to match actual toggles.
- [ ] In-app feature locks: consistent “locked” UI with CTA.

### Phase 4 — Analysis speed improvements
- [ ] Parallelize steps where possible.
- [ ] Add progress UI with staged steps + partial results.
- [ ] Caching:
  - image analysis cached by image hash
  - market research cached by query
  - reuse extracted attributes across platforms
- [ ] Make failures recoverable (retry only failed step).

### Phase 5 — Listing “personality” presets (tiered feature)
**Decision (Dean):** Dropdown is visible on all tiers.
- Starter/Basic: can select **Standard** or **Expert** only.
- Pro/Max: can select all presets.

- [ ] Implement as **tone presets** (safe) not heavy persona roleplay.
- [ ] Presets (draft):
  - Standard (default)
  - Expert (straight facts / professional)
  - Punchy seller
  - Luxe boutique
  - Streetwear/hype
  - Delboy-lite (UK cheeky) — keep it subtle, not parody
- [ ] UX:
  - Dropdown near generation
  - Disabled options show lock + upgrade CTA on lower tiers
  - Remember last used
  - (Optional) tiny preview snippet

## Deliverables
- UX flow diagram (markdown) + screen list.
- Feature matrix (Starter/Casual/Pro/Max).
- Implementation PR plan (small PRs, each shippable).

## Risks / constraints
- Single-file frontend makes big refactors risky; prefer incremental modules or minimal new views.
- Avoid adding auth bypass to prod.
- Keep performance: minimize JS bloat + image processing in browser.

## Next actions (immediate)
1) Inspect current repo files for: pricing copy, plan gating, analysis pipeline code paths.
2) Produce UX audit + concrete changes list.
3) Identify quickest “old colour scheme” revert option (token swap) and propose.
