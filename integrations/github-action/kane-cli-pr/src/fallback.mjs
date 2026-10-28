// Word rules for when the converse endpoint can't be reached.

export const USAGE = [
  "Here's what kane understands, after `@kane-cli` at the start of a line:",
  "",
  "- **check impact** – which tests this PR's changes affect (`@kane-cli check impact`)",
  "- **go ahead** / **rerun** – run the impacted tests, or rerun the failed ones (`@kane-cli rerun the failed tests`)",
  "- **ask a question** – about this PR and kane's results (`@kane-cli why would this break checkout?`)",
  "- **help** – this list",
].join("\n");

export const COULDNT_READ = "kane couldn't read that right now. Try `@kane-cli go ahead` or `@kane-cli help`.";

const NONE = { tests: null, policy: null };

/** An endpoint-shaped answer from plain word rules. */
export function fallbackAnswer(words) {
  const w = String(words ?? "").trim().toLowerCase();
  if (w === "" || /^help[\s.!?]*$/.test(w)) {
    return { understood: "show what kane can do", reply: USAGE, action: "help", args: { ...NONE } };
  }
  if (/\b(go ahead|re-?run|run)\b/.test(w)) {
    const tests = /fail/.test(w) ? "failed" : "impacted";
    return { understood: `run the ${tests} tests`, reply: `I would run the ${tests} tests on this PR.`, action: "run", args: { tests, policy: null } };
  }
  if (/\b(check|impact|break|affect)/.test(w)) {
    return { understood: "check which tests this PR affects", reply: "I would check which tests this PR's changes affect.", action: "impact", args: { ...NONE } };
  }
  if (/\b(thanks|thank you|ty)\b/.test(w)) {
    return { understood: "thanks", reply: "", action: "none", args: { ...NONE } };
  }
  return { understood: w.slice(0, 120), reply: COULDNT_READ, action: "answer", args: { ...NONE } };
}
