// kane's comments on the PR, one per request: the working comment while it runs, then the
// result (latest answer, current picture, hidden state). The PR thread is the history.
import { MARKER, writeState } from "./state.mjs";
import { HEADER } from "./final.mjs";

export { HEADER };

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Breaks every @-mention with a zero-width space so model or PR text notifies nobody.
 * The one exception is the `mention` token itself (case-insensitive, as a whole token):
 * it isn't a GitHub account, so it pings nobody, and kane's `@kane-cli …` hints stay copyable.
 */
export function defang(text, mention = "@kane-cli") {
  const name = escapeRegExp(mention.replace(/^@/, ""));
  return String(text ?? "").replace(new RegExp(`@(?!${name}(?![A-Za-z0-9_-]))(?=[A-Za-z0-9_-])`, "gi"), "@\u200B");
}

/** Defanged, and unable to open an HTML comment (so never a fake state block). */
function safe(text, mention) {
  return defang(text, mention).replace(/<!--/g, "&lt;!--");
}

/** One line of defanged text, at most `max` chars (ends in … when cut). */
export const oneLine = (text, max, mention) => {
  const s = safe(text, mention).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

const quote = (text, mention) => safe(text, mention).trim().split(/\r?\n/).map((l) => `> ${l}`).join("\n");

/** Said under the reply when the converse endpoint gave nothing and the word rules answered. */
export const FALLBACK_NOTE = "<sub>kane's reader was unavailable; matched by keywords.</sub>";

/** How much of the ask a progress line may quote. */
export const MAX_WORKING = 120;

/**
 * A request's working comment: the header, the quoted ask, "Working on it" and the progress
 * list (one line per test while tests run), then the hidden state (copied forward). It mentions
 * nobody: the result is what notifies.
 */
export function renderWorking({ asked, progress = [], state, mention = "@kane-cli" }) {
  const parts = [HEADER, "", "**You asked**", quote(asked, mention), "", "**Working on it…**"];
  for (const l of progress) if (String(l ?? "").trim()) parts.push(`- ${oneLine(l, 300, mention)}`);
  parts.push("", MARKER, writeState(state));
  return parts.join("\n");
}

/**
 * A request's result: the header, the quoted ask, then kane's answer opening with a live
 * @asker (the one notification; null mentions nobody). `mention` is the configured mention
 * word; it alone is left live in the text. `fallback` adds FALLBACK_NOTE under the answer.
 * `report` (a run's badges and sections, final.mjs) replaces the picture and the reply hint.
 */
export function renderComment({ asker, latest, picture, state, mention = "@kane-cli", fallback = false, report = null }) {
  const who = asker == null ? "" : `${/^[A-Za-z0-9-]+$/.test(asker) ? `@${asker}` : safe(asker, mention)} `;
  const parts = [HEADER, "", "**You asked**", quote(latest.asked, mention), "", `${who}${safe(latest.reply, mention).trim()}`];
  if (fallback) parts.push(FALLBACK_NOTE);
  if (report) parts.push("", safe(report, mention).trim());
  else {
    if (picture) parts.push("", `**Current picture** · ${safe(picture, mention).trim()}`);
    parts.push("", `<sub>Reply with \`${mention} …\`</sub>`);
  }
  parts.push("", MARKER, writeState(state));
  return parts.join("\n");
}
