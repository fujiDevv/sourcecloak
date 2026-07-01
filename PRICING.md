# SourceCloak Pricing

SourceCloak **Community** is free. **Pro** is a **$24 lifetime** upgrade handled by [ExtensionPay](https://extensionpay.com) (Stripe).

## Community (Free)

- Tier 1 regex + Tier 2 token scorer
- Paste and input interception on major AI chat sites
- Warning overlay and local audit (latest 50 events)
- 100% on-device classification

## Pro — $24 lifetime

- Tier 3 ONNX WASM classifier
- Tier 4 Gemini Nano semantic review (when available in Chrome)
- Custom regex and corporate signatures
- Monitored and trusted domain lists
- Policy export/import
- Full audit history (500 entries)
- Full sensitivity range

## How to upgrade

1. Install SourceCloak from the Chrome Web Store (or load unpacked from `dist/`)
2. Open **Policy Console → Upgrade**
3. Click **Buy Pro — $24 lifetime**
4. Complete checkout in the ExtensionPay / Stripe window
5. Pro unlocks automatically; use **Already paid? Log in** to restore on another browser

**No refunds:** All Pro sales are final. Evaluate the free Community edition before purchasing.

Details: [sourcecloak.com/pricing](https://sourcecloak.com/pricing) · [Terms](https://sourcecloak.com/terms)

## Setup (maintainers)

1. [Sign up at ExtensionPay](https://extensionpay.com) and register extension ID `sourcecloak` (or update `EXTENSION_PAY_ID` in `src/constants.ts`)
2. Create a **one-time $24** plan in ExtensionPay settings
3. Optionally set `PRO_PLAN_NICKNAME` in `src/constants.ts` to skip the plan picker
4. Connect your Stripe account in ExtensionPay