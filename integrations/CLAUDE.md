# integrations/ — third-party agent harness mirrors of the Kane CLI skill

This folder packages the canonical Kane CLI skill into the formats that third-party agentic IDEs and assistants understand. Each subfolder targets one harness.

## Source of truth

The single source of truth for every Kane CLI fact — commands, flags, exit codes, NDJSON schema, log layout, `_test.md` format, parse errors — is:

```
skill-installer/skills/SKILL.md
```

**Edit `SKILL.md` first.** Every integration here mirrors from it. If a fact appears in an integration that is not in `SKILL.md`, that's a bug.

## What's here

| Subfolder | Target harness | Update guide |
|---|---|---|
| `kiro-powers/` | [Kiro IDE](https://kiro.dev/) — packaged as a Kiro "power" (`POWER.md` + `steering/` + sample hook). | `integrations/docs/kiro-powers.md` |

When adding a new integration target (Cursor, Continue, Cline, Aider, etc.), follow the same pattern: a subfolder per harness, plus an update guide at `integrations/docs/<harness>.md` that explains the mapping back to `SKILL.md`.

## Rules for editing this folder

1. **Read `SKILL.md` first.** If you're updating an integration to track an upstream change, the diff in `SKILL.md` is the authoritative description of what changed.
2. **Use the per-integration update guide** in `integrations/docs/` — it has the mapping table from `SKILL.md` sections to integration files, the verification checklist, and the list of fabricated facts the previous draft had so we don't reintroduce them.
3. **Don't invent facts not in `SKILL.md`.** No version-specific release notes, no UI features we can't verify, no stdin protocols, no download URLs we haven't confirmed. If a behavior is real but undocumented in `SKILL.md`, add it to `SKILL.md` first, then mirror it here.
4. **Respect each harness's spec.** Kiro Powers, for example, expects `POWER.md` frontmatter with specific keys and a steering-file convention; don't break the format even if it diverges from how `SKILL.md` is structured.
5. **One harness per subfolder.** Don't mix concerns. If two harnesses need the same fact, it goes in `SKILL.md` and both mirrors update independently.

## Workflow when `SKILL.md` changes

1. Read the upstream diff.
2. For each integration in this folder, open its update guide in `integrations/docs/`.
3. Update the integration files per the guide's mapping table.
4. Run the integration's verification checklist.
5. Commit (one commit per integration is fine; group them if the upstream change was small).

## Workflow when adding a new integration

1. Create `integrations/<harness>/` with the harness-specific layout.
2. Translate `SKILL.md` into that layout — same facts, harness-native framing.
3. Write `integrations/docs/<harness>.md` with: source-of-truth pointer, mapping table from `SKILL.md` to the new files, list of harness-specific framing to preserve, list of things-not-to-invent, verification checklist, local-testing instructions.
4. Add a row to the "What's here" table above.
