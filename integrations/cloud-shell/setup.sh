#!/usr/bin/env bash
# Installs Google Chrome and Kane CLI.
# Made for Google Cloud Shell; also works on any Debian or Ubuntu x86_64 machine.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required. Install it, then run this script again." >&2
  exit 1
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 18 ]; then
  echo "Node.js 18 or newer is required (found $(node --version))." >&2
  exit 1
fi

if command -v google-chrome >/dev/null 2>&1; then
  echo "Google Chrome is already installed."
else
  echo "Installing Google Chrome (about a minute)..."
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/google-chrome.deb" \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$tmp/google-chrome.deb" >/dev/null
  rm -rf "$tmp"
fi

if command -v kane-cli >/dev/null 2>&1; then
  echo "Kane CLI is already installed."
else
  echo "Installing Kane CLI..."
  npm install --global --no-fund --no-audit @testmuai/kane-cli
fi

echo
google-chrome --version
echo "kane-cli $(kane-cli --version)"
echo
echo "Setup complete. Next, sign in with your TestMu AI username and access key."
