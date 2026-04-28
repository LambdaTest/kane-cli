# Authentication

kane-cli authenticates against your TestmuAI account before it can run tests, upload sessions, or talk to TMS. There are two ways to sign in:

- **OAuth** — recommended for everyday local use. Opens a browser, you approve once, and tokens are stored on your machine.
- **Basic auth** — your TestmuAI username and access key. Use this in CI and other non-interactive environments where no browser is available.

## OAuth login

```bash
kane-cli login --oauth
```

kane-cli opens your default browser to the TestmuAI consent page. Sign in and approve the request. When the browser hands control back, kane-cli stores your tokens locally and you are signed in. You usually do not need to log in again on the same machine — kane-cli reuses the stored session on subsequent runs.

If you run `kane-cli login` interactively without flags, kane-cli launches a guided login wizard that walks you through choosing a method, profile, and (for basic auth) entering credentials.

## Basic auth

Basic auth uses your TestmuAI username and account access key. It is the right choice for CI runners, Docker containers, and any other environment where opening a browser is not possible.

### Per-run flags

Pass credentials directly on the command you are running. They take precedence over any stored credentials:

```bash
kane-cli run "Search for a product" \
  --username "you@example.com" \
  --access-key "YOUR_ACCESS_KEY"
```

Both `kane-cli run` and `kane-cli feedback` accept `--username` and `--access-key`.

### Persistent basic auth

To save basic auth credentials for a profile so you do not have to pass them every time, log in with the basic auth flags:

```bash
kane-cli login --username "you@example.com" --access-key "YOUR_ACCESS_KEY"
```

Saved basic auth is used automatically for subsequent commands run under that profile.

### Where to find your access key

Sign in to the TestmuAI dashboard, open your profile/account settings, and copy the access key. Treat it like a password — anyone with your username and access key can run tests on your account.

## Profiles

A profile is a named login. Profiles are useful when you work with more than one TestmuAI account or organisation, or when you want separate credentials for personal and team use without re-authenticating each time you switch.

### Create a profile

Pass `--profile <name>` to `login` to authenticate under a named profile. If you omit `--profile`, kane-cli uses the profile named `default`.

```bash
kane-cli login --oauth --profile work
kane-cli login --oauth --profile personal
```

You can mix methods — one profile can use OAuth and another can use basic auth.

### List profiles

```bash
kane-cli profiles list
```

Prints each saved profile with its environment, marking the active one.

### Switch the active profile

```bash
kane-cli profiles switch work
```

Subsequent commands run under `work` until you switch again.

### Delete a profile

```bash
kane-cli profiles delete personal
```

Removes the stored credentials for that profile.

### Run against a specific profile without switching

A few commands accept `--profile <name>` so you can target a profile for a single invocation without changing the active one. This is supported on `kane-cli login`, `kane-cli whoami`, and `kane-cli balance`. For other commands, use `kane-cli profiles switch` first.

## Check who you are logged in as

```bash
kane-cli whoami
```

`whoami` prints an identity card showing the active profile, environment, authentication method (OAuth or basic), the username (when known), and — for OAuth — whether the stored token is valid, expired, or missing, along with its expiry date.

Pass `--profile <name>` to inspect a profile other than the active one.

## Log out

```bash
kane-cli logout
```

`logout` signs out of the active profile. For OAuth profiles, kane-cli revokes the stored tokens with TestmuAI before deleting them. The on-disk credentials for the profile are removed. If you have other profiles configured, kane-cli automatically switches to one of them; otherwise you are left with no active profile.

## Where credentials are stored

Credentials live under your home directory:

```text
~/.testmuai/kaneai/profiles/<profile>/<env>/credentials
```

The file is created with restricted permissions (mode `0600`) so only your user account can read it. There is no need to inspect or edit this file by hand — use `kane-cli login`, `kane-cli logout`, and the `kane-cli profiles` commands to manage it.
