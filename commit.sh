#!/bin/bash
cd /home/terry/clawd/projects/Quicklist-Claude
git commit -m "fix: align frontend pricing to backend config + comprehensive audit

- Update showUpgradeModal() to fetch pricing from /api/config/pricing
- Replace hardcoded Starter/Pro/Business with dynamic casual/pro/max tiers
- Display 'Pricing Coming Soon' if Stripe not configured
- Use correct plan IDs matching backend logic (casual/pro/max)
- Add comprehensive QUICKLIST-AUDIT.md documenting all issues
- Add detailed TEST-CHECKLIST.md for production validation
- Fixes plan naming mismatch between frontend and backend"
git log --oneline -3
