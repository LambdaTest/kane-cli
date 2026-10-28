// Per-test results and the policy line, shared by the pipeline, the checks and the final comment
// (final.mjs renders the comment itself).
import { failureText, policyNote } from "./testrun.mjs";

/** A selected row's result from its member end (or not_run when no end came). */
export function resultOf(row, member) {
  if (!member) return { test: row.test, verdict: "not_run", note: "no result came back", path: row.path, duration_s: null };
  const dur = member.duration_s != null ? `${Math.round(member.duration_s)} s` : null;
  return { test: row.test, verdict: member.status, note: failureText(member) ?? dur ?? member.status, path: row.path, duration_s: member.duration_s, healed: member.healed === true };
}

/** The policy line: missing file, not available yet, the verdict, or null when none is configured. */
export function policyLine(policy, verdict) {
  if (!policy?.configured) return null;
  if (policy.missing) return `policy: ${policy.path} isn't a file on the default branch, so no policy was applied`;
  return policyNote({ configured: true, supported: policy.supported, verdict });
}
