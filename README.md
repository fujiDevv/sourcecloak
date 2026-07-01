# SourceCloak

**The first client-side structural defense layer blocking proprietary code exposures before transmission.**

SourceCloak is an enterprise-grade Chrome extension that intercepts sensitive code, credentials, and corporate signatures in text inputs **before** they can reach external cloud tools. All classification runs on-device — blocked payloads never leave the browser.

<p align="center">
  <img src="assets/logo128.png" alt="SourceCloak" width="128" />
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/"><img src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white" alt="Manifest V3" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Processing-100%25%20On--Device-0F766E?style=flat-square" alt="On-Device Processing" />
  <img src="https://img.shields.io/badge/Network-Zero%20Telemetry-1D4ED8?style=flat-square" alt="Zero Telemetry" />
  <img src="https://img.shields.io/badge/AI-ONNX%20%2B%20Gemini%20Nano-7C3AED?style=flat-square" alt="Local AI Stack" />
  <img src="https://img.shields.io/badge/Audit-Local%20Only-92400E?style=flat-square" alt="Local Audit Log" />
</p>

---

## Overview

Engineering teams face constant pressure to prevent proprietary codebase exposure into external systems — AI assistants, translation tools, ticketing platforms, and paste-heavy SaaS surfaces. SourceCloak adds an **air-gapped interception layer** directly in the browser:

1. Monitors textareas, inputs, and `contenteditable` fields across active tabs
2. Classifies pasted and typed payloads using a multi-tier on-device pipeline
3. Purges blocked input locally and displays a secure warning overlay
4. Logs intercept events to a local audit trail — no remote telemetry

---

## Key Features

| Capability | Description |
|------------|-------------|
| **Paste interception** | Capture-phase `paste` blocking before network transmission |
| **Input monitoring** | Throttled continuous scanning of typed content |
| **4-tier classifier** | Regex → token scoring → ONNX WASM → Gemini Nano semantic review |
| **Corporate signatures** | Custom regex and internal config markers per organization |
| **Domain policy** | Monitored and trusted domain lists for scoped enforcement |
| **Policy Console** | Enterprise options dashboard for sensitivity, patterns, and audit review |
| **Local audit log** | On-device intercept history with category-level stats |

---

## Architecture

```mermaid
flowchart LR
  subgraph Page["Web Page"]
    CS[content.ts · InputGuard]
    MW[main_world.js · Gemini Bridge]
    OV[Warning Overlay]
  end

  subgraph Extension["Extension Runtime"]
    BG[background.ts · Service Worker]
    OFF[offscreen.ts · ONNX WASM]
  end

  CS -->|paste / input payload| BG
  BG -->|classify| OFF
  OFF -->|tiered results| BG
  BG -->|blocked| CS
  CS --> OV
  OFF -.->|semantic fallback| MW
```

### Classification pipeline

| Tier | Engine | Targets |
|------|--------|---------|
| 1 | Regex | SSH keys, AWS/GitHub/Stripe tokens, JWTs, `.env` secrets, DB URLs |
| 2 | Token scorer | Proprietary token density, internal API markers, code blocks |
| 3 | ONNX WASM | Structural heuristics via offscreen DistilBERT pipeline |
| 4 | Gemini Nano | Optional semantic classification via Chrome Prompt API |

---

## Project Structure

```
sourcecloak/
├── background.ts          # Service worker, offscreen lifecycle, audit log
├── content.ts             # Input guard injection and policy sync
├── main_world.ts          # Gemini Nano bridge (main-world context)
├── offscreen.ts           # ONNX WASM classification runtime
├── src/
│   ├── manifest.json      # Source manifest (compiled by Vite)
│   ├── patterns.ts        # Secret and credential pattern library
│   ├── classifier.ts      # Rule-based classification orchestration
│   ├── input-guard.ts     # DOM listener and paste blocking
│   └── warning-overlay.ts # Enterprise block notification UI
├── popup/                 # Extension popup dashboard
├── options/               # Policy Console
├── tests/                 # Vitest unit tests
└── dist/                  # ← Load this folder in Chrome
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- Google Chrome or Chromium 120+ (Manifest V3 + offscreen documents)
- Optional: Chrome built-in **Gemini Nano** for Tier 4 semantic review

### Install

```bash
cd SourceCloak-shield
npm install
```

### Build

```bash
npm run build
```

The postbuild step validates that `dist/manifest.json` references compiled `.js` entrypoints and prints the load path.

### Load in Chrome

> **Important:** Load the **`dist/`** folder only — not the project root.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select:

```
SourceCloak-shield/dist
```

### Verify protection

Paste a test SSH key block into any textarea on a SaaS site. SourceCloak should:

- Purge the field immediately
- Show the **Transmission Blocked** overlay
- Record the event in the local audit log

See [TESTING.md](./TESTING.md) for the full test guide and sample payloads.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build in watch mode |
| `npm run build` | Production build + manifest validation |
| `npm run extension` | Alias for `npm run build` |
| `npm run test` | Run Vitest unit tests |
| `npm run type-check` | TypeScript validation |
| `npm run verify` | Type-check + tests |

---

## Configuration

Open the **Policy Console** from the extension options page or popup.

| Setting | Default | Purpose |
|---------|---------|---------|
| Protection | Enabled | Master on/off switch |
| Sensitivity | 65 | Block threshold (0 = strict, 100 = permissive) |
| ONNX classifier | Enabled | Offscreen WASM structural analysis |
| Gemini Nano | Enabled | Semantic review when Prompt API is available |
| Monitored domains | All | Restrict scanning to specific hosts |
| Trusted domains | None | Bypass scanning for internal tools |
| Corporate signatures | Empty | Organization-specific config markers |

---

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Policy settings and local audit log |
| `offscreen` | ONNX WASM classification runtime |
| `alarms` | Background lifecycle management |
| `<all_urls>` | Content script input monitoring on active tabs |

No remote servers receive scanned payload content. Hugging Face is contacted only for one-time ONNX model weight downloads when the WASM classifier is first initialized.

---

## Documentation

- [TESTING.md](./TESTING.md) — Manual and automated testing guide with sample payloads
- [CONTRIBUTION.md](./CONTRIBUTION.md) — Development and contribution guidelines
- [PRIVACY.md](./PRIVACY.md) — Privacy policy and data handling
- [LICENSE](./LICENSE) — Copyright and usage terms

---

## License

Copyright (c) 2026 **Joshua Sarmiento**

SourceCloak is licensed under the [MIT License](./LICENSE).

---

## B2B Positioning

SourceCloak is designed as a per-seat B2B browser utility for engineering organizations that need structural, client-side leak prevention without routing employee traffic through a cloud proxy. Policy signatures, domain scope, and audit retention are configurable per deployment.