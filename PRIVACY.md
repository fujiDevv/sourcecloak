# Privacy Policy — SourceCloak

**Effective date:** July 1, 2026  
**Product:** SourceCloak Chrome Extension  
**Version:** 1.0.0

---

## 1. Summary

SourceCloak is an enterprise browser security utility designed to prevent proprietary code and credential leaks **before** they leave the user's device.

**Core principle: scanned payload content never leaves the browser.**

SourceCloak does not operate a backend service, does not collect telemetry, and does not sell or share user data.

---

## 2. Scope

This policy applies to:

- The SourceCloak Chrome extension
- Its on-device classification pipeline
- Local storage used for policy settings and audit logs

This policy does **not** govern third-party websites where the extension runs. Those sites maintain their own privacy terms.

---

## 3. Data Accessed Locally

To provide leak interception, the extension accesses the following **only within the user's browser**:

| Data | Purpose | Leaves device? |
|------|---------|----------------|
| Text entered or pasted into monitored fields | Classification and blocking | **No** |
| Current page URL and hostname | Audit log entries and domain policy | **No** |
| HTML element type (e.g. `textarea`) | Audit context | **No** |
| Extension policy settings | Enforcement configuration | **No** |
| Intercept statistics | Popup dashboard metrics | **No** |

SourceCloak does **not** read full page DOM content, browsing history databases, cookies, or unrelated page text outside monitored input fields.

---

## 4. On-Device Processing

All threat classification is performed locally using a tiered pipeline:

| Tier | Technology | Location |
|------|------------|----------|
| Regex matching | Built-in pattern library | Content script / background |
| Token scoring | Heuristic proprietary-code analysis | Extension runtime |
| ONNX WASM | DistilBERT via `@huggingface/transformers` | Offscreen document |
| Semantic review | Chrome Gemini Nano Prompt API | Main-world bridge (optional) |

### What is not sent to cloud AI services

- Pasted or typed payload text
- Matched secret snippets
- Audit log contents
- Corporate signature definitions

When Gemini Nano is enabled, classification prompts are executed through Chrome's **built-in on-device Prompt API**. SourceCloak does not call external LLM APIs.

---

## 5. Network Activity

SourceCloak is designed to minimize network use.

| Network request | When | Data transmitted |
|-----------------|------|------------------|
| Hugging Face model download | First ONNX classifier initialization | Public model weights only — no user content |
| Google Fonts | Options / popup UI render | Standard font request — no user content |

**Blocked payloads trigger no network requests.** The extension purges input locally and shows an on-page warning overlay.

SourceCloak does **not** include:

- Analytics SDKs
- Error reporting services
- Remote configuration servers
- License phone-home endpoints

---

## 6. Local Storage

The extension uses Chrome extension storage APIs:

### `chrome.storage.local`

| Key | Contents | Retention |
|-----|----------|-----------|
| Policy settings | Sensitivity, domain lists, corporate signatures | Until changed or extension removed |
| Audit log | Intercept events (hostname, match type, timestamp) | Up to 500 most recent entries |
| Statistics | Scan and block counters | Until extension removed |
| Model state | ONNX download progress | Until model is cached |

### `chrome.storage.session`

Used only for ephemeral runtime state when needed. No persistent session data is synced externally.

---

## 7. Audit Log

The local audit log records:

- Timestamp
- Hostname and page URL
- Event type (`paste` or `input`)
- Block result and confidence score
- Match category labels (not full payload content)

Audit data is stored on the user's device and is viewable in the Policy Console. It is never uploaded to SourceCloak or any third party.

---

## 8. Permissions Justification

| Permission | Why it is required |
|------------|-------------------|
| `storage` | Policy settings, audit log, and statistics |
| `offscreen` | ONNX WASM classifier runtime |
| `alarms` | Service worker lifecycle management |
| `<all_urls>` | Monitor input fields on pages where leaks may occur |

The broad host permission is required because paste-risk surfaces span many SaaS domains. Organizations may narrow effective scope using **Monitored Domains** and **Trusted Domains** in the Policy Console.

---

## 9. Enterprise Deployments

For B2B deployments:

- Policy signatures and domain lists are configured per organization
- Audit logs remain on each endpoint
- No central admin cloud is required for core protection

Administrators are responsible for their own device management, policy distribution, and compliance review of locally stored audit data.

---

## 10. User Control and Data Deletion

Users and administrators can:

1. **Disable protection** — Toggle off in popup or Policy Console
2. **Clear policy** — Reset settings in Policy Console
3. **Uninstall** — Removing the extension deletes associated `chrome.storage.local` data

There is no remote account or cloud profile to delete.

---

## 11. Children's Privacy

SourceCloak is an enterprise developer security tool. It is not directed at children under 13 and is not intended for consumer child-facing use cases.

---

## 12. Policy Changes

This policy may be updated to reflect product changes. Material updates will be reflected in this document with a revised effective date.

---

## 13. Contact

For privacy questions or data-handling concerns:

- Open an issue in the project repository
- Label security-sensitive reports appropriately

**Repository:** [contextual-pet-extension](https://github.com/joshuasarmiento/contextual-pet-extension)

---

## 14. Compliance Notes

SourceCloak is a client-side preventive control. It supplements — but does not replace — organizational policies such as:

- Source code access controls
- Secret management systems
- DLP and egress monitoring
- Employee security training

Organizations should evaluate SourceCloak within their own compliance and risk frameworks.