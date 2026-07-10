# SourceCloak Pricing

SourceCloak **Community** is free. **Pro** is a **$24 lifetime** upgrade handled by [Lemon Squeezy](https://www.lemonsqueezy.com).

> Core features and the full Pro experience work on any modern Chrome. Enhanced semantic AI (Gemini Nano) activates automatically on supported devices (recent hardware, Chrome 128+). No cloud required.

## Community (Free)

- Tier 1 regex + Tier 2 token scorer
- Tier 3 ONNX WASM classifier (always on)
- Paste and input interception on major AI chat sites
- Warning overlay and local audit (latest 50 events)
- 100% on-device classification

## Pro — $24 lifetime

Pro value does **not** depend on Gemini Nano. You get the full policy stack on every device:

- Custom regex and corporate signatures
- Monitored and trusted domain lists
- Policy export/import for teams
- Full audit history (500 entries)
- Full sensitivity range
- Optional Tier 4 Gemini Nano semantic review when your Chrome build supports it

## Device compatibility

Run the [device compatibility test](https://sourcecloak.com/compatibility) or open **Policy Console → Re-check capability** to see whether enhanced Gemini Nano is available on your hardware.

## How to upgrade

1. Install SourceCloak from the Chrome Web Store
2. Open **Policy Console → Upgrade**
3. Click **Buy Pro — $24 lifetime** (opens Lemon Squeezy checkout)
4. Complete checkout — your **license key** is emailed immediately
5. Paste the license key in Policy Console and click **Activate**
6. Use **Deactivate on this device** to move the license to another browser

**No refunds:** All Pro purchases are final and non-refundable. Evaluate Community and compatibility before upgrading.

Details: [sourcecloak.com/pricing](https://sourcecloak.com/pricing) · [Terms](https://sourcecloak.com/terms)

## Setup (maintainers)

1. Create a **one-time $24** product in [Lemon Squeezy](https://app.lemonsqueezy.com) with **license keys enabled**
2. Copy the checkout link: **Products → Share → Checkout link**
3. Set `LEMON_SQUEEZY_CHECKOUT_URL` in `src/constants.ts` to that URL
4. Rebuild: `npm run build`

License activation goes through the **SourceCloak license Worker** (`sourcecloak-backend`), which proxies Lemon Squeezy and enforces `EXPECTED_PRODUCT_ID`. The extension never talks to Lemon Squeezy directly and never embeds an LS API key.