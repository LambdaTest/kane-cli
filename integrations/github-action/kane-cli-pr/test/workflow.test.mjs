// The shipped examples: the workflow people copy, and the config it reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { parseConfig } from "../src/config.mjs";

const dir = join(import.meta.dirname, "..");
const wf = parse(readFileSync(join(dir, "examples/kane.yml"), "utf8"));
const action = parse(readFileSync(join(dir, "action.yml"), "utf8"));
const checkouts = () => wf.jobs.kane.steps.filter((s) => String(s.uses ?? "").startsWith("actions/checkout"));

test("the first checkout is the default branch, even on pull_request_review_comment (whose default ref is the PR's merge ref)", () => {
  const [first, pr] = checkouts();
  assert.equal(first.with.ref, "${{ github.event.repository.default_branch }}");
  assert.equal(first.with.path, undefined, "the policy files come from the workspace root");
  assert.equal(pr.with.path, "pr");
  assert.equal(pr.with["fetch-depth"], 0, "the base commit splits tests into impacted and new");
  for (const c of checkouts()) assert.equal(c.with["persist-credentials"], false);
});

test("the workflow answers comments only, skips bots and comments without the mention, and runs one job per PR", () => {
  assert.deepEqual(Object.keys(wf.on).sort(), ["issue_comment", "pull_request_review_comment"]);
  const job = wf.jobs.kane;
  assert.match(job.if, /github\.event\.comment\.user\.type != 'Bot'/);
  assert.match(job.if, /contains\(github\.event\.comment\.body, '@kane-cli'\)/);
  assert.equal(job.concurrency["cancel-in-progress"], false);
  assert.match(job.concurrency.group, /github\.event\.issue\.number \|\| github\.event\.pull_request\.number/);
  assert.equal(job["runs-on"], "ubuntu-latest");
  assert.deepEqual(wf.permissions, { contents: "read", issues: "write", "pull-requests": "write", checks: "write" });
});

test("the workflow uses the published action for both phases, uploading the pack between them", () => {
  const steps = wf.jobs.kane.steps;
  const uses = steps.filter((s) => String(s.uses ?? "").includes("kane-cli-pr"));
  assert.deepEqual(uses.map((s) => s.uses), Array(2).fill("LambdaTest/kane-cli/integrations/github-action/kane-cli-pr@main"));
  assert.deepEqual(uses.map((s) => s.with.phase), ["run", "report"]);
  const run = steps.indexOf(uses[0]);
  const upload = steps.findIndex((s) => s.id === "evidence");
  assert.ok(run < upload && upload < steps.indexOf(uses[1]));
  assert.equal(uses[1].with["artifact-id"], "${{ steps.evidence.outputs.artifact-id }}");
});

test("the example config parses, and its policy path is one of the named policies", () => {
  const config = parseConfig(readFileSync(join(dir, "examples/kane-cli.yml"), "utf8"));
  assert.equal(config.policy, config.policyPaths.checkout);
  assert.equal(config.app.url, "http://127.0.0.1:3000");
  assert.equal(config.heal, true);
});

test("an empty converse-url defaults to the kane controller for kane-env", () => {
  const step = action.runs.steps.find((s) => s.id === "kane");
  const expr = step.env.KANE_CONVERSE_URL;
  assert.ok(expr.includes("inputs.converse-url != '' && inputs.converse-url"));
  assert.ok(expr.includes("'https://kaneai-api.lambdatest.com/v16-controller/v1/integration/github/converse'"));
  assert.ok(expr.includes("inputs.kane-env == 'stage' && 'https://auteur-stage-automind.lambdatestinternal.com/v16-controller/v1/integration/github/converse'"));
  assert.equal(action.inputs["converse-url"].default, "");
});

test("kane-cli is installed from npm unless the kane-cli input names a command", () => {
  const install = action.runs.steps.find((s) => s.name === "Install Kane CLI");
  assert.match(install.if, /inputs\.kane-cli == ''/);
  assert.match(install.run, /npm install -g "@testmuai\/kane-cli@\$\{KANE_VERSION\}"/);
  assert.equal(action.inputs["kane-cli-version"].default, "latest");
  const step = action.runs.steps.find((s) => s.id === "kane");
  assert.equal(step.env.KANE_CLI_CMD, "${{ inputs.kane-cli != '' && inputs.kane-cli || 'kane-cli' }}");
});

test("the comment header's mascot is the image shipped in this directory", async () => {
  const { MASCOT_URL } = await import("../src/final.mjs");
  const prefix = "https://raw.githubusercontent.com/LambdaTest/kane-cli/main/integrations/github-action/kane-cli-pr/";
  assert.ok(MASCOT_URL.startsWith(prefix), MASCOT_URL);
  assert.ok(readFileSync(join(dir, MASCOT_URL.slice(prefix.length))).length > 0);
});
