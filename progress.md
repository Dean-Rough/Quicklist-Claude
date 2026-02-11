# Progress log — Quicklist UX + Growth Push

## 2026-02-07
- Created PM plan: task_plan.md
- Decision: batch-friendly top-level flow will be Catalogue → New Batch → Review Groups → Generate → Export → Archive.
- Decision: listing personality dropdown visible on all tiers; Starter can choose Standard/Expert only; Pro/Max can choose all presets.

### Personality Dropdown Implementation (COMPLETE)
- ✅ Added HTML dropdown in `public/index.html` with 6 presets:
  - Standard (free) - Clear, balanced descriptions
  - Expert (free) - Professional, fact-focused
  - Punchy Seller (pro) - Energetic, compelling copy
  - Luxe Boutique (pro) - Elegant, refined language
  - Streetwear/Hype (pro) - Hypebeast culture voice
  - Cheeky Market Trader (pro) - Delboy-lite British charm
- ✅ Added client-side tier checking in `public/js/app.js`:
  - `updatePersonalityDropdown()` - Enables/disables options based on subscription
  - `getSelectedPersonality()` - Gets current selection
  - `updatePersonalityDescription()` - Shows contextual help text
  - Personality sent to `/api/generate` endpoint
- ✅ Added server-side enforcement in `server.js`:
  - Validates personality against user's subscription tier
  - Falls back to 'standard' if user tries to use above-tier preset
  - Personality prompts injected into Gemini system prompt

### Next Steps
- [ ] Test the dropdown in preview deployment
- [ ] Image enhancement simplification (Hero Image as headline feature)
- [ ] Create PR for this feature branch
