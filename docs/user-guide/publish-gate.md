# Publish-gate recipe

A reusable Kane objective for gating a publish on one real-browser CTA check. Drop this pattern into any project and run it before you flip a page to "published".

The gate closes a specific gap: uptime monitors check whether a page *loads*; synthetic monitors alert *after* a visitor already bounced. A publish-gate stands between build and publish and refuses to ship a page whose primary CTA is broken.

## Objective template

```
Open the page. Type "{{tester_email}}" into the email input.
Click the "{{cta}}" button.
Confirm a success message containing "{{success_text}}" appears on the page.
```

Fill `{{cta}}` and `{{success_text}}` from your page config, and `{{tester_email}}` from a test-only variable.

## Run

```bash
kane-cli run "<the objective above, with vars filled>" \
  --agent --headless --url "{{preview_url}}" \
  --final-validation on --timeout 120
```

## Deriving a block/allow verdict from the NDJSON

Kane's step lines carry `status: "running" | "done"` — not pass/fail. The authoritative verdict lives in the `run_end` event. Re-derive it from several fields at once so a single stray field can't wave a broken page through:

```
verdict = TRUE  iff  run_end.status === "passed"
                &&   run_end.result_code === 100
                &&   run_end.reason_code startsWith "success"
                &&   every per_flow_metadata[].result_code === "100"
```

Anything else → FALSE → do not publish.

On a genuinely dead button Kane returns `status: "failed"` with a `reason_code` such as `assertion_error.confirmed_product_bug` or `stuck.ap_stuck`, and its `summary` describes the bug in plain language — which you can feed straight back to the agent that will fix the wiring, then re-run the gate.

## Notes

- Run the gate **once at publish**, not per-visitor. A real-browser check takes tens of seconds; it belongs at the publish boundary.
- Persist a signed receipt of the green run so visitors can verify the page was proven working at a specific time. See [evidence.md](./evidence.md) for evidence-pack conventions.

---

Contributed from the Latch project (TestMu AI Kane CLI Online Hackathon — "Apps that verify themselves" track).
