// The final comment's run report, in its approved layout:
// badges, Tests, Why these tests, Evidence, Policy, footer. Every value comes from the run.

export const MASCOT_URL = "https://raw.githubusercontent.com/LambdaTest/kane-cli/main/integrations/github-action/kane-cli-pr/assets/kane-mascot.png";
/** The first line of every kane comment, working and final. */
export const HEADER = `## <img src="${MASCOT_URL}" width="30" height="23" align="absmiddle" alt=""> kane-cli · gate-keeper`;
export const EVIDENCE_VIEWER = "https://evidence.lambdatest.com/";
export const MAX_SQUARES = 10;
export const MAX_FILES = 4;
export const MAX_POLICY_YAML = 6000;

const FAILING = new Set(["failed", "broken", "interrupted"]);
const C = { blue: "0969da", gray: "6e7781", red: "cf222e", green: "1a7f37", orange: "bc4c00" };

/** shields.io path part: dashes and underscores doubled, the rest URL-encoded. */
const shield = (s) => encodeURIComponent(String(s).replace(/-/g, "--").replace(/_/g, "__"));
export const badge = (label, value, color, alt) => `![${alt}](https://img.shields.io/badge/${shield(label)}-${shield(value)}-${color}?style=for-the-badge)`;

const cell = (s) => String(s ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
const nameOf = (r) => r.title || r.test;

export const evidenceLink = (repo, artifactId) => `${EVIDENCE_VIEWER}?pack=gh-artifact:${repo}/${artifactId}`;

/** "2 m 05 s", "41 s". */
export function duration(s) {
  if (typeof s !== "number" || !Number.isFinite(s)) return null;
  const t = Math.round(s);
  return t < 60 ? `${t} s` : `${Math.floor(t / 60)} m ${String(t % 60).padStart(2, "0")} s`;
}

/** Counts over the run's rows and results. */
export function tally(rows, results) {
  const byTest = new Map((results ?? []).map((r) => [r.test, r]));
  const ran = (results ?? []).filter((r) => r.verdict !== "not_run");
  return {
    byTest,
    impacted: rows.filter((r) => r.new === false).length,
    added: rows.filter((r) => r.new === true).length,
    ran: ran.length,
    failed: ran.filter((r) => FAILING.has(r.verdict)).length,
    passed: ran.filter((r) => r.verdict === "passed").length,
    healed: ran.filter((r) => r.healed === true).length,
  };
}

/**
 * True only for a real verdict: a policy applied, a verdict event naming it, and its gates read
 * from the verdict file. Anything less shows no policy badge, no Policy section and no check.
 */
export function hasVerdict(policy, verdict, doc) {
  return Boolean(policy?.configured && policy.supported && !policy.missing && verdict?.policies?.[0] && !verdict.error && doc?.gates?.length);
}

function policyBadge(verdict) {
  if (verdict?.result === "pass") return badge("policy", "passed", C.green, "policy passed");
  if (verdict?.result === "fail") return badge("policy", "failed", C.red, "policy failed");
  return badge("policy", "errored", C.red, "policy errored");
}

export function badges({ rows, results, ran, policy, verdict, policyDoc }) {
  const t = tally(rows, results);
  const out = [badge("impacted", t.impacted, C.blue, `${t.impacted} impacted`), badge("new in PR", t.added, C.gray, `${t.added} new`)];
  if (ran) {
    out.push(t.failed > 0 ? badge("failing", t.failed, C.red, `${t.failed} failing`) : badge("passing", t.passed, C.green, `${t.passed} passing`));
    if (t.healed > 0) out.push(badge("healed", t.healed, C.orange, `${t.healed} healed`));
    if (hasVerdict(policy, verdict, policyDoc)) out.push(policyBadge(verdict));
  }
  return out.join(" ");
}

/** The Tests row's icon and text. */
function testRow(r, res) {
  if (!r.path) return ["⚠️", "no file in this PR, so it didn't run"];
  if (!res || res.verdict === "not_run") return ["⚠️", "not run"];
  const heal = res.healed ? " · 🩹 healed: kane re-recorded a step that no longer matched the page" : "";
  if (res.verdict === "passed") return ["✅", (res.duration_s != null ? `passed in ${duration(res.duration_s)}` : "passed") + heal];
  return ["❌", (res.note || res.verdict) + (res.healed ? " · 🩹 heal tried, still failing" : "")];
}

export function testsSection(rows, results) {
  const t = tally(rows, results);
  const lines = [`<details>`, `<summary>🧪 <b>Tests</b> — ${t.ran} ran · ${t.failed} failed</summary>`, `<br>`, ``, `| | Test | ${t.failed > 0 ? "What went wrong" : "Result"} |`, `|:---:|---|---|`];
  for (const r of rows) {
    const [icon, text] = testRow(r, t.byTest.get(r.test));
    lines.push(`| ${icon} | **${cell(nameOf(r))}** | ${cell(text)} |`);
  }
  lines.push(`</details>`);
  return lines.join("\n");
}

function squares(list, byTest) {
  const marks = list.map((r) => {
    const v = byTest.get(r.test)?.verdict;
    return FAILING.has(v) ? "🟥" : v === "passed" ? "🟩" : "⬜";
  });
  return marks.length > MAX_SQUARES ? `${marks.slice(0, MAX_SQUARES).join("")} +${marks.length - MAX_SQUARES}` : marks.join("");
}

/** Requirements (use cases) → their tests, in first-seen order; tests with none go to "Other matches". */
export function requirementGroups(rows) {
  const groups = new Map();
  const other = [];
  for (const r of rows) {
    const ucs = (r.use_cases ?? []).filter((u) => u && (u.title || u.id));
    if (ucs.length === 0) other.push(r);
    for (const u of ucs) {
      const key = String(u.id ?? u.title).toLowerCase();
      if (!groups.has(key)) groups.set(key, { title: u.title || u.id, tests: [] });
      if (!groups.get(key).tests.includes(r)) groups.get(key).tests.push(r);
    }
  }
  return { groups: [...groups.values()], other };
}

const fileList = (files) => {
  const shown = files.slice(0, MAX_FILES).map((f) => `\`${f}\``);
  return files.length > MAX_FILES ? `${shown.join(", ")} +${files.length - MAX_FILES} more` : shown.join(", ");
};

/** The one muted line for matches with no file in this repository; null when there are none. */
export function filelessNote(n) {
  if (!n) return null;
  return n === 1 ? "<sub>1 more matched test isn't in this repository, so it wasn't run.</sub>" : `<sub>${n} more matched tests aren't in this repository, so they weren't run.</sub>`;
}

export function whySection({ rows, results, ran, files = [], fileless = 0, defaultBranch = "main" }) {
  const t = tally(rows, results);
  const { groups, other } = requirementGroups(rows);
  const k = groups.length;
  const lines = [`<details>`, `<summary>🔎 <b>Why these tests</b> — the change touches ${k} requirement${k === 1 ? "" : "s"}</summary>`, `<br>`, ``];
  lines.push(`${files.length ? `This PR changes ${fileList(files)}. ` : ""}kane matched that change to the requirements each test verifies:`, ``);
  const reasonOf = (r) => {
    const s = String(r.reason ?? "").replace(/\s+/g, " ").trim();
    return s ? ` — <i>${cell(s.length > 220 ? s.slice(0, 219) + "…" : s)}</i>` : "";
  };
  const item = (r) => `  - ${cell(nameOf(r))}${r.path ? "" : " *(no file in this PR)*"}${reasonOf(r)}`;
  for (const g of groups) {
    const f = g.tests.filter((r) => FAILING.has(t.byTest.get(r.test)?.verdict)).length;
    const status = ran ? ` — ${squares(g.tests, t.byTest)} ${f} of ${g.tests.length} failing` : ` — ${g.tests.length} test${g.tests.length === 1 ? "" : "s"}`;
    lines.push(`- **🎯 ${cell(g.title)}**${status}`, ...g.tests.map(item));
  }
  if (other.length) lines.push(`- **Other matches**${ran ? ` — ${squares(other, t.byTest)}` : ""}`, ...other.map(item));
  lines.push(``);
  const n = t.impacted;
  const m = t.added;
  const branch = `\`${defaultBranch}\``;
  if (m === 0) lines.push(`All ${n} test${n === 1 ? "" : "s"} already exist${n === 1 ? "s" : ""} on ${branch}, so ${n === 1 ? "it counts" : "they count"} as impacted (none are new in this PR).`);
  else if (n === 0) lines.push(`All ${m} test${m === 1 ? " is" : "s are"} new in this PR (none exist on ${branch} yet).`);
  else lines.push(`${n} test${n === 1 ? "" : "s"} already exist${n === 1 ? "s" : ""} on ${branch}, so ${n === 1 ? "it counts" : "they count"} as impacted; ${m} ${m === 1 ? "is" : "are"} new in this PR.`);
  const note = filelessNote(fileless);
  if (note) lines.push(``, note);
  lines.push(`</details>`);
  return lines.join("\n");
}

export function evidenceSection({ path, repo, artifactId, artifactName, ran }) {
  const lines = ["### 🧾 Evidence"];
  if (!path) lines.push("No evidence pack was produced for this run.");
  else if (!artifactId) lines.push("The evidence pack wasn't uploaded (see the workflow run).");
  else {
    lines.push(`[${badge("Open the evidence pack", "↗", C.blue, "Open the evidence pack")}](${evidenceLink(repo, artifactId)})`);
    lines.push(`Screenshots, network and console for every step of all ${ran} test${ran === 1 ? "" : "s"} · kept 30 days${artifactName ? ` · artifact \`${artifactName}\`` : ""}`);
  }
  return lines.join("\n");
}

const RATE = /(^|\.)(pass_rate|[a-z_]*_rate|percentage)$/;
const UNIT = [
  [/(^|\.)totals\.(failed|broken|skipped|passed|tests)$|^failures\.count$/, (m) => ` ${m.match(/(failed|broken|skipped|passed|tests|count)$/)[1].replace("count", "failures")}`],
  [/without/, () => " without"],
];

/** A gate value in the metric's words: 0 → "0 failed", 1 → "100 %". */
export function gateValue(metric, v) {
  if (v === null || v === undefined) return "–";
  if (Array.isArray(v)) return v.map((x) => gateValue(metric, x)).join("–");
  if (typeof v === "number" && RATE.test(metric ?? "")) return `${Math.round(v * 1000) / 10} %`;
  const unit = UNIT.find(([re]) => re.test(metric ?? ""));
  return `${typeof v === "object" ? JSON.stringify(v) : v}${unit && typeof v === "number" ? unit[1](metric) : ""}`;
}

/** The Required cell from the gate's operator. */
export function required(g) {
  const v = gateValue(g.metric, g.expected);
  // a bound that can't be passed any other way reads as the value itself (≥ 100 % is 100 %, ≤ 0 is 0)
  if (g.op === "min") return RATE.test(g.metric ?? "") && g.expected === 1 ? v : `≥ ${v}`;
  if (g.op === "max") return g.expected === 0 ? v : `≤ ${v}`;
  if (g.op === "in") return `one of ${v}`;
  return v;
}

const GATE_ICON = { pass: "✅", fail: "❌", warn: "⚠️", errored: "⚠️" };

/**
 * The Policy section; null when no policy is configured. `doc`: {id, path, yaml, gates[] from
 * the verdict file} gathered in the run step.
 */
export function policySection({ policy, verdict, doc, repo, defaultBranch = "main" }) {
  if (!hasVerdict(policy, verdict, doc)) return null;
  const v = verdict.policies[0];
  const id = v.id ?? doc.id ?? policy.path;
  const result = v.result === "pass" ? "✅ passed" : v.result === "fail" ? "❌ failed" : "⚠️ errored";
  const lines = [`### 🛡️ Policy · \`${id}\` — ${result}`];
  const gates = doc?.gates ?? [];
  const blocking = gates.filter((g) => g.severity !== "warning");
  const failedBlocking = gates.length ? blocking.filter((g) => g.status === "fail" || g.status === "errored").length : (v.failed_gate_ids ?? []).length;
  if (failedBlocking > 0) lines.push(`**${failedBlocking} of ${gates.length ? blocking.length : v.counts?.total ?? failedBlocking} blocking gates failed** → merge is blocked by the \`kane-cli / policy\` check`);
  else lines.push("**All blocking gates passed**");
  if (gates.length) {
    lines.push("", "| | Gate | Required | This run |", "|:---:|---|:---:|:---:|");
    for (const g of gates) {
      const name = `${cell(g.message || g.id)}${g.severity === "warning" ? " *(warning)*" : ""}`;
      lines.push(`| ${GATE_ICON[g.status] ?? "❔"} | ${name} | ${cell(required(g))} | ${cell(gateValue(g.metric, g.actual))} |`);
    }
  } else if ((v.failed_gate_ids ?? []).length) {
    lines.push("", `Failed gates: ${v.failed_gate_ids.map((g) => `\`${g}\``).join(", ")}`);
  }
  if (doc?.yaml) {
    const url = `https://github.com/${repo}/blob/${defaultBranch}/${policy.path}`;
    lines.push("", `<details>`, `<summary>📜 <b>View the policy</b> — <code>${policy.path}</code> on <code>${defaultBranch}</code></summary>`, `<br>`, ``, "```yaml", doc.yaml.replace(/```/g, "ˋˋˋ").trimEnd(), "```", ``, `[Open the file](${url})`, `</details>`);
  }
  return lines.join("\n");
}

/** "why did “Apply SPRING2026 without changing…” fail?" */
const shortTitle = (s, max = 40) => {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
};

export function footer({ sha, durationS, runUrl, runId, rows, results, mention = "@kane-cli" }) {
  const t = tally(rows, results);
  const parts = [`kane-cli · ran on \`${String(sha ?? "").slice(0, 7)}\`${duration(durationS) ? ` in ${duration(durationS)}` : ""}`];
  // the workflow run's id: `gh run download <id> -n <evidence artifact>` fetches the pack
  if (runId) parts.push(`run ${runId}`);
  if (runUrl) parts.push(`[run log](${runUrl})`);
  const firstFailed = rows.find((r) => FAILING.has(t.byTest.get(r.test)?.verdict));
  if (firstFailed) parts.push(`next: \`${mention} rerun the failed ones\` or \`${mention} why did “${shortTitle(nameOf(firstFailed))}” fail?\``);
  return `<sub>${parts.join(" · ")}</sub>`;
}

/**
 * The whole run report under kane's answer. `ran` false: an impact-only answer (badges, Why
 * and the `run them` hint). data: {rows, results, ran, files, policy, verdict, policyDoc,
 * evidence: {path, repo, artifactId}, runError, sha, durationS, runUrl, repo, defaultBranch, mention}.
 */
export function renderRunReport(d) {
  const mention = d.mention ?? "@kane-cli";
  const rows = d.rows ?? [];
  const parts = [badges(d)];
  if (d.runError) parts.push(`⚠️ kane-cli: ${cell(d.runError)}`);
  if (d.ran) parts.push(testsSection(rows, d.results));
  // a rerun of named or failed tests carries no requirements: no Why section saying "0 requirements"
  const hasRequirements = rows.some((r) => (r.use_cases ?? []).length);
  if (hasRequirements) parts.push(whySection(d));
  else if (!rows.length) parts.push([d.empty ?? "The engine named no tests for this change.", filelessNote(d.fileless)].filter(Boolean).join("\n\n"));
  if (!d.ran) {
    if (rows.some((r) => r.path)) parts.push(`Reply \`${mention} run them\` to run them.`);
    return parts.join("\n\n");
  }
  parts.push(evidenceSection({ ...(d.evidence ?? {}), ran: tally(rows, d.results).ran }));
  const pol = policySection({ policy: d.policy, verdict: d.verdict, doc: d.policyDoc, repo: d.repo, defaultBranch: d.defaultBranch });
  if (pol) parts.push(pol);
  parts.push(footer({ sha: d.sha, durationS: d.durationS, runUrl: d.runUrl, runId: d.runId, rows, results: d.results, mention }));
  return parts.join("\n\n");
}
