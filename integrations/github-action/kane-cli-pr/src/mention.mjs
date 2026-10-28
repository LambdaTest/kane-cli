// Finds a `@kane-cli` request in a comment body (mirrors kane-github-app/src/mention.ts).

const FENCE = /^\s*(```|~~~)/;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The text after the first line-leading `mention`, or null when no line starts with it.
 * Fenced code and `>` quoted lines are skipped; the match is case-insensitive and must not
 * be followed by a letter, digit, `_` or `-`. A `:` or `,` right after it is dropped. The
 * result spans the rest of that line plus every following line, trimmed.
 */
export function extractMention(body, mention = "@kane-cli") {
  const lead = new RegExp(`^\\s*${escapeRegExp(mention)}(?![A-Za-z0-9_-])`, "i");
  const lines = String(body ?? "").split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^\s*>/.test(line)) continue;
    const match = lead.exec(line);
    if (!match) continue;
    const rest = [line.slice(match[0].length), ...lines.slice(i + 1)].join("\n");
    return rest.trim().replace(/^[:,]\s*/, "");
  }
  return null;
}
