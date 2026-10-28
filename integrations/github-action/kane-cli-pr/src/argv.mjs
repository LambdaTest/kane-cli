// Splits the `kane-cli` input (a command prefix) into argv, shell-style but without a shell:
// whitespace separates, '…' and "…" group, a backslash escapes. Nothing is expanded or run.

export function splitCommand(text) {
  const out = [];
  let cur = "";
  let has = false;
  let quote = null;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else cur += c;
    } else if (c === "\\" && i + 1 < s.length && (quote === null || /["\\$`]/.test(s[i + 1]))) {
      cur += s[++i];
      has = true;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (/\s/.test(c)) {
      if (has) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (quote) throw new Error("the kane-cli input has an unclosed quote");
  if (has) out.push(cur);
  if (out.length === 0) throw new Error("the kane-cli input is empty; set it to the kane-cli command, e.g. kane-cli");
  return out;
}
