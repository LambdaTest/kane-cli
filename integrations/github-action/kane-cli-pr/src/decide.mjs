// Re-checks the endpoint's answer against what this person may do and what really exists.
import { DEFAULT_ACCESS } from "./config.mjs";
import { COULDNT_READ } from "./fallback.mjs";

export const ACTIONS = ["impact", "run", "impact_then_run", "answer", "clarify", "help", "none"];
export const MAX_REPLY = 600;

const NONE = { tests: null, policy: null };

function validTests(t) {
  return t === null || t === "impacted" || t === "failed" || (Array.isArray(t) && t.every((n) => typeof n === "string"));
}

function refuse(action, reply) {
  return { action, args: { ...NONE }, reply, refused: reply };
}

/**
 * What kane will do with `answer` ({understood, reply, action, args:{tests, policy}}).
 * `runAccess` (optional) is the config's access.run list, named in the refusal.
 * `known` adds names a run may use beyond the state's (the PR checkout's test ids and stems).
 */
export function decide(answer, { may = [], policies = [], state = null, dryRun = true, runAccess = DEFAULT_ACCESS, known: extra = [] } = {}) {
  void dryRun;
  const args = answer?.args ?? NONE;
  const policy = args.policy ?? null;
  const tests = args.tests ?? null;
  if (!answer || !ACTIONS.includes(answer.action) || typeof (answer.reply ?? "") !== "string" || !validTests(tests) || (policy !== null && typeof policy !== "string")) {
    return refuse("answer", COULDNT_READ);
  }
  const { action } = answer;

  if ((action === "run" || action === "impact_then_run") && !may.includes("run")) {
    return refuse("answer", `Only ${runAccess.join(", ")} can run tests here.`);
  }
  if (policy !== null && !policies.includes(policy)) {
    return refuse("clarify", `There's no ${policy} policy here. Available: ${policies.length ? policies.join(", ") : "none"}.`);
  }
  if (Array.isArray(tests)) {
    const known = new Set([...(state?.impacted ?? []), ...(state?.results ?? [])].map((t) => t.test).concat(extra).map((n) => String(n).toLowerCase()));
    const unknown = tests.find((t) => !known.has(String(t).toLowerCase()));
    // a run that names a test kane hasn't seen yet (a new test before the first impact check) runs the impacted set,
    // which takes in every test new in this PR; any other action that names one is refused
    if (unknown !== undefined && (action === "run" || action === "impact_then_run")) {
      return { action: "impact_then_run", args: { tests: "impacted", policy }, reply: `kane doesn't know ${unknown} on this PR yet, so it checks which tests this PR affects and runs them, new tests included.` };
    }
    if (unknown !== undefined) return refuse("answer", `kane doesn't know a test named ${unknown} on this PR yet.`);
  }
  // Cut by code points, so an emoji or other astral character is never split in half.
  return { action, args: { tests, policy }, reply: Array.from(answer.reply ?? "").slice(0, MAX_REPLY).join("") };
}
