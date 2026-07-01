# Testing SourceCloak

This guide covers manual browser testing and automated unit tests for verifying paste interception, classification, and audit logging.

> All sample payloads below are **synthetic** and designed to match detection patterns only. Do not use real credentials.

---

## Prerequisites

1. Build the extension:

```bash
cd sourcecloak
npm run build
```

2. Load in Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select `sourcecloak/dist` (**not** the project root)

3. Confirm the extension popup shows **Active** and **Protection** is enabled.

---

## Test Surfaces

Use any page with a textarea, text input, or chat box:

| Surface | Example |
|---------|---------|
| AI chat | [chatgpt.com](https://chatgpt.com), [claude.ai](https://claude.ai) |
| Translation | [translate.google.com](https://translate.google.com) |
| Local sandbox | DevTools console snippet below |

### Local sandbox (optional)

Paste into the browser console on any page:

```javascript
document.body.innerHTML = '<textarea id="test" style="width:100%;height:200px;padding:12px" placeholder="Paste test payloads here"></textarea>';
```

---

## Blocked Payload Samples

Paste each sample into a monitored field. SourceCloak should purge the input, show the **Transmission Blocked** overlay, and record an audit entry.

### SSH private key (Tier 1 — regex)

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAA
-----END OPENSSH PRIVATE KEY-----
```

**Expected match:** SSH Private Key

---

### AWS credentials

```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Expected match:** AWS Access Key, AWS Secret Key

---

### GitHub personal access token

```
export GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

**Expected match:** GitHub Personal Access Token

---

### Environment secret / Stripe key

```
DATABASE_PASSWORD=super_secret_password_123
API_KEY=my_dummy_stripe_key_12345
```

**Expected match:** Environment Secret, Stripe API Key

---

### Proprietary / internal code (Tier 2 — token scorer)

```
// CONFIDENTIAL - INTERNAL USE ONLY
import { InternalApiClient } from '@corp/platform-sdk';

class InternalBillingService {
  private secret_key = process.env.BILLING_SECRET_KEY;
  async charge(token: string) {
    return fetch('/api/v1/internal/billing/charge', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
```

**Expected match:** Proprietary Source Header, Internal Package Reference, Internal API Structure

---

## Allowed Payload Samples

These should **not** trigger a block.

### Benign question

```
Hello, can you help me write a Python hello world script?
```

### Simple public-style code

```
function add(a, b) { return a + b; }
```

### Meeting notes

```
Meeting notes: standup at 10am, review PR #42
```

**Expected:** Text remains in the field. No overlay. No new block in audit log.

---

## Custom Corporate Signature Test

1. Open **Policy Console** (extension options).
2. Go to **Corporate Signatures**.
3. Add:

```
ACME_INTERNAL_API
```

4. Save policy.
5. Paste:

```
const config = { ACME_INTERNAL_API: "https://internal.acme.corp" };
```

**Expected match:** Corporate Signature: ACME_INTERNAL_API

---

## Verification Checklist

After each test, confirm:

| Check | Location |
|-------|----------|
| Field purged on block | Page textarea / input |
| Warning overlay shown | **Transmission Blocked** modal |
| Scan / block counters updated | Extension popup |
| Audit entry recorded | Policy Console → **Audit Log** |
| Protection enabled | Popup → **Protection** toggle |

---

## Quick Reference

| Test | Payload type | Should block? |
|------|----------------|---------------|
| SSH key | Credential | Yes |
| AWS key | Credential | Yes |
| GitHub `ghp_` token | Credential | Yes |
| Hello world question | Benign text | No |
| Simple `add()` function | Public-style code | No |
| CONFIDENTIAL + `@corp/` code | Proprietary | Yes |
| Custom corporate signature | Policy-defined | Yes |

---

## Automated Tests

Run the Vitest unit test suite:

```bash
npm run test
```

Run full verification (type-check + tests):

```bash
npm run verify
```

Tests cover:

- SSH private key detection
- AWS access key detection
- Custom corporate signatures
- Classifier sensitivity thresholds
- Benign text passthrough

---

## Troubleshooting

| Symptom                   | Fix                                                                   |
| ---------------------------| -----------------------------------------------------------------------|
| Nothing happens on paste  | Confirm you loaded `dist/`, not the project root                      |
| `content.ts` MIME error   | Rebuild with `npm run build` and reload `dist/`                       |
| Block test not triggering | Check **Protection** is enabled in popup                              |
| All scans skipped         | Verify the site is not listed under **Trusted Domains**               |
| Only some hosts monitored | Check **Monitored Domains** in Policy Console — empty means all hosts |

---

## Classification Tiers Under Test

| Tier | Engine | Sample that exercises it |
|------|--------|--------------------------|
| 1 | Regex | SSH key, AWS key, GitHub token |
| 2 | Token scorer | CONFIDENTIAL + `@corp/` code block |
| 3 | ONNX WASM | Long proprietary code payloads (after model loads) |
| 4 | Gemini Nano | Semantic review when Chrome Prompt API is available |