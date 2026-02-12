# Clerk Billing Research

**Date:** 2026-02-12
**Verdict:** ❌ Don't switch — keep Stripe

## Summary

Clerk now offers billing/subscription features, but they're **not suitable for Quicklist**:

| Feature | Clerk Billing | Stripe (Current) |
|---------|---------------|------------------|
| **Currency** | USD only ❌ | Multi-currency ✅ |
| **GBP Support** | No ❌ | Yes ✅ |
| **VAT/Tax** | No support ❌ | Full support ✅ |
| **3D Secure** | No ❌ | Yes (UK required) ✅ |
| **Refunds** | Not supported ❌ | Full support ✅ |
| **Webhooks** | Limited | Full ✅ |
| **Maturity** | Beta | Production ✅ |

## Why Clerk Billing Doesn't Work

1. **USD Only** — Quicklist uses GBP pricing (£4.99, £9.99, £19.99). Clerk has no multi-currency support.

2. **No VAT Support** — Critical for UK/EU SaaS. Stripe handles VAT automatically.

3. **No 3D Secure** — UK banks require Strong Customer Authentication (SCA). Stripe handles this.

4. **No Refunds** — Can't process refunds through Clerk. Would need Stripe anyway.

5. **Beta Status** — API unstable, not production-ready.

## Recommendation

**Keep current Stripe setup.** It's working, handles UK requirements, and is battle-tested.

Revisit Clerk Billing when/if they add:
- Multi-currency support
- VAT/tax handling
- 3D Secure compliance

## Current Stripe Setup

- ✅ Webhook configured
- ✅ Price IDs set (casual/pro/max)
- ✅ GBP pricing
- ✅ 3D Secure enabled
- ✅ Customer portal working

No changes needed.
