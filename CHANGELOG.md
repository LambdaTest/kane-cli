# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Public npm distribution (`@testmuai/kane-cli`)
- Homebrew installation (`brew tap LambdaTest/kane https://github.com/LambdaTest/kane-cli`)
- GitHub Releases with signed binaries and SHA256 checksums
- Shell installer (`curl -fsSL ... | bash`)
- Windows (x64) support with Authenticode signing

## [0.1.0] - 2026-04-02

### Added

- Initial release
- OAuth login flow with LambdaTest accounts
- Interactive TUI for browser automation sessions
- Nuitka-compiled native binaries (macOS ARM64, Linux x64)
- macOS code signing and Apple notarization
- Linux OpenSSL detached signatures
- Background version check with 24h cache
