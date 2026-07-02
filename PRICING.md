# SourceCloak Pricing

SourceCloak **Community** is free. **Pro** is a **$24 lifetime** upgrade handled by [Lemon Squeezy](https://www.lemonsqueezy.com).

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
3. Click **Buy Pro — $24 lifetime** (opens Lemon Squeezy checkout)
4. Complete checkout — your **license key** is emailed immediately
5. Paste the license key in Policy Console and click **Activate**
6. Use **Deactivate on this device** to move the license to another browser

**No refunds:** All Pro sales are final. Evaluate the free Community edition before purchasing.

Details: [sourcecloak.com/pricing](https://sourcecloak.com/pricing) · [Terms](https://sourcecloak.com/terms)

## Setup (maintainers)

1. Create a **one-time $24** product in [Lemon Squeezy](https://app.lemonsqueezy.com) with **license keys enabled**
2. Copy the checkout link: **Products → Share → Checkout link**
3. Set `LEMON_SQUEEZY_CHECKOUT_URL` in `src/constants.ts` to that URL
4. Rebuild: `npm run build`

License activation uses Lemon Squeezy's public license API (`api.lemonsqueezy.com`) — no backend or API key in the extension is required.