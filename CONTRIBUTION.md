# Contributing to SourceCloak

Thank you for helping improve SourceCloak. This document covers local setup, development workflow, and pull request expectations.

---

## Code of Conduct

- Keep changes focused and reviewable
- Prioritize on-device privacy and security guarantees
- Do not introduce remote telemetry, analytics, or cloud payload transmission
- Document behavior changes that affect enterprise policy or audit logs

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | 18+ |
| [npm](https://www.npmjs.com/) | 9+ |
| Google Chrome / Chromium | 120+ |

Optional:

- Chrome **Gemini Nano** enabled for Tier 4 semantic classification testing

---

## Local Setup

```bash
git clone <repository-url>
cd sourcecloak
npm install
```

---

## Development Workflow

### 1. Watch mode

Rebuild automatically on file changes:

```bash
npm run dev
```

Reload the extension in `chrome://extensions` after each rebuild.

### 2. Type checking

```bash
npm run type-check
```

### 3. Unit tests

```bash
npm run test
```

Tests live in `tests/` (not `__tests__/` — Chrome reserves `_`-prefixed paths in extension packages).

### 4. Full verification

```bash
npm run verify
```

Runs type-check and unit tests together.

### 5. Production build

```bash
npm run build
```

Outputs a loadable extension to `dist/` and validates the compiled manifest.

### 6. Manual testing

See [TESTING.md](./TESTING.md) for sample blocked/allowed payloads and browser verification steps.

---

## Loading the Extension

Always load the **built output**, never the project root.

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select `sourcecloak/dist`

### Common loading mistakes

| Mistake | Result |
|---------|--------|
| Loading `sourcecloak/` (project root) | `content.ts` / `background.ts` MIME errors |
| Loading before building | Missing or stale `dist/manifest.json` |
| Using `__tests__/` folder name | Chrome rejects `_`-prefixed paths |

---

## Project Conventions

### Language and style

- **TypeScript** with `strict` mode enabled
- Prefer explicit types over `any`
- Match existing module patterns in `src/` and root entry files

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Variables / functions | `camelCase` | `classifyPayload`, `currentSettings` |
| Classes | `PascalCase` | `InputGuard` |
| Constants | `UPPER_SNAKE_CASE` | `STORAGE_KEYS` |
| Files | `kebab-case` or descriptive lowercase | `input-guard.ts`, `token-scorer.ts` |

### Architecture boundaries

| Layer | Responsibility |
|-------|----------------|
| `content.ts` | DOM interception, warning overlay, bridge injection |
| `background.ts` | Message routing, audit log, offscreen lifecycle |
| `offscreen.ts` | ONNX WASM and Gemini Nano classification |
| `src/patterns.ts` | Regex and signature definitions |
| `src/classifier.ts` | Rule-based scoring orchestration |
| `options/` | Policy Console UI |
| `popup/` | Status dashboard UI |

Keep classification logic out of UI files. Keep DOM manipulation out of the service worker.

---

## Adding Detection Rules

### Built-in regex patterns

Add rules to `src/patterns.ts` inside `BUILTIN_PATTERNS`:

```ts
{
  id: 'unique-id',
  category: 'api_credential',
  label: 'Human-readable label',
  regex: /pattern/,
  weight: 0.9
}
```

### Tests

Add coverage in `tests/patterns.test.ts` or `tests/classifier.test.ts` for every new rule or scoring change.

---

## Pull Request Checklist

Before submitting a PR:

- [ ] `npm run verify` passes
- [ ] `npm run build` succeeds and `dist/` loads in Chrome without errors
- [ ] New detection rules include unit tests
- [ ] No `_`-prefixed folders added to the extension package
- [ ] No remote telemetry or payload exfiltration introduced
- [ ] Privacy-impacting changes are reflected in `PRIVACY.md`

### Commit guidance

- Use atomic, descriptive commits
- Branch naming: `feature/short-description`, `fix/short-description`, `docs/short-description`

### PR description

Include:

1. **What** changed
2. **Why** it was needed
3. **How** to test (build steps, sample payload, expected block behavior)

---

## Security Reports

If you discover a vulnerability that could weaken on-device interception or expose scanned payloads externally, please report it responsibly through the repository issue tracker with the `security` label rather than opening a public issue with exploit details.

---

## License

By contributing to SourceCloak, you agree that your contributions will be licensed under the [MIT License](./LICENSE), copyright (c) 2026 Joshua Sarmiento.

---

## Questions

Open a GitHub issue for bugs, feature requests, or policy-console improvements. For privacy-specific questions, see [PRIVACY.md](./PRIVACY.md).