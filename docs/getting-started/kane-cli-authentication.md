---
id: kane-cli-authentication
title: Authentication
sidebar_label: Authentication
description: Authenticate Kane CLI with OAuth or basic auth, manage multiple profiles, and securely store credentials.
keywords:
  - kane cli authentication
  - kane cli login
  - kane cli profiles
  - kaneai
  - testmu ai
  - oauth
  - basic auth
url: https://www.testmuai.com/support/docs/kane-cli-authentication/
site_name: TestMu AI
slug: kane-cli-authentication/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-authentication/
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import CodeBlock from '@theme/CodeBlock';
import BrandName, { BRAND_URL } from '@site/src/component/BrandName';
import {YOUR_LAMBDATEST_USERNAME, YOUR_LAMBDATEST_ACCESS_KEY} from "@site/src/component/keys";

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
        },{
          "@type": "ListItem",
          "position": 4,
          "name": "Authentication",
          "item": "https://www.testmuai.com/support/docs/kane-cli-authentication/"
        }]
      })
    }}
></script>

Kane CLI authenticates against your <BrandName /> account before it can run tests, upload sessions, or interact with Test Manager. There are two authentication methods:

- **OAuth** — recommended for everyday local use. Opens a browser, you approve once, and tokens are stored on your machine.
- **Basic auth** — your <BrandName /> username and access key. Use this in CI and other non-interactive environments where no browser is available.

---

## OAuth Login

```bash
kane-cli login --oauth
```

Kane CLI opens your default browser to the <BrandName /> consent page. Sign in and approve the request. When the browser hands control back, Kane CLI stores your tokens locally and you are signed in. You usually do not need to log in again on the same machine — Kane CLI reuses the stored session on subsequent runs.

If you run `kane-cli login` interactively without flags, Kane CLI launches a guided login wizard that walks you through choosing a method, profile, and (for basic auth) entering credentials.

---

## Basic Auth

Basic auth uses your <BrandName /> username and account access key. It is the right choice for CI runners, Docker containers, and any other environment where opening a browser is not possible.

### Per-Run Flags

Pass credentials directly on the command you are running. They take precedence over any stored credentials:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli run "Search for a product" \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Both `kane-cli run` and `kane-cli feedback` accept `--username` and `--access-key`.

### Persistent Basic Auth

To save basic auth credentials for a profile so you do not have to pass them every time, log in with the basic auth flags:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli login --username "${ YOUR_LAMBDATEST_USERNAME()}" --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Saved basic auth is used automatically for subsequent commands run under that profile.

### Where to Find Your Access Key

Sign in to the <BrandName /> [dashboard](https://accounts.lambdatest.com/dashboard) > **Credentials** and copy your access key. Treat it like a password — anyone with your username and access key can run tests on your account.

---

## Profiles

A profile is a named login. Profiles are useful when you work with more than one <BrandName /> account or organisation, or when you want separate credentials for personal and team use without re-authenticating each time you switch.

### Create a Profile

Pass `--profile <name>` to `login` to authenticate under a named profile. If you omit `--profile`, Kane CLI uses the profile named `default`.

```bash
kane-cli login --oauth --profile work
kane-cli login --oauth --profile personal
```

You can mix methods — one profile can use OAuth and another can use basic auth.

### List Profiles

```bash
kane-cli profiles list
```

Prints each saved profile with its environment, marking the active one.

### Switch the Active Profile

```bash
kane-cli profiles switch work
```

Subsequent commands run under `work` until you switch again.

### Delete a Profile

```bash
kane-cli profiles delete personal
```

Removes the stored credentials for that profile.

### Run Against a Specific Profile Without Switching

A few commands accept `--profile <name>` so you can target a profile for a single invocation without changing the active one. This is supported on `kane-cli login`, `kane-cli whoami`, and `kane-cli balance`. For other commands, use `kane-cli profiles switch` first.

---

## Check Who You Are Logged In As

```bash
kane-cli whoami
```

`whoami` prints an identity card showing the active profile, environment, authentication method (OAuth or basic), the username (when known), and — for OAuth — whether the stored token is valid, expired, or missing, along with its expiry date.

Pass `--profile <name>` to inspect a profile other than the active one.

---

## Log Out

```bash
kane-cli logout
```

`logout` signs out of the active profile. For OAuth profiles, Kane CLI revokes the stored tokens with <BrandName /> before deleting them. The on-disk credentials for the profile are removed. If you have other profiles configured, Kane CLI automatically switches to one of them; otherwise you are left with no active profile.

---

## Where Credentials Are Stored

Credentials live under your home directory:

```text
~/.testmuai/kaneai/profiles/<profile>/<env>/credentials
```

The file is created with restricted permissions (mode `0600`) so only your user account can read it. There is no need to inspect or edit this file by hand — use `kane-cli login`, `kane-cli logout`, and the `kane-cli profiles` commands to manage it.
