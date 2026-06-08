# Updating the Kiro Powers integration

The `integrations/kiro-powers/` folder is a [Kiro power](https://kiro.dev/docs/powers/) for Kane CLI. It is a **translation** of the canonical Kane CLI skill into Kiro's POWER.md + steering-file format. The canonical source is `skill-installer/skills/SKILL.md`. **Every time `SKILL.md` changes, this integration may need to change too.** This document is the update playbook.

## TL;DR

1. Read what changed in `skill-installer/skills/SKILL.md`.
2. Find the corresponding sections in `integrations/kiro-powers/` using the mapping table below.
3. Update those sections, keeping the Kiro-specific framing (frontmatter, steering-file split, "wait for run_end" rule, in-power steering references).
4. Run the verification checklist.
5. Commit.

## Source of truth

| Artifact | Path | Purpose |
|---|---|---|
| **Canonical skill** | `skill-installer/skills/SKILL.md` | Source of every CLI fact: command shapes, flags, exit codes, NDJSON essentials, decision tree, results presentation. **Edit this first.** Every other integration mirrors from here. |
| **Canonical references** | `skill-installer/skills/references/*.md` | On-demand reference content: `objectives-cookbook.md` (pattern catalog + checkpoint analyze methods), `testmd.md` (file format, replay), `generate.md` + `generate-parsing.md` (AI test-case authoring), `test-manager.md` (project/folder agent surface + auto-default event), `parsing.md` (full NDJSON schema), `debug.md` (log layout), `parallel.md`, `setup-and-config.md`. Equally authoritative — facts in any of these must mirror through. |
| Kiro power root | `integrations/kiro-powers/POWER.md` | Frontmatter (name/displayName/keywords/author), onboarding, condensed command reference, steering-file mapping. |
| `kane-cli run` steering | `integrations/kiro-powers/steering/kane-cli-run.md` | Full reference for one-shot `kane-cli run`: objective patterns + checkpoint analyze methods (Visual / Textual-DOM / URL / Title / DevTools→Network/Console/Performance/Cookies/localStorage), full flag table, NDJSON parsing (including `project_folder_auto_defaulted`), results presentation, failure diagnosis, parallel execution, project/folder management (`projects`/`folders list|create`, auto-default gate). |
| `kane-cli testmd` steering | `integrations/kiro-powers/steering/kane-cli-testmd.md` | Full reference for `kane-cli testmd`: file format, frontmatter, `@import`, replay/author cache, `Result.md`, CI patterns, parse errors, generate → testmd pipeline. |
| `kane-cli generate` steering | `integrations/kiro-powers/steering/kane-cli-generate.md` | Full reference for `kane-cli generate`: the three modes (new / refine / save), clarification round-trips, the refine→save→run loop, typed NDJSON event schema (`generate_*`), result presentation, the generate → testmd handoff. |
| Hook template | `integrations/kiro-powers/hooks/kane-verify.kiro.hook` | Sample agent hook the user copies to their workspace `.kiro/hooks/`. |

If a fact appears in this integration that is **not** in `SKILL.md` or one of the `references/*.md`, that's a bug — either backfill the canonical source first, or delete the fact from the integration.

## SKILL.md (+ references) → Kiro Powers mapping

The canonical skill is a thin `SKILL.md` (7 sections, ~300 lines) plus on-demand `references/*.md`. The Kiro power's three steering files absorb the equivalent depth — Kiro reads the right steering file per workflow, the way Claude Code reads the right reference file on demand.

| Canonical source | Where it lives in the Kiro power |
|---|---|
| `SKILL.md` §1 Live narration & results presentation (Monitor/Bash launch decision is Claude-Code-specific — Kiro keeps its own narration model) | `steering/kane-cli-run.md` → Presenting results |
| `SKILL.md` §2 Decision tree | `steering/kane-cli-run.md` → Decision tree, `steering/kane-cli-testmd.md` → When to recommend `testmd`, and `steering/kane-cli-generate.md` → When to recommend `generate` |
| `SKILL.md` §3 Building a `run` command — flags, exit codes, examples, bare-objective guardrail | `POWER.md` → Command reference (condensed) **and** `steering/kane-cli-run.md` → Full flag reference |
| `SKILL.md` §4 Writing objectives — three patterns, "store as", do/don't | `steering/kane-cli-run.md` → Writing objectives — three patterns |
| `SKILL.md` §5 Parsing `--agent` output — essentials (includes `project_folder_auto_defaulted` in typed events) | `steering/kane-cli-run.md` → Parsing the NDJSON output (Event types + Parsing strategy summary) |
| `SKILL.md` §6 Generate test cases (authoring — no browser) | `POWER.md` → Overview (the third "way Kiro uses it") **and** all of `steering/kane-cli-generate.md` |
| `SKILL.md` §7 When to read which reference | Kiro analogue: `POWER.md`'s steering-file mapping (POWER.md tells Kiro when to load each steering file) |
| `references/objectives-cookbook.md` — analyze methods (Visual / Textual-DOM / URL / Title / DevTools→Network/Console/Performance/Cookies/localStorage), operators, chaining, pitfalls, worked examples | `steering/kane-cli-run.md` → Analyze methods — picking the right checkpoint (plus the existing Combining patterns, Assertion specificity, and Do / Don't sections) |
| `references/testmd.md` — testmd file format, replay & cascade, `@import`, commands, parse errors, gate-fires-before-launch note | All of `steering/kane-cli-testmd.md` |
| `references/generate.md` — generate modes, refine→save→run loop, clarification handling, Functional-only save, generate→testmd handoff | All of `steering/kane-cli-generate.md` |
| `references/generate-parsing.md` — typed `generate_*` event schema, terminal `generate_done`, exit codes | `steering/kane-cli-generate.md` → Parsing the NDJSON output + Terminal `generate_done` + Exit codes |
| `references/parsing.md` — full NDJSON event schemas (`project_folder_auto_defaulted`, `bifurcation`, `child_agent_*`, `ask_user`, complete `run_end` fields) | `steering/kane-cli-run.md` → Parsing the NDJSON output (full event-type list + Terminal `run_end` event) |
| `references/test-manager.md` — project/folder agent surface (`projects`/`folders list|create` NDJSON wire shape, pagination), run-startup auto-default gate, `project_folder_auto_defaulted` event, self-healing for stale IDs | `POWER.md` → Step 3 (project/folder onboarding) **and** `steering/kane-cli-run.md` → Browsing / creating projects and folders + The run-startup auto-default gate **and** `steering/kane-cli-testmd.md` → Quick start (gate note) **and** `steering/kane-cli-generate.md` → Configuration surface (gate note) |
| `references/debug.md` — log layout, debugging flow, common failure patterns (incl. "did you mean" subcommand and self-healing rows), bug-report heuristic | `steering/kane-cli-run.md` → Failure handling & log inspection + Bug-report heuristic |
| `references/parallel.md` — when to split, agent prompt template, batch summary | `steering/kane-cli-run.md` → Parallel execution |
| `references/setup-and-config.md` — install / auth / variables precedence / context files / config commands / Chrome management / directory layout | `POWER.md` → Onboarding (Steps 1–3) + `steering/kane-cli-run.md` → Variables and secrets + Context files + Configuration surface |

## Kiro-specific framing (don't lose these on edit)

The integration is not a verbatim copy of `SKILL.md`. It adds and preserves Kiro-specific framing:

1. **POWER.md frontmatter** — Kiro requires `name`, `displayName`, `description`, `keywords`, `author`. Keep them up to date and keep `keywords` broad enough to activate on user phrasing like "browser", "smoke test", "verify deploy".
2. **Onboarding is for Kiro to execute** — written as "Kiro runs this", not "user runs this". Only step back to the user when the action genuinely needs human input (credentials, project / folder IDs).
3. **Steering-file mapping in POWER.md** — POWER.md explicitly says when to load each steering file ("`kane-cli-run.md` for every `kane-cli run` invocation; `kane-cli-testmd.md` for any `_test.md` work"). Kiro's docs describe this as the way to scope steering content (see [kiro.dev/docs/powers/create](https://kiro.dev/docs/powers/create/)).
4. **Steering file naming** — `{tool}-{workflow}.md` (`kane-cli-run.md`, `kane-cli-testmd.md`). Avoid generic names like `steering.md`.
5. **No `inclusion:` frontmatter on in-power steering files.** That key is for `.kiro/steering/` workspace files, not steering files inside a power. POWER.md does the scoping.
6. **The "wait for `run_end`" rule** is restated prominently in `kane-cli-run.md` because the most common Kiro failure mode is the agent acting on partial output. Don't soften it.
7. **Internal field names are internal.** `run_end`, `final_state`, `session_dir`, `run_dir`, `NDJSON` — never expose these to the user. Translate them into plain language.
8. **Hook template ships in `hooks/`**, but the user must copy it to `.kiro/hooks/kane-verify.kiro.hook` in their own workspace. Powers don't install hooks for the user; the hook file in this repo is a template.

## Things to NOT put in the integration

The previous draft drifted from `SKILL.md` by inventing facts. Don't repeat these:

- ❌ **Version-specific release notes** (e.g. "What's new in 0.2.11"). `SKILL.md` doesn't reference a version; neither should we. Behavior we describe should hold across the supported range.
- ❌ **A multi-objective stdin / `/exit` session model for `kane-cli run`.** `SKILL.md` treats `kane-cli run` as single-shot — the process exits after `run_end`. Don't invent a stdin protocol.
- ❌ **"Project + folder mandatory or runs are blocked."** `SKILL.md` does not enforce this. Set them as a recommendation, not a hard mandate.
- ❌ **Made-up UI features** (floating in-browser badge, tabbed help, breadcrumbs, esc-to-default-pick, etc.). If `SKILL.md` doesn't mention it, don't claim it.
- ❌ **"The Playwright script is the deliverable."** `--code-export` is one optional flag. Don't pitch it as the primary purpose.
- ❌ **Standalone binary download URLs** that aren't documented in `SKILL.md`. They may or may not exist; don't guess.

When in doubt: **say only what `SKILL.md` says.**

## Update workflow

### When `SKILL.md` changes

1. **Read the diff.** Look at the section headings in the mapping table above to see which Kiro files might need to move.
2. **Update `POWER.md` first** if the change touches anything in the condensed command reference, onboarding, or steering-file mapping.
3. **Update the matching steering file(s)** if the change touches details (objective patterns, flags, NDJSON schema, parse errors, etc.).
4. **Update the hook template** only if the recommended one-shot smoke-test command shape changed.
5. **Run the verification checklist below.**
6. **Commit with a message that names the upstream change**, e.g. `kiro-powers: mirror SKILL.md update for new --foo flag`.

### When the Kiro Powers spec changes

If [kiro.dev/docs/powers/create](https://kiro.dev/docs/powers/create/) changes the required frontmatter, directory layout, or steering-file convention, update the integration to match:

1. Re-read the spec and the official example powers at https://github.com/kirodotdev/powers.
2. Update the frontmatter in `POWER.md` to match new required keys.
3. Rename / restructure files if the convention changed.
4. Update this doc to reflect the new spec.

### When adding a new flag or command to `kane-cli`

1. Add it to `SKILL.md` first.
2. Add it to the condensed flag table in `POWER.md` if it's commonly used; otherwise just to the full flag table in the relevant steering file.
3. Add an example showing the flag in context.
4. Update the verification checklist if the flag changes recommended defaults.

## Verification checklist

Before committing changes to the integration:

- [ ] POWER.md frontmatter has all required keys: `name`, `displayName`, `description`, `keywords`, `author`.
- [ ] `keywords` still activates on common user phrasing (browser, smoke test, deploy, verify, e2e, ui).
- [ ] Every fact in POWER.md / steering / hook can be traced back to a line in `SKILL.md`.
- [ ] Onboarding steps still produce the target end state (`kane-cli --version`, `kane-cli whoami`, `kane-cli config show`).
- [ ] Steering files are named `kane-cli-run.md` / `kane-cli-testmd.md` (Kiro convention `{tool}-{workflow}.md`).
- [ ] Steering files do **not** have `inclusion:` frontmatter (that's for workspace `.kiro/steering/` files, not in-power steering).
- [ ] POWER.md explicitly tells Kiro when to load each steering file.
- [ ] The "wait for `run_end`" rule still appears prominently in `kane-cli-run.md`.
- [ ] No internal field names (`run_end`, `final_state`, `session_dir`, `run_dir`, `NDJSON`) appear in user-facing message templates.
- [ ] No fabricated facts: no version-specific release notes, no stdin / `/exit` protocol, no made-up UI features, no unverified download URLs.
- [ ] Hook template (`hooks/kane-verify.kiro.hook`) still parses as valid JSON.

## Testing the power locally

To dogfood changes in a real Kiro install before publishing:

1. Open Kiro → Powers panel → **Add power from Local Path**.
2. Point it at `integrations/kiro-powers/`.
3. Activate the power by mentioning one of the keywords ("browser", "kane-cli", "smoke test", etc.).
4. Confirm Kiro loaded `POWER.md` and the right steering file for the conversation.
5. Run a real command end to end — the simplest smoke test is `kane-cli run "Go to https://example.com, store the page title as 'title'" --agent`.

If the power loaded but the agent hallucinated commands or flags that aren't in `SKILL.md`, the steering file is the wrong size — either too long (Kiro skipped past it) or contradicts itself. Tighten and re-test.

## References

- [Kiro Powers overview](https://kiro.dev/docs/powers/)
- [Create powers](https://kiro.dev/docs/powers/create/)
- [Install powers](https://kiro.dev/docs/powers/installation/)
- [Official example powers (kirodotdev/powers)](https://github.com/kirodotdev/powers)
- [Kiro steering files (workspace-level, distinct from in-power steering)](https://kiro.dev/docs/steering/)
