<!-- Read this for the Test Manager (TMS) agent surface — what gets uploaded, where the run lands, the `projects` / `folders` subcommands and their NDJSON wire shape, and the run-startup auto-default event. Non-TTY surface only; the human config flow / interactive picker lives in the public user guide. -->

# Test Manager Reference — Agent Surface

Every kane-cli session uploads to a TestmuAI **Test Manager (TMS)** test case. The session lands inside a **project** (required) and optionally a **folder** inside that project. This page is the agent-facing surface for everything that touches TMS: where the run ends up, how to browse and create projects/folders programmatically, and the event the run-startup gate emits when nothing is configured.

Field names below are for parsing only — translate to plain language for the user, per the §5 rule in `SKILL.md`.

---

## 1. Where a run lands

After a successful upload, the terminal `run_end` event (`testmd_done` for `testmd run`) carries the dashboard link:

```json
{"type":"run_end","status":"passed", "test_url":"https://test-manager.lambdatest.com/projects/<id>/test-cases/<id>", ...}
```

For `testmd run`, the `test_md_summary` / `test_md_done` events also carry a `share_url` — a 7-day, no-login link suitable for CI artifacts.

Surface `test_url` (and `share_url` when present) as a "View in Test Manager" line per the §1.4 results table in `SKILL.md`. Never paste raw URLs into the middle of a summary — they belong in the results table.

---

## 2. Projects & folders — selecting where uploads land

Two ways an agent influences placement:

- **Programmatically**, via the `projects` / `folders` subcommands (§3 + §4) — list, search, create, then persist with `kane-cli config project <id>` / `kane-cli config folder <id>`.
- **Passively**, by observing the `project_folder_auto_defaulted` event the run-startup gate emits when nothing is configured (§5).

In a non-TTY context (CI, pipes, every `--agent` caller), the no-arg form of `config project` / `config folder` will not prompt — always pass an explicit `<id>`. The interactive picker is the human-facing path and is documented in the user guide.

---

## 3. Listing — `projects list` / `folders list`

```bash
kane-cli projects list [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  list [--search <q>] [--limit <n>] [--offset <n>] --agent
```

| Flag | Purpose |
|---|---|
| `--search <q>` | Filter by name (substring match). |
| `--limit <n>` | Page size. Default is small (~10). Very large values are capped. |
| `--offset <n>` | Skip the first N rows. |
| `--agent` | Force NDJSON. Auto-on when stdout is piped/redirected, but pass it explicitly anyway. |

`folders list` operates inside the currently configured project. If none is configured, list projects first or rely on §5.

### Wire shape

Each result line:

```json
{"id":"01J69X773TSY9TCHZY4VAT9VBH","name":"KaneAI Generated"}
```

Just `id` + `name`. The terminal line on every page:

```json
{"_meta":"page","limit":10,"offset":0,"returned":10,"has_more":true}
```

| Field | Meaning |
|---|---|
| `_meta: "page"` | Discriminator — distinguishes pagination metadata from a result row. Skip when collecting results. |
| `limit` / `offset` | Echoed from the request. |
| `returned` | Number of result rows on this page (≤ `limit`). |
| `has_more` | `true` if another page exists. There is no `total` — only a "more remaining" signal, so don't promise an exact count to the user. |

### Pagination idiom

```bash
offset=0; limit=10
while :; do
  page=$(kane-cli projects list --limit "$limit" --offset "$offset" --agent)
  echo "$page" | jq -c 'select(._meta != "page")'    # result rows
  more=$(echo "$page" | jq -r 'select(._meta == "page") | .has_more')
  [ "$more" = "true" ] || break
  offset=$((offset + limit))
done
```

Same pattern for `folders list`.

---

## 4. Creating — `projects create` / `folders create`

```bash
kane-cli projects create "<name>" [--description "<text>"] --agent
kane-cli folders  create "<name>" [--description "<text>"] --agent
```

NDJSON: one line describing the new id + name. `folders create` files the folder inside the currently configured project.

To use the result for subsequent runs, persist with `kane-cli config project <id>` / `kane-cli config folder <id>` — non-interactive when called with an explicit `<id>`.

---

## 5. The run-startup auto-default event

`kane-cli run`, `kane-cli testmd run`, and `kane-cli generate` all validate the cached project/folder before launching anything. Three outcomes:

1. **Cached project/folder still valid** → run proceeds. No event.
2. **Nothing configured, or the cached IDs are gone / inaccessible** → kane-cli resolves a sensible project/folder headlessly (find-or-create), then emits a typed event before the run starts:

   ```
   {"type": "project_folder_auto_defaulted", ...}
   ```

   The event carries the resolved project + folder so the caller knows what was picked. Translate it for the human user — for example:

   > kane-cli auto-selected project **<name>** / folder **<name>** for this run.

   Don't surface raw field names.

3. **No usable credentials in a non-TTY context** → exit code `2` with an auth/setup error.

### Self-healing for stale IDs

If a previously-configured project/folder becomes unusable (deleted, renamed, access revoked, or a typo was saved as the ID), TMS returns a `4xx` for the validation call and the gate treats both as **missing** — it clears the stale value and re-resolves via auto-default. The run is not aborted for this.

Transient validation failures (`5xx`, network, timeout) are treated as **error** and the gate fails open with the cached IDs so brief upstream hiccups don't block a run.

### When you see the event

Surface it as a one-line note, then continue parsing the run normally. If the user wants their runs in a different project, point them at the user guide's project/folder configuration page — the public `kane-cli config project [<id>]` / `kane-cli config folder [<id>]` commands cover the human flow.

---

## 6. Exit codes (TMS subcommands only)

| Code | Meaning |
|---|---|
| 0 | OK |
| 2 | Auth/setup error (missing or invalid credentials) or unknown subcommand |

Other codes are run-specific (`run` / `testmd run` / `generate`) and don't apply to `projects` / `folders`.
