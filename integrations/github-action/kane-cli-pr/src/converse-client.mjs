// POST /v1/integration/github/converse: what the person means, or null when it can't say.
import { ACTIONS } from "./decide.mjs";

export function basicAuth(username, accessKey) {
  return `Basic ${Buffer.from(`${username}:${accessKey}`, "utf8").toString("base64")}`;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The endpoint's 200 body in the shape `decide` reads, or null when it isn't one. */
function validate(body) {
  if (!isObj(body)) return null;
  const { understood = null, reply, action, args = null } = body;
  if (understood !== null && typeof understood !== "string") return null;
  if (typeof reply !== "string" || !ACTIONS.includes(action)) return null;
  if (args !== null && !isObj(args)) return null;
  return { understood: understood ?? "", reply, action, args: { tests: args?.tests ?? null, policy: args?.policy ?? null } };
}

/** The workflow annotation for a fallback a repo admin has to fix (never carries the body or keys). */
export function fallbackWarning(reason) {
  if (reason === "401" || reason === "403") return `::warning::kane's converse endpoint refused the credentials (${reason}); check the username and access-key inputs. kane is matching by keywords.`;
  if (reason === "no-config") return "::warning::kane's converse endpoint is not configured (converse-url, username or access-key is empty); kane is matching by keywords.";
  return null;
}

/** Logs why kane fell back: one `converse: fallback (<reason>)` line, plus a warning when an admin must act. */
export function logFallback(log, reason) {
  log(`converse: fallback (${reason})`);
  const warning = fallbackWarning(reason);
  if (warning) log(warning);
}

/**
 * Asks the endpoint at `url` (the full URL, path included). `auth` is the Authorization
 * header value. Any error, timeout, non-200 or malformed body gives null and logs why
 * through `log` (the status, timeout, invalid or unreachable; never the body); the caller
 * then falls back to word rules. `decide` re-checks tests/policy, so they pass through here.
 */
export async function converse(url, auth, request, { timeoutMs = 25_000, log = () => {} } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    logFallback(log, e?.name === "TimeoutError" || e?.name === "AbortError" ? "timeout" : "unreachable");
    return null;
  }
  if (res.status !== 200) {
    await res.body?.cancel().catch(() => {});
    logFallback(log, String(res.status));
    return null;
  }
  let answer = null;
  try {
    answer = validate(JSON.parse(await res.text()));
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      logFallback(log, "timeout");
      return null;
    }
  }
  if (answer === null) logFallback(log, "invalid");
  return answer;
}
