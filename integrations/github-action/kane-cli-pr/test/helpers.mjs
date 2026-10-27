// Shared setup for the pipeline tests: a temp PR checkout (a real git repo with a base and a
// head commit) and a fake kane-cli scenario directory.
import { execFileSync } from "node:child_process";
import { copyFileSync, realpathSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, "fixtures");
export const FAKE_KANE = join(here, "fake-kane.mjs");
/** The kane-cli input a workflow would pass: a command prefix with a quoted path. */
export const KANE_CMD = `${JSON.stringify(process.execPath)} ${JSON.stringify(FAKE_KANE)}`;

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();

const TEST = (id, title) => `---\nassurance:\n  id: ${id}\n  base: sha256:00\n---\n# ${title}\n\n## Step 1\n\nOpen the page.\n`;

/** A PR checkout: the base commit has open-cart (t-4), the head adds apply-gift-wrap (t-19). */
export function prCheckout() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kane-pr-")));
  git(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, ".testmuai", "tests"), { recursive: true });
  writeFileSync(join(dir, ".testmuai", "assurance.json"), "{}\n");
  writeFileSync(join(dir, ".testmuai", "tests", "open-cart-from-home-banner_test.md"), TEST("t-4", "Open cart from home banner"));
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "base");
  const baseSha = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, ".testmuai", "tests", "apply-gift-wrap_test.md"), TEST("t-19", "Apply gift wrap at checkout"));
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "head");
  const headSha = git(dir, "rev-parse", "HEAD");
  return { dir, baseSha, headSha };
}

/** A fake kane-cli scenario: impact + testrun fixtures, and the help text with or without --policy. */
export function kaneScenario({ policy = true, testrun = "testrun.ndjson", impact = "impact.ndjson", extra = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kane-fake-"));
  if (impact) copyFileSync(join(FIXTURES, impact), join(dir, "impact.ndjson"));
  if (testrun) copyFileSync(join(FIXTURES, testrun), join(dir, "testrun.ndjson"));
  copyFileSync(join(FIXTURES, policy ? "help-policy.txt" : "help-nopolicy.txt"), join(dir, "help.txt"));
  copyFileSync(join(FIXTURES, "verdict-fail.json"), join(dir, "verdict.json"));
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text);
  return dir;
}

/** Every kane-cli call the fake saw: [{argv, cwd}]. */
export function kaneCalls(dir) {
  const f = join(dir, "calls.ndjson");
  return existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}
