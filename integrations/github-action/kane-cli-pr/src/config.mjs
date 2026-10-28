// Reads `.github/kane-cli.yml`: who may ask and run, the named policies, auto-continue, and how
// tests run (policy, heal, impact.judge, app).
import { parse } from "yaml";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/** GitHub's author_association values. */
export const ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", "NONE"];
export const DEFAULT_ACCESS = ["OWNER", "MEMBER", "COLLABORATOR"];

const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function accessList(access, key) {
  const list = access[key];
  if (list === undefined || list === null) return [...DEFAULT_ACCESS];
  if (!Array.isArray(list)) throw new ConfigError(`access.${key} must be a list of associations, like [OWNER, MEMBER].`);
  for (const a of list) {
    if (typeof a !== "string" || !ASSOCIATIONS.includes(a)) {
      throw new ConfigError(`access.${key} has an unknown association ${JSON.stringify(a)}. Use any of: ${ASSOCIATIONS.join(", ")}.`);
    }
  }
  return [...list];
}

/** Parses the config text; null or empty gives the defaults. Throws ConfigError on bad input. */
export function parseConfig(yamlText) {
  let doc = null;
  if (yamlText != null && yamlText.trim() !== "") {
    try {
      doc = parse(yamlText);
    } catch (e) {
      throw new ConfigError(`.github/kane-cli.yml is not valid YAML: ${e.message.split("\n")[0]}`);
    }
  }
  doc ??= {};
  if (!isMap(doc)) throw new ConfigError(".github/kane-cli.yml must be a map of keys.");
  if (doc.version !== undefined && doc.version !== 1) throw new ConfigError(`version ${JSON.stringify(doc.version)} is not supported; use version: 1.`);

  const access = doc.access ?? {};
  if (!isMap(access)) throw new ConfigError("access must be a map with ask and run lists.");

  const policyMap = doc.policies ?? {};
  if (!isMap(policyMap)) throw new ConfigError("policies must be a map of name: path.");
  const policyPaths = {};
  for (const [name, path] of Object.entries(policyMap)) {
    if (typeof path !== "string" || path.trim() === "") throw new ConfigError(`policies.${name} must be a file path.`);
    policyPaths[name] = path;
  }

  // default true: a check runs the impacted tests straight after impact
  const autoContinue = doc.auto_continue ?? true;
  if (typeof autoContinue !== "boolean") throw new ConfigError("auto_continue must be true or false.");

  const policy = doc.policy ?? null;
  if (policy !== null && (typeof policy !== "string" || policy.trim() === "")) throw new ConfigError("policy must be a file path in this repo.");

  const parallel = doc.parallel ?? 1;
  if (!Number.isInteger(parallel) || parallel < 1 || parallel > 8) throw new ConfigError("parallel must be a whole number from 1 to 8.");
  const heal = doc.heal ?? true;
  if (typeof heal !== "boolean") throw new ConfigError("heal must be true or false.");

  const impact = doc.impact ?? {};
  if (!isMap(impact)) throw new ConfigError("impact must be a map, like impact: { judge: false }.");
  const judge = impact.judge ?? true;
  if (typeof judge !== "boolean") throw new ConfigError("impact.judge must be true or false.");

  return {
    access: { ask: accessList(access, "ask"), run: accessList(access, "run") },
    policies: Object.keys(policyPaths),
    policyPaths,
    autoContinue,
    policy,
    heal,
    parallel,
    impact: { judge },
    app: appOf(doc.app),
  };
}

export const DEFAULT_APP_URL = "http://127.0.0.1:3000";
export const DEFAULT_APP_TIMEOUT_SECONDS = 60;

/** `app: {start, url, ready_path, timeout_seconds}`: the PR build the tests run against; null when absent.
 * timeout_seconds (default 60, at most 900) is how long kane waits for the app to answer: raise it when
 * app.start builds first (a Next.js `npm run build` takes longer than a minute). */
function appOf(app) {
  if (app === undefined || app === null) return null;
  if (!isMap(app)) throw new ConfigError("app must be a map with start, url and ready_path.");
  if (typeof app.start !== "string" || app.start.trim() === "") throw new ConfigError("app.start must be the command that serves the PR's build, e.g. npm start.");
  const url = app.url ?? DEFAULT_APP_URL;
  if (typeof url !== "string" || !/^https?:\/\/[^\s]+$/.test(url)) throw new ConfigError("app.url must be an http(s) URL, e.g. http://127.0.0.1:3000.");
  const readyPath = app.ready_path ?? "/";
  if (typeof readyPath !== "string" || !readyPath.startsWith("/")) throw new ConfigError("app.ready_path must be a path starting with /.");
  const timeoutSeconds = app.timeout_seconds ?? DEFAULT_APP_TIMEOUT_SECONDS;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 900) throw new ConfigError("app.timeout_seconds must be a whole number of seconds from 1 to 900.");
  return { start: app.start, url, readyPath, timeoutMs: timeoutSeconds * 1000 };
}
