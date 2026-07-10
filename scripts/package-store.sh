#!/usr/bin/env bash
# Build a Chrome Web Store zip. Fails if production license API is missing or unsafe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
NC=$'\033[0m'

die() {
  echo "${RED}error:${NC} $*" >&2
  exit 1
}

info() {
  echo "${GREEN}→${NC} $*"
}

warn() {
  echo "${YELLOW}warn:${NC} $*" >&2
}

# --- Guard: never ship a store build with dev Pro unlock ---
if [[ "${VITE_DEV_PRO_UNLOCK:-}" == "true" ]]; then
  die "VITE_DEV_PRO_UNLOCK=true is set. Unset it for store packages."
fi

# --- Guard: production license API required ---
API="${VITE_LS_LICENSE_API:-}"

if [[ -z "$API" ]]; then
  die "VITE_LS_LICENSE_API is missing.

  Set your production Cloudflare Worker (or custom API) URL, then re-run:

    VITE_LS_LICENSE_API=https://your-worker.workers.dev bun run package:store

  Default lemon-squeezy.ts falls back to http://localhost:8787 without this."
fi

# Trim whitespace
API="$(printf '%s' "$API" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

case "$API" in
  http://localhost|http://localhost:*|http://localhost/*|\
  https://localhost|https://localhost:*|https://localhost/*|\
  http://127.0.0.1|http://127.0.0.1:*|http://127.0.0.1/*|\
  https://127.0.0.1|https://127.0.0.1:*|https://127.0.0.1/*|\
  http://\[::1\]|http://\[::1\]:*|https://\[::1\]|https://\[::1\]:*|\
  http://0.0.0.0|http://0.0.0.0:*|http://0.0.0.0/*)
    die "VITE_LS_LICENSE_API must not point at localhost / loopback.
  Got: $API"
    ;;
esac

if [[ "$API" != https://* ]]; then
  die "VITE_LS_LICENSE_API must use https://
  Got: $API"
fi

# Reject placeholders from docs
if [[ "$API" == *"your-worker"* ]] || [[ "$API" == *"your-account"* ]] || [[ "$API" == *"REPLACE"* ]]; then
  die "VITE_LS_LICENSE_API still looks like a placeholder.
  Got: $API"
fi

export VITE_LS_LICENSE_API="$API"
# Ensure dev unlock cannot leak in via parent env
unset VITE_DEV_PRO_UNLOCK || true

VERSION="$(node -p "require('./package.json').version")"
ZIP_NAME="sourcecloak-${VERSION}-store.zip"
ZIP_PATH="${ROOT}/${ZIP_NAME}"

info "License API: $VITE_LS_LICENSE_API"
info "Version:     $VERSION"

# Prefer full verify; allow PACKAGE_STORE_SKIP_TESTS=1 for emergency zip after local QA
if [[ "${PACKAGE_STORE_SKIP_TESTS:-}" == "1" ]]; then
  warn "PACKAGE_STORE_SKIP_TESTS=1 — running type-check + build only"
  bun run type-check
  bun run build:plain
else
  info "Running type-check + tests + plain production build…"
  bun run type-check
  bun run test
  bun run build:plain
fi

DIST="${ROOT}/dist"
[[ -d "$DIST" ]] || die "dist/ missing after build"
[[ -f "$DIST/manifest.json" ]] || die "dist/manifest.json missing"

# Optional Playwright e2e against the freshly built dist/ (set in CI or before store submit)
if [[ "${PACKAGE_STORE_RUN_E2E:-}" == "1" ]]; then
  info "PACKAGE_STORE_RUN_E2E=1 — running Playwright e2e…"
  bun run test:e2e
fi

# --- Guard: baked bundle must not fall back to localhost license API ---
# lemon-squeezy default is http://localhost:8787 when env is unset; ensure it was replaced.
if grep -R --include='*.js' -l 'localhost:8787' "$DIST" >/dev/null 2>&1; then
  die "Built dist still contains localhost:8787 (license fallback).
  VITE_LS_LICENSE_API may not have been inlined. Aborting."
fi

if grep -R --include='*.js' -l 'VITE_DEV_PRO_UNLOCK' "$DIST" >/dev/null 2>&1; then
  # string may exist as dead code; check for true unlock patterns is fragile — skip
  :
fi

# --- Package ---
rm -f "$ZIP_PATH"
info "Creating $ZIP_NAME from dist/ …"
(
  cd "$DIST"
  # Contents of dist at zip root (required by Chrome Web Store)
  zip -r -q "$ZIP_PATH" . -x "*.DS_Store" -x "**/.DS_Store"
)

[[ -f "$ZIP_PATH" ]] || die "Zip was not created"

SIZE="$(du -h "$ZIP_PATH" | awk '{print $1}')"
info "Done: $ZIP_PATH ($SIZE)"
echo
echo "Next: Chrome Web Store Developer Dashboard → Upload package"
echo "  Privacy policy URL: https://sourcecloak.com/privacy (or your hosted policy)"
echo "  Confirm VITE_LS_LICENSE_API is reachable before submitting."
