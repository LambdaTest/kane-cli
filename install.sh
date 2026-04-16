#!/usr/bin/env sh
# kane-cli installer — installs the @testmuai/kane-cli npm package globally.
#
# This script delegates to npm so all install methods (npm / brew / curl)
# produce the same install: the Node.js TUI plus the matching native runner
# binary resolved via optionalDependencies.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh -s -- --version 0.2.0
#
# Requires: Node.js 18+ and npm on PATH.
# For an install path that doesn't need Node, use Homebrew:
#   brew install LambdaTest/kane/kane-cli

set -eu

PACKAGE="@testmuai/kane-cli"
VERSION=""

# ── Parse args ──────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --help|-h)
      cat <<EOF
Usage: install.sh [--version X.Y.Z]

Installs ${PACKAGE} globally via npm.

Options:
  --version   Specific version to install (default: latest)

Requires Node.js 18+ and npm on PATH. For a non-npm install:
  brew install LambdaTest/kane/kane-cli
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ── Check prerequisites ────────────────────────────────────────────────
if ! command -v npm >/dev/null 2>&1; then
  cat >&2 <<EOF
Error: npm is required but not found on PATH.

Install Node.js 18+ from https://nodejs.org and try again, or use Homebrew:
  brew install LambdaTest/kane/kane-cli
EOF
  exit 1
fi

# ── Reject Windows ─────────────────────────────────────────────────────
case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    cat >&2 <<EOF
Error: This shell installer is POSIX-only. On Windows, install via npm directly:
  npm install -g ${PACKAGE}
EOF
    exit 1
    ;;
esac

# ── Install ────────────────────────────────────────────────────────────
if [ -n "$VERSION" ]; then
  SPEC="${PACKAGE}@${VERSION}"
else
  SPEC="${PACKAGE}"
fi

echo "Installing ${SPEC} via npm..."
echo

# Try without sudo first (works for nvm/fnm/volta and prefix-configured npm).
# Fall back to sudo only if a permission error suggests it.
if npm install -g "$SPEC"; then
  : # success
else
  EXIT=$?
  if [ $EXIT -eq 13 ] || [ $EXIT -eq 243 ]; then
    echo
    echo "npm install failed with a permission error. Retrying with sudo..."
    sudo npm install -g "$SPEC"
  else
    exit $EXIT
  fi
fi

echo
echo "Installed. Run 'kane-cli --version' to verify."
