# Changelog

## 1.2.1 — July 14, 2026

### Open Source Migration
- SourceCloak is now 100% free and open-source under the MIT License
- All advanced/premium features unlocked for all users by default
- Removed Lemon Squeezy integration, pricing models, checkout links, and license validation servers
- Replaced Upgrade/License modals with open-source project guides
- Simplified and cleaned monorepo documentation

## 1.1.1 — July 4, 2026

### Security & Classification

- IPC sender validation on background, content, and offscreen message handlers
- Tier 4 Gemini Nano runs only when Prompt API status is `available`
- Markdown documentation detection reduces ONNX false positives on README pastes
- TypeScript setup: chrome/node types for extension, e2e, and Playwright sources

## 1.1.0 — July 2, 2026

### Pro & Billing

- Lemon Squeezy integration for Pro — $24 lifetime checkout with license key activation
- Halo upgrade flow in Policy Console
- License activation and deactivation for moving Pro between browsers

### Community Coverage

- Expanded preset to 50+ monitored AI surfaces
- Wildcard domain matching for subdomains
- Added Cursor, Replit, v0, Hugging Face, DeepSeek, OpenRouter, and related paste targets

### Classification & Policy

- Tier 3 ONNX WASM structural classifier in offscreen document (Community + Pro)
- Optional Tier 4 Gemini Nano semantic review when Prompt API is available (Pro toggle)
- Custom corporate signatures, monitored/trusted domain lists, and policy export/import (Pro)
- Audit log capacity: 50 events (Community) / 500 events (Pro)

## 1.0.0 — July 1, 2026

### Initial Release

- Chrome Web Store launch with Community (free) and Pro editions
- Tier 1 regex and Tier 2 token scorer block credentials and proprietary code on paste/input
- Interception for textareas plus Monaco and CodeMirror editors on monitored AI domains
- Warning overlays and hostname-only local audit log
- Policy Console for master toggle, sensitivity threshold, and audit review
- Zero-telemetry promise: scanned content never leaves the browser