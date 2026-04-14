#!/usr/bin/env bash
# kane-cli installer — detects OS/arch, downloads the right binary from GitHub Releases.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | bash -s -- --version 0.2.0
#   curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | bash -s -- --dir /usr/local/bin
#
set -euo pipefail

REPO="LambdaTest/kane-cli"
INSTALL_DIR="${HOME}/.local/bin"
VERSION=""
BINARY_NAME="kane-cli"

# ── Parse args ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --help)
      echo "Usage: install.sh [--version X.Y.Z] [--dir /path/to/bin]"
      echo ""
      echo "Options:"
      echo "  --version   Specific version to install (default: latest)"
      echo "  --dir       Install directory (default: ~/.local/bin)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Detect platform ────────────────────────────────────────────────────
detect_platform() {
  local os arch

  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin) os="darwin" ;;
    linux)  os="linux" ;;
    mingw*|msys*|cygwin*)
      echo "Error: This installer does not support Windows. Use npm instead:"
      echo "  npm install -g @testmuai/kane-cli"
      exit 1
      ;;
    *) echo "Error: Unsupported OS: $os"; exit 1 ;;
  esac

  case "$arch" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64)  arch="x64" ;;
    *) echo "Error: Unsupported architecture: $arch"; exit 1 ;;
  esac

  # Only supported combos
  case "${os}-${arch}" in
    darwin-arm64|linux-x64) ;;
    *) echo "Error: Unsupported platform: ${os}-${arch}"; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

# ── Resolve latest version ─────────────────────────────────────────────
resolve_version() {
  if [[ -n "$VERSION" ]]; then
    echo "$VERSION"
    return
  fi

  local latest
  latest=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed -E 's/.*"v([^"]+)".*/\1/')

  if [[ -z "$latest" ]]; then
    echo "Error: Could not determine latest version" >&2
    exit 1
  fi

  echo "$latest"
}

# ── Download + verify ──────────────────────────────────────────────────
main() {
  local platform version asset_name download_url tmp_dir

  platform="$(detect_platform)"
  version="$(resolve_version)"

  echo "Installing kane-cli v${version} for ${platform}..."

  # Determine asset name
  if [[ "$platform" == "win-x64" ]]; then
    asset_name="kane-cli-win-x64.exe"
  else
    asset_name="kane-cli-${platform}"
  fi

  download_url="https://github.com/${REPO}/releases/download/v${version}/${asset_name}"

  # Download to temp
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  echo "Downloading ${download_url}..."
  if ! curl -fsSL -o "${tmp_dir}/${asset_name}" "$download_url"; then
    echo "Error: Download failed. Check that version v${version} exists at:"
    echo "  https://github.com/${REPO}/releases"
    exit 1
  fi

  # Verify checksum if SHA256SUMS available
  local checksums_url="https://github.com/${REPO}/releases/download/v${version}/SHA256SUMS"
  if curl -fsSL -o "${tmp_dir}/SHA256SUMS" "$checksums_url" 2>/dev/null; then
    echo "Verifying checksum..."
    if ! (cd "$tmp_dir" && grep "  ${asset_name}$" SHA256SUMS | sha256sum -c --quiet 2>/dev/null) && \
       ! (cd "$tmp_dir" && grep "  ${asset_name}$" SHA256SUMS | shasum -a 256 -c --quiet 2>/dev/null); then
      echo "Error: Checksum verification failed. Aborting."
      exit 1
    fi
    echo "Checksum verified."
  else
    echo "Warning: SHA256SUMS not available, skipping checksum verification."
  fi

  # Install
  mkdir -p "$INSTALL_DIR"
  cp "${tmp_dir}/${asset_name}" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  echo ""
  echo "Installed kane-cli v${version} to ${INSTALL_DIR}/${BINARY_NAME}"

  # Check if install dir is in PATH
  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    echo ""
    echo "Add to your PATH:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    echo ""
    echo "Or move the binary to a directory already in your PATH:"
    echo "  sudo mv ${INSTALL_DIR}/${BINARY_NAME} /usr/local/bin/"
  fi

  echo ""
  echo "Run 'kane-cli --version' to verify."
}

main
