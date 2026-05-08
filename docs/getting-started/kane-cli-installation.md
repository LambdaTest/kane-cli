---
id: kane-cli-installation
title: Installing Kane CLI
sidebar_label: Installation
description: Install Kane CLI using npm. Supports macOS (Apple Silicon and Intel), Linux (x64), and Windows (x64).
keywords:
  - kane cli
  - install kane cli
  - kaneai
  - testmu ai
  - npm install
url: https://www.testmuai.com/support/docs/kane-cli-installation/
site_name: TestMu AI
slug: kane-cli-installation/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-installation/
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import BrandName, { BRAND_URL } from '@site/src/component/BrandName';

<script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({
       "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.testmuai.com"
        },{
          "@type": "ListItem",
          "position": 2,
          "name": "Support",
          "item": "https://www.testmuai.com/support/docs/"
        },{
          "@type": "ListItem",
          "position": 3,
          "name": "Kane CLI",
          "item": "https://www.testmuai.com/support/docs/kane-cli-introduction/"
        }]
      })
    }}
></script>

Kane CLI is published to the public npm registry as `@testmuai/kane-cli`. Install it globally with `npm` to get the `kane-cli` command on your `PATH`.

## Install

```bash
npm install -g @testmuai/kane-cli
```

Platform-specific native binaries are installed automatically for your OS. No additional configuration is needed.

:::note
Kane CLI requires **Node.js 18 or higher** and **Google Chrome** installed on your system. Chrome is used as the automation browser and is launched automatically when you run a test.
:::

## Verify

```bash
kane-cli --version
```

If the command is not found, your shell is not seeing the npm global `bin` directory. Open a new terminal or update `PATH`, then try again.

## Platform Support

| Platform | Architecture | Supported |
|----------|-------------|-----------|
| macOS | Apple Silicon (ARM) | ✅ |
| macOS | Intel (x64) | ✅ |
| Linux | x64 | ✅ |
| Windows | x64 | ✅ |

## Update

Kane CLI checks the npm registry once every 24 hours when you launch it. When a newer version is available, the CLI prints a one-line notification on startup with the current and latest versions. The check runs in the background and never blocks startup.

Upgrade with:

```bash
npm install -g @testmuai/kane-cli@latest
```

After upgrading, run `kane-cli --version` to confirm the new version is active.

## Uninstall

```bash
npm uninstall -g @testmuai/kane-cli
```

This removes the `kane-cli` binary but leaves your local data in place. Kane CLI stores credentials, configuration, sessions, and Chrome profile data under `~/.testmuai/kaneai/`. To wipe that state as well:

```bash
rm -rf ~/.testmuai/kaneai
```

Only do this if you want a clean reset — it logs you out of all profiles and deletes saved configuration, session history, and command history.

## Troubleshooting Installation

**`kane-cli: command not found` after install**

Your npm global bin directory is not in your PATH. Find it and add it:

```bash
# Find your npm global bin directory
npm config get prefix

# The kane-cli binary lives in <prefix>/bin on macOS/Linux, and <prefix> on Windows
# Add it to your PATH in ~/.zshrc or ~/.bashrc
export PATH="$(npm config get prefix)/bin:$PATH"
```

**Installation fails on Node 16**

Kane CLI requires Node.js 18+. Check your version and upgrade if needed:

```bash
node --version
```

## Next Step

[Quick Start](/support/docs/kane-cli-quickstart/): Authenticate and run your first test.
