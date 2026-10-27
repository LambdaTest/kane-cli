// The request body for POST /v1/integration/github/converse, with every cap applied.
import { MAX_SAID, MAX_TURNS, emptyState } from "./state.mjs";

export const MAX_BODY = 8_000;
export const MAX_DIFF = 20_000;
const BODY_CUT = "\n\n[description truncated]";
const DIFF_CUT = "\n[diff truncated]";

/** Diff files that say nothing about behaviour (ported from kane-cli/src/github/pr-source.ts). */
const NOISE = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/,
  /\.(min\.js|min\.css|map|snap|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/,
  /(^|\/)(dist|build|vendor|node_modules|coverage|\.context|\.kane-github)\//,
];

/** Splits a unified diff into per-file sections keyed by their b/ path. */
function sections(diff) {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((p) => p.trim() !== "")
    .map((text) => ({ path: /^diff --git a\/(.+?) b\/(.+)$/m.exec(text)?.[2] ?? "", text }));
}

/**
 * Drops noise and binary files first, then keeps whole files while they fit in `max`
 * (the first file is cut when nothing else fits). `truncated` says the cap left something out.
 */
export function trimDiff(diff, max = MAX_DIFF) {
  const omitted = [];
  const kept = [];
  for (const s of sections(String(diff ?? ""))) {
    if (NOISE.some((re) => re.test(s.path)) || /^Binary files /m.test(s.text)) omitted.push(s.path);
    else kept.push(s);
  }
  const all = kept.map((s) => s.text).join("");
  if (all.length <= max) return { diff: all, omitted, truncated: false };

  const room = max - DIFF_CUT.length;
  let out = "";
  for (const s of kept) {
    if (out.length + s.text.length <= room) out += s.text;
    else omitted.push(s.path);
  }
  if (out === "") out = kept[0].text.slice(0, room);
  return { diff: out.replace(/\n?$/, "") + DIFF_CUT, omitted, truncated: true };
}

function capBody(body) {
  const b = String(body ?? "");
  return b.length > MAX_BODY ? b.slice(0, MAX_BODY) + BODY_CUT : b;
}

/** What the endpoint reads of kane's last impact: [{test, why}]. */
const impactedOut = (list) => (list ?? []).map((t) => ({ test: t.test, why: String(t.why ?? "") }));
/** And of its last results: [{test, verdict, note}] (verdict: passed | failed | broken | interrupted | not_run). */
const resultsOut = (list) => (Array.isArray(list) ? list.map((r) => ({ test: r.test, verdict: r.verdict ?? null, note: r.note ?? null })) : null);

/** `dryRun` false once impact and test runs are connected (phase 2+). */
export function buildRequest({ event, words, author, may, pr, diff, line, state, config, dryRun = true }) {
  const s = state ?? emptyState(pr.head_sha ?? null);
  return {
    version: 1,
    event,
    text: words,
    author: { login: author.login, association: author.association, may: [...may] },
    pr: {
      number: pr.number,
      title: pr.title,
      body: capBody(pr.body),
      draft: Boolean(pr.draft),
      changed_files: (pr.changed_files ?? []).map((f) => (typeof f === "string" ? f : f.filename)),
      diff: trimDiff(diff).diff,
    },
    line: line ? { path: line.path, line: line.line } : null,
    conversation: (s.turns ?? []).slice(-MAX_TURNS).map((t) => ({ who: t.who, said: String(t.said ?? "").slice(0, MAX_SAID) })),
    state: {
      head_sha_matches: state == null || state.head_sha === pr.head_sha,
      last_action: s.last_action ?? null,
      impacted: impactedOut(s.impacted),
      results: resultsOut(s.results),
      pending_question: s.pending_question ?? null,
    },
    config: { policies: [...config.policies], auto_continue: config.autoContinue, dry_run: Boolean(dryRun) },
  };
}
