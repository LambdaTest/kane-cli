import { test } from "node:test";
import assert from "node:assert/strict";
import { run, NOTIFY_ON_RESULT, FAILED } from "../src/main.mjs";
import { FakeGitHub, BOT } from "./fake-github.mjs";
import { readState, writeState, emptyState, MARKER } from "../src/state.mjs";
import { COULDNT_READ } from "../src/fallback.mjs";
import { FALLBACK_NOTE } from "../src/render.mjs";

const REPO = "octo-org/shop";
const SHA = "a1b2c3d4e5f6";
const ENV = {
  GITHUB_EVENT_NAME: "issue_comment",
  KANE_CONVERSE_URL: "https://converse.test/v1/integration/github/converse",
  LT_USERNAME: "lt-user",
  LT_ACCESS_KEY: "lt-key",
};
const DIFF = "diff --git a/src/cart/pricing.js b/src/cart/pricing.js\n--- a/src/cart/pricing.js\n+++ b/src/cart/pricing.js\n@@ -1 +1 @@\n+gift wrap\n";
const PULL = {
  number: 1,
  title: "Gift wrap",
  body: "Adds a gift-wrap fee.",
  draft: false,
  head: { sha: SHA, repo: { full_name: REPO } },
  base: { repo: { full_name: REPO } },
};
const CONFIG = "version: 1\naccess:\n  ask: [OWNER, MEMBER, COLLABORATOR]\n  run: [OWNER, MEMBER]\npolicies:\n  checkout: .github/kane/checkout-policy.yaml\n";

let nextId = 1;
function human(body, { login = "octocat", association = "OWNER", minute = 0, type = "User" } = {}) {
  return { id: nextId++, user: { login, type }, body, author_association: association, created_at: `2026-10-26T10:${String(minute).padStart(2, "0")}:00Z` };
}

function issueEvent(comment, { pr = true } = {}) {
  return {
    action: "created",
    comment,
    issue: { number: 1, ...(pr ? { pull_request: { url: "x" } } : {}) },
    sender: comment.user,
    repository: { full_name: REPO },
  };
}

const ANSWER = { understood: "explain how this PR affects checkout", reply: "The fee sits inside subtotal(); ask @bob.", action: "answer", args: { tests: null, policy: null } };

function setup({ comments = [], answer = ANSWER, pull = PULL, config = CONFIG, reviewComments = [], permissions = {}, bot } = {}) {
  const github = new FakeGitHub({ comments, pull, diff: DIFF, config, reviewComments, permissions, ...(bot ? { bot } : {}) });
  const requests = [];
  const logs = [];
  const converse = async (url, auth, request) => {
    requests.push({ url, auth, request });
    return typeof answer === "function" ? answer(request) : answer;
  };
  return { github, requests, logs, deps: { github, converse, now: () => 0, log: (l) => logs.push(l) } };
}

const kaneComments = (github) => github.comments.filter((c) => c.user.login === BOT.login && c.body.includes(MARKER));

test("bot sender is silent", async () => {
  const c = human("@kane-cli help", { login: "dependabot[bot]", type: "Bot" });
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.calls, []);
  assert.equal(requests.length, 0);
});

test("no mention is silent", async () => {
  const c = human("thanks @kane-cli, looks good");
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.writeCalls, []);
  assert.equal(requests.length, 0);
});

test("issue (not PR) gets the one-line reply", async () => {
  const c = human("@kane-cli check impact");
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c, { pr: false }), ENV, deps);
  assert.equal(requests.length, 0);
  const [kane] = kaneComments(github);
  assert.match(kane.body, /\n@octocat /);
  assert.match(kane.body, /\n@octocat kane works on pull requests\./);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
  assert.ok(!github.calls.some(([m]) => m === "getPull"));
});

test("fork PR refused", async () => {
  const c = human("@kane-cli go ahead");
  const { github, requests, deps } = setup({ comments: [c], pull: { ...PULL, head: { sha: SHA, repo: { full_name: "someone/fork" } } } });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 0);
  assert.match(kaneComments(github)[0].body, /kane doesn't answer on pull requests from forks/);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("CONTRIBUTOR refused, reaction confused", async () => {
  const c = human("@kane-cli go ahead", { login: "drive-by", association: "CONTRIBUTOR" });
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 0);
  const [kane] = kaneComments(github);
  assert.match(kane.body, /\n@drive-by /);
  assert.match(kane.body, /Only OWNER, MEMBER, COLLABORATOR can ask kane here\./);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("a bad kane-cli.yml is said in kane's comment, reaction confused", async () => {
  const c = human("@kane-cli help");
  const { github, requests, deps } = setup({ comments: [c], config: "version: 2\n" });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 0);
  assert.match(kaneComments(github)[0].body, /version 2 is not supported/);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("first ask creates kane's comment with @asker and rocket", async () => {
  const c = human("@kane-cli why would this break checkout?");
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c), ENV, deps);

  assert.equal(requests.length, 1);
  const { url, auth, request } = requests[0];
  assert.equal(url, ENV.KANE_CONVERSE_URL);
  assert.equal(auth, `Basic ${Buffer.from("lt-user:lt-key").toString("base64")}`);
  assert.equal(request.text, "why would this break checkout?");
  assert.equal(request.event, "comment");
  assert.deepEqual(request.author, { login: "octocat", association: "OWNER", may: ["ask", "run"] });
  assert.deepEqual(request.pr.changed_files, ["src/cart/pricing.js"]);
  assert.match(request.pr.diff, /gift wrap/);
  assert.equal(request.config.dry_run, true);
  assert.deepEqual(request.config.policies, ["checkout"]);
  assert.equal(request.state.head_sha_matches, true);

  const all = kaneComments(github);
  assert.equal(all.length, 1);
  const body = all[0].body;
  assert.match(body, /\n@octocat /);
  assert.match(body, /> why would this break checkout\?/);
  assert.match(body, /ask @​bob/);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);

  const { state } = readState(github.comments);
  assert.equal(state.head_sha, SHA);
  assert.equal(state.last_action, "answer");
  assert.deepEqual(state.turns, [
    { who: "OWNER", said: "why would this break checkout?" },
    { who: "kane", said: ANSWER.reply },
  ]);
});

test("NOTIFY_ON_RESULT is on: edits don't notify, so the result is a new comment", () => {
  assert.equal(NOTIFY_ON_RESULT, true);
});

test("second ask adds its own comment and leaves the first one alone", async () => {
  const old = { ...emptyState(SHA), last_action: "help", turns: [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }] };
  const prior = { id: 50, user: BOT, body: `@octocat here's what I found.\n\n${MARKER}\n${writeState(old)}`, created_at: "2026-10-26T09:00:00Z" };
  const c = human("@kane-cli what does this PR change?", { login: "maria", association: "MEMBER", minute: 5 });
  const { github, requests, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, deps);

  assert.deepEqual(requests[0].request.conversation, old.turns);
  assert.ok(!github.calls.some(([m, id]) => (m === "deleteComment" || m === "updateComment") && id === 50), "the earlier comment is never touched");
  const all = kaneComments(github);
  assert.equal(all.length, 2);
  assert.equal(all[0].body, prior.body);
  assert.equal(github.comments.at(-1).id, all[1].id, "this request's comment is the newest");
  assert.match(all[1].body, /\n@maria /);
  assert.doesNotMatch(all[1].body, /Earlier with kane/);
  assert.equal(readState(github.comments).state.turns.length, 4);
  assert.deepEqual(requests[0].request.author.may, ["ask", "run"]);
});

test("a MEMBER-only run list leaves a COLLABORATOR with ask only", async () => {
  const c = human("@kane-cli go ahead", { association: "COLLABORATOR" });
  const { github, requests, deps } = setup({ comments: [c], answer: { understood: "run", reply: "I would run them.", action: "run", args: { tests: "impacted", policy: null } } });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(requests[0].request.author.may, ["ask"]);
  assert.match(kaneComments(github)[0].body, /Only OWNER, MEMBER can run tests here\./);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("thanks → +1 only, no comment change", async () => {
  const prior = { id: 50, user: BOT, body: `@octocat here's what I found.\n\n${MARKER}\n${writeState(emptyState(SHA))}`, created_at: "2026-10-26T09:00:00Z" };
  const c = human("@kane-cli thanks", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c], answer: { understood: "thanks", reply: "", action: "none", args: { tests: null, policy: null } } });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.contents("issue", c.id), ["+1"]);
  assert.deepEqual(github.writes, []);
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
});

test("a none answer after the working comment was created deletes it; earlier comments stay", async () => {
  const prior = { id: 50, user: BOT, body: `@octocat here's what I found.\n\n${MARKER}\n${writeState(emptyState(SHA))}`, created_at: "2026-10-26T09:00:00Z" };
  const c = human("@kane-cli nice one", { minute: 5 });
  const none = { understood: "praise", reply: "", action: "none", args: { tests: null, policy: null } };
  const { github, deps } = setup({ comments: [prior, c], answer: none });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.contents("issue", c.id), ["+1"]);
  assert.deepEqual(github.writes.map((w) => w.op), ["create", "delete"]);
  assert.equal(github.writes[0].id, github.writes[1].id, "the working comment is the one deleted");
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
  assert.equal(kaneComments(github).length, 1);

  const fresh = setup({ comments: [c], answer: none });
  await run(issueEvent(c), ENV, fresh.deps);
  assert.equal(kaneComments(fresh.github).length, 0, "no comment remains for this request");
  assert.deepEqual(fresh.github.contents("issue", c.id), ["+1"]);
});

test("endpoint null → fallback reply used", async () => {
  const c = human("@kane-cli go ahead");
  const { github, requests, deps } = setup({ comments: [c], answer: null });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 1);
  const body = kaneComments(github)[0].body;
  assert.match(body, /I would run the impacted tests on this PR\./);
  assert.match(body, /Current picture/);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);

  const c2 = human("@kane-cli flibbertigibbet");
  const s2 = setup({ comments: [c2], answer: null });
  await run(issueEvent(c2), ENV, s2.deps);
  assert.ok(kaneComments(s2.github)[0].body.includes(COULDNT_READ));
  assert.deepEqual(s2.github.contents("issue", c2.id), ["confused"]);
});

test("no converse URL or keys → the fallback, without calling the endpoint", async () => {
  const c = human("@kane-cli help");
  const { github, requests, deps } = setup({ comments: [c] });
  await run(issueEvent(c), { GITHUB_EVENT_NAME: "issue_comment" }, deps);
  assert.equal(requests.length, 0);
  assert.match(kaneComments(github)[0].body, /Here's what kane understands/);
});

test("dry run: impact and run say what kane would do, and nothing else happens", async () => {
  const c = human("@kane-cli go ahead with the checkout policy");
  const answer = { understood: "run the impacted tests with the checkout policy ".repeat(5), reply: "I would run the impacted tests with checkout.", action: "impact_then_run", args: { tests: "impacted", policy: "checkout" } };
  const { github, deps } = setup({ comments: [c], answer });
  await run(issueEvent(c), ENV, deps);
  const body = kaneComments(github)[0].body;
  const picture = body.split("\n").find((l) => l.startsWith("**Current picture**"));
  assert.match(picture, /for a1b2c3d/);
  assert.match(picture, /I would check which tests the 1 changed file affects, then run the impacted tests with the checkout policy/);
  assert.match(picture, /dry run/);
  const understood = /Understood: “([^”]*)”/.exec(picture)[1];
  assert.ok(understood.length <= 120, String(understood.length));
  assert.equal(readState(github.comments).state.last_action, "impact_then_run");
});

test("progress edit shows \"Working on it…\" before the final body", async () => {
  const c = human("@kane-cli why would this break checkout?");
  let seenAtCall = null;
  const { github, deps } = setup({ comments: [c] });
  deps.converse = async () => {
    seenAtCall = kaneComments(github).map((k) => k.body);
    return ANSWER;
  };
  await run(issueEvent(c), ENV, deps);
  assert.equal(seenAtCall.length, 1);
  assert.match(seenAtCall[0], /^## <img [^\n]*kane-cli · gate-keeper\n\n\*\*You asked\*\*\n> why would this break checkout\?\n\n\*\*Working on it…\*\*/);
  assert.match(seenAtCall[0], /> why would this break checkout\?/, "the working comment quotes the ask");
  assert.doesNotMatch(seenAtCall[0], /@octocat/, "the working comment mentions nobody");
  assert.ok(seenAtCall[0].includes(MARKER), "the progress comment keeps the marker");
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);
  const firstWrite = github.writes[0];
  assert.match(firstWrite.body, /\*\*Working on it…\*\*/);
  assert.match(github.writes.filter((w) => w.body).at(-1).body, /\n@octocat /);
  assert.deepEqual(github.writes.map((w) => w.op), ["create", "create", "delete"], "progress, answer, then the progress comment goes");

  const order = github.calls.map(([m, ...a]) => (m === "addReaction" ? `react:${a[2]}` : m));
  assert.ok(order.indexOf("react:eyes") < order.indexOf("createComment"));
});

test("the working comment is a new comment, its quoted ask defanged, carrying the newest state", async () => {
  const prevState = { ...emptyState(SHA), turns: [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }] };
  const prior = { id: 50, user: BOT, body: `@octocat here's what I found.\n\nold answer\n\n${MARKER}\n${writeState(prevState)}`, created_at: "2026-10-26T09:00:00Z" };
  const words = "@bob " + "explain ".repeat(40);
  const c = human(`@kane-cli ${words}`, { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, deps);
  const working = github.writes[0];
  assert.equal(working.op, "create");
  assert.match(working.body, /\n> @​bob explain/);
  assert.equal(working.body.match(/@(?!\u200B)[A-Za-z0-9-]+/g), null, "no live mention");
  assert.deepEqual(readState([{ user: BOT, body: working.body }]).state, prevState, "state copied forward");
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
});

test("a comment already answered by kane is not answered again", async () => {
  const c = human("@kane-cli help");
  const { github, requests, deps } = setup({ comments: [c] });
  github.reactionsOn("issue", c.id).push({ id: 9, content: "rocket", user: BOT });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 0);
  assert.deepEqual(github.writeCalls, []);
});

test("sweep answers a newer unanswered comment", async () => {
  const c = human("@kane-cli help", { minute: 0 });
  const newer = human("@kane-cli what does this PR change?", { login: "maria", association: "MEMBER", minute: 1 });
  const answered = human("@kane-cli check impact", { minute: 2 });
  const chatter = human("lgtm", { minute: 3 });
  const bot = human("@kane-cli deploy", { login: "ci[bot]", type: "Bot", minute: 4 });
  const older = human("@kane-cli old one", { minute: 0 });
  older.created_at = "2026-10-26T09:59:00Z";
  const { github, requests, deps } = setup({ comments: [older, c, newer, answered, chatter, bot], answer: (r) => ({ ...ANSWER, reply: `re: ${r.text}` }) });
  github.reactionsOn("issue", answered.id).push({ id: 9, content: "rocket", user: BOT });
  await run(issueEvent(c), ENV, deps);

  assert.deepEqual(requests.map((r) => r.request.text), ["help", "what does this PR change?"]);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);
  assert.deepEqual(github.contents("issue", newer.id), ["rocket"]);
  assert.deepEqual(github.contents("issue", older.id), []);
  assert.deepEqual(github.contents("issue", bot.id), []);
  const all = kaneComments(github);
  assert.equal(all.length, 2, "one comment per request");
  assert.match(all[0].body, /\n@octocat /);
  assert.match(all[1].body, /\n@maria /);
  assert.equal(readState(github.comments).state.turns.length, 4);
});

test("sweep handles at most 5, oldest first", async () => {
  const c = human("@kane-cli help", { minute: 0 });
  const later = [7, 3, 5, 1, 6, 2, 4].map((m) => human(`@kane-cli q${m}`, { minute: m }));
  const { requests, deps } = setup({ comments: [c, ...later], answer: (r) => ({ ...ANSWER, reply: `re: ${r.text}` }) });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(requests.map((r) => r.request.text), ["help", "q1", "q2", "q3", "q4", "q5"]);
});

test("a run for a comment without a mention still sweeps", async () => {
  const c = human("lgtm", { minute: 0 });
  const newer = human("@kane-cli help", { minute: 1 });
  const { github, requests, deps } = setup({ comments: [c, newer] });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests.length, 1);
  assert.deepEqual(github.contents("issue", c.id), []);
  assert.deepEqual(github.contents("issue", newer.id), ["rocket"]);
});

test("a review-line comment reacts on the review comment, sends the line, replies in the conversation", async () => {
  const c = { ...human("@kane-cli why is this fee here?"), path: "src/cart/pricing.js", line: 12 };
  const { github, requests, deps } = setup({ comments: [] });
  const event = { action: "created", comment: c, pull_request: { ...PULL }, sender: c.user, repository: { full_name: REPO } };
  await run(event, { ...ENV, GITHUB_EVENT_NAME: "pull_request_review_comment" }, deps);
  assert.equal(requests[0].request.event, "review_comment");
  assert.deepEqual(requests[0].request.line, { path: "src/cart/pricing.js", line: 12 });
  assert.deepEqual(github.contents("review", c.id), ["rocket"]);
  assert.deepEqual(github.contents("issue", c.id), []);
  assert.ok(github.calls.some(([m, n]) => m === "createComment" && n === 1));
});

test("a bot-written state with junk fields doesn't break the turn", async () => {
  const junk = { v: 1, head_sha: SHA, turns: [null, { who: "OWNER", said: "hi" }], impacted: "lots", results: { a: 1 }, last_action: 5, pending_question: 7 };
  const prior = { id: 50, user: BOT, body: `x\n${MARKER}\n${writeState(junk)}`, created_at: "2026-10-26T09:00:00Z" };
  const c = human("@kane-cli run promo applies", { minute: 5 });
  const { github, requests, deps } = setup({ comments: [prior, c], answer: { understood: "run", reply: "I would run it.", action: "answer", args: { tests: ["promo applies"], policy: null } } });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(requests[0].request.state.impacted, []);
  assert.match(kaneComments(github).at(-1).body, /kane doesn't know a test named promo applies on this PR yet\./);
});

test("the request treats an older commit's state as stale", async () => {
  const prior = { id: 50, user: BOT, body: `x\n${MARKER}\n${writeState(emptyState("0ldsha"))}`, created_at: "2026-10-26T09:00:00Z" };
  const c = human("@kane-cli help", { minute: 5 });
  const { github, requests, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests[0].request.state.head_sha_matches, false);
  assert.equal(readState(github.comments).state.head_sha, SHA);
});

const priorKane = (state = { ...emptyState(SHA), turns: [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }] }) => ({
  id: 50,
  user: BOT,
  body: `@octocat here's what I found.\n\nold answer\n\n${MARKER}\n${writeState(state)}`,
  created_at: "2026-10-26T09:00:00Z",
});

test("an unexpected failure after 👀 is a final result: @asker error comment, working comment gone, confused, rethrown", async () => {
  const c = human("@kane-cli help");
  const { github, deps } = setup({ comments: [c] });
  deps.converse = async () => {
    throw new Error("boom");
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /boom/);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
  const all = kaneComments(github);
  assert.equal(all.length, 1, "no stuck Working on: comment");
  assert.match(all[0].body, /\n@octocat /);
  assert.ok(all[0].body.includes(FAILED));
  assert.doesNotMatch(all[0].body, /boom/, "the error text isn't posted");
});

test("a failed turn leaves earlier comments byte-identical", async () => {
  const prior = priorKane();
  const c = human("@kane-cli help", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  deps.converse = async () => {
    throw new Error("boom");
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /boom/);
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
  assert.equal(kaneComments(github).length, 2);
  assert.ok(kaneComments(github).at(-1).body.includes(FAILED));
});

test("a failed create of the final comment keeps the working comment and fails the turn with confused", async () => {
  const prior = priorKane();
  const c = human("@kane-cli what does this PR change?", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  const create = github.createComment.bind(github);
  let n = 0;
  github.createComment = async (...a) => {
    if (n++ >= 1) throw new Error("GitHub POST → 502");
    return create(...a);
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /502/);
  assert.ok(!github.calls.some(([m]) => m === "deleteComment"), "nothing deleted when the final create fails");
  const all = kaneComments(github);
  assert.equal(all.length, 2);
  assert.equal(all[0].body, prior.body);
  assert.match(all[1].body, /\*\*Working on it…\*\*/, "the working comment remains");
  assert.deepEqual(readState(github.comments).state.turns, [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }]);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("a failed delete after the create still posts the answer; the next turn reads the new state", async () => {
  const prior = priorKane();
  const c = human("@kane-cli what does this PR change?", { minute: 5 });
  const { github, requests, deps } = setup({ comments: [prior, c] });
  github.deleteComment = async () => {
    throw new Error("GitHub DELETE → 502");
  };
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);
  assert.equal(github.comments.at(-1).user.login, BOT.login);
  assert.match(github.comments.at(-1).body, /\n@octocat /);
  assert.equal(readState(github.comments).state.turns.length, 4);

  const c2 = human("@kane-cli help", { minute: 6 });
  github.comments.push(c2);
  await run(issueEvent(c2), ENV, deps);
  assert.equal(requests.at(-1).request.conversation.length, 4);
});

test("a gate refusal is one new @asker comment; nothing earlier is deleted or edited", async () => {
  const prior = priorKane();
  const c = human("@kane-cli go ahead", { login: "drive-by", association: "CONTRIBUTOR", minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.writes.map((w) => w.op), ["create"]);
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
  assert.match(kaneComments(github).at(-1).body, /\n@drive-by /);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("a failure before kane's state is read posts nothing, so the prior state stays newest", async () => {
  const prior = priorKane();
  const c = human("@kane-cli what does this PR change?", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  const list = github.listComments.bind(github);
  let n = 0;
  github.listComments = async (...a) => {
    if (n++ === 1) throw new Error("GitHub GET → 503");
    return list(...a);
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /503/);
  assert.deepEqual(github.writes, [], "no new marker comment");
  assert.equal(readState(github.comments).comment.id, 50);
  assert.deepEqual(readState(github.comments).state, readState([prior]).state);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

test("an error result doesn't add FAILED as a kane turn, but still moves answered_upto", async () => {
  const prior = priorKane();
  const c = human("@kane-cli help", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  deps.converse = async () => {
    throw new Error("boom");
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /boom/);
  const { state } = readState(github.comments);
  assert.ok(kaneComments(github).at(-1).body.includes(FAILED));
  assert.deepEqual(state.turns, [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }]);
  assert.ok(!state.turns.some((t) => t.said === FAILED));
  assert.equal(state.answered_upto, "2026-10-26T10:05:00.000Z");
});

test("an error on a word-rules thanks (no working comment) is confused only, no comment", async () => {
  const prior = priorKane();
  const c = human("@kane-cli thanks", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  deps.converse = async () => {
    throw new Error("boom");
  };
  await assert.rejects(run(issueEvent(c), ENV, deps), /boom/);
  assert.deepEqual(github.writes, []);
  assert.deepEqual(github.contents("issue", c.id), ["confused"]);
});

// --- one kane comment per request ----------------------------------------------------

test("two requests in a row leave two kane comments; the first is byte-identical after the second", async () => {
  const c1 = human("@kane-cli why would this break checkout?", { minute: 0 });
  const { github, requests, deps } = setup({ comments: [c1], answer: (r) => ({ ...ANSWER, reply: `re: ${r.text}` }) });
  await run(issueEvent(c1), ENV, deps);
  const [first] = kaneComments(github);
  const firstBody = first.body;

  const c2 = human("@kane-cli what does this PR change?", { login: "maria", association: "MEMBER", minute: 1 });
  github.comments.push(c2);
  await run(issueEvent(c2), ENV, deps);
  const all = kaneComments(github);
  assert.equal(all.length, 2);
  assert.equal(all[0].id, first.id);
  assert.equal(all[0].body, firstBody);
  assert.match(all[0].body, /\n@octocat /);
  assert.match(all[1].body, /\n@maria /);

  // state continuity: request 2's conversation carries request 1's turn
  assert.deepEqual(requests[1].request.conversation, [
    { who: "OWNER", said: "why would this break checkout?" },
    { who: "kane", said: "re: why would this break checkout?" },
  ]);
  assert.equal(readState(github.comments).comment.id, all[1].id, "the newest kane comment holds the state");
  assert.equal(readState(github.comments).state.turns.length, 4);
});

test("a request's edits and deletes touch only its own working comment", async () => {
  for (const notifyOnResult of [true, false]) {
    const prior = priorKane();
    const c = human("@kane-cli what does this PR change?", { minute: 5 });
    const { github, deps } = setup({ comments: [prior, c] });
    await run(issueEvent(c), ENV, { ...deps, notifyOnResult });
    const working = github.writes[0];
    assert.equal(working.op, "create", String(notifyOnResult));
    assert.match(working.body, /\*\*Working on it…\*\*/);
    const touched = github.calls.filter(([m]) => m === "updateComment" || m === "deleteComment").map(([, id]) => id);
    assert.ok(touched.length >= 1, String(notifyOnResult));
    assert.ok(touched.every((id) => id === working.id), `${notifyOnResult}: ${touched}`);
    assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
  }
});

test("the final result is a new comment opening with @asker; the working comment is deleted; earlier ones untouched", async () => {
  const prior = priorKane();
  const c = human("@kane-cli what does this PR change?", { login: "maria", association: "MEMBER", minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(github.writes.map((w) => w.op), ["create", "create", "delete"]);
  const [working, final, gone] = github.writes;
  assert.equal(gone.id, working.id);
  assert.match(final.body, /\n@maria /);
  assert.ok(!github.comments.some((x) => x.id === working.id));
  assert.equal(github.comments.find((x) => x.id === 50).body, prior.body);
  const ops = github.calls.map(([m]) => m).filter((m) => m === "createComment" || m === "deleteComment");
  assert.deepEqual(ops, ["createComment", "createComment", "deleteComment"], "create before delete");
});

test("notifyOnResult false: the result edits the working comment in place, with no mention", async () => {
  const prior = priorKane();
  const c = human("@kane-cli what does this PR change?", { minute: 5 });
  const { github, deps } = setup({ comments: [prior, c] });
  await run(issueEvent(c), ENV, { ...deps, notifyOnResult: false });
  assert.deepEqual(github.writes.map((w) => w.op), ["create", "update"]);
  const [working, final] = github.writes;
  assert.equal(final.id, working.id);
  assert.match(final.body, /^## <img /);
  assert.ok(final.body.includes("\n\n" + "The fee sits"), "kane's answer, with nobody mentioned before it");
  assert.doesNotMatch(final.body.replace(/`[^`]*`/g, ""), /@octocat/);
  assert.equal(kaneComments(github).length, 2);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);
});

test("a diff GitHub won't serve (406 too large) is sent as unavailable, and the turn still answers", async () => {
  const c = human("@kane-cli what does this PR change?");
  const { github, requests, deps } = setup({ comments: [c] });
  github.getDiff = async () => {
    throw Object.assign(new Error("GitHub GET /repos/o/r/pulls/1 → 406: diff too large"), { status: 406 });
  };
  await run(issueEvent(c), ENV, deps);
  assert.equal(requests[0].request.pr.diff, "[diff unavailable: 406]");
  assert.deepEqual(requests[0].request.pr.changed_files, []);
  assert.deepEqual(github.contents("issue", c.id), ["rocket"]);
  assert.doesNotMatch(kaneComments(github)[0].body, /Working on/);

  const c2 = human("@kane-cli help");
  const s2 = setup({ comments: [c2] });
  s2.github.getDiff = async () => {
    throw new Error("fetch failed");
  };
  await run(issueEvent(c2), ENV, s2.deps);
  assert.equal(s2.requests[0].request.pr.diff, "[diff unavailable: error]");
});

// --- fallback visibility -------------------------------------------------------------

test("a fallback answer carries the keyword note under the reply; an endpoint answer doesn't", async () => {
  const c = human("@kane-cli go ahead");
  const s1 = setup({ comments: [c], answer: null });
  await run(issueEvent(c), ENV, s1.deps);
  const lines = kaneComments(s1.github)[0].body.split("\n");
  assert.equal(lines[lines.findIndex((l) => l.startsWith("@octocat ")) + 1], FALLBACK_NOTE);

  const c2 = human("@kane-cli why would this break checkout?");
  const s2 = setup({ comments: [c2] });
  await run(issueEvent(c2), ENV, s2.deps);
  assert.ok(!kaneComments(s2.github)[0].body.includes(FALLBACK_NOTE));
});

test("no converse URL or keys logs the no-config fallback and one ::warning::", async () => {
  const c = human("@kane-cli help", { minute: 0 });
  const later = human("@kane-cli check impact", { minute: 1 });
  const { github, logs, deps } = setup({ comments: [c, later] });
  await run(issueEvent(c), { GITHUB_EVENT_NAME: "issue_comment", KANE_CONVERSE_URL: ENV.KANE_CONVERSE_URL }, deps);
  assert.equal(logs.filter((l) => l === "converse: fallback (no-config)").length, 2, "one line per turn");
  const warnings = logs.filter((l) => l.startsWith("::warning::"));
  assert.equal(warnings.length, 1, "the annotation is raised once per run");
  assert.match(warnings[0], /not configured/);
  assert.ok(kaneComments(github)[0].body.includes(FALLBACK_NOTE));
  assert.ok(!logs.join("\n").includes("lt-key"));
});

// --- the sweep's lower bound -------------------------------------------------------

test("kane stores answered_upto: the time of the newest comment it handled", async () => {
  const c = human("@kane-cli why would this break checkout?", { minute: 7 });
  const { github, deps } = setup({ comments: [c] });
  await run(issueEvent(c), ENV, deps);
  assert.equal(readState(github.comments).state.answered_upto, "2026-10-26T10:07:00.000Z");

  const r = human("@kane-cli go ahead", { login: "drive-by", association: "CONTRIBUTOR", minute: 9 });
  const s2 = setup({ comments: [r] });
  await run(issueEvent(r), ENV, s2.deps);
  assert.equal(readState(s2.github.comments).state.answered_upto, "2026-10-26T10:09:00.000Z", "a refusal is handled too");
});

test("the sweep starts at kane's answered_upto, so a mention older than the trigger isn't dropped", async () => {
  const state = { ...emptyState(SHA), answered_upto: "2026-10-26T10:00:00.000Z" };
  const prior = { id: 50, user: BOT, body: `x\n${MARKER}\n${writeState(state)}`, created_at: "2026-10-26T10:00:30Z" };
  const before = human("@kane-cli answered long ago", { minute: 0 });
  before.created_at = "2026-10-26T09:58:00Z";
  const missed = human("@kane-cli what does this PR change?", { login: "maria", association: "MEMBER", minute: 1 });
  const trigger = human("@kane-cli help", { minute: 2 });
  const { github, requests, deps } = setup({ comments: [before, prior, missed, trigger], answer: (r) => ({ ...ANSWER, reply: `re: ${r.text}` }) });
  await run(issueEvent(trigger), ENV, deps);
  assert.deepEqual(requests.map((r) => r.request.text), ["help", "what does this PR change?"]);
  assert.deepEqual(github.contents("issue", missed.id), ["rocket"]);
  assert.deepEqual(github.contents("issue", before.id), []);
  assert.equal(readState(github.comments).state.answered_upto, "2026-10-26T10:02:00.000Z", "never moves back");
});

test("the sweep also answers review-line mentions, on their own reactions, with their line", async () => {
  const c = human("@kane-cli help", { minute: 0 });
  const line = { ...human("@kane-cli why is this fee here?", { minute: 1 }), path: "src/cart/pricing.js", line: 12 };
  const answeredLine = { ...human("@kane-cli old", { minute: 2 }), path: "a.js", line: 1 };
  const { github, requests, deps } = setup({ comments: [c], reviewComments: [line, answeredLine] });
  github.reactionsOn("review", answeredLine.id).push({ id: 9, content: "rocket", user: BOT });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(requests.map((r) => r.request.text), ["help", "why is this fee here?"]);
  assert.equal(requests[1].request.event, "review_comment");
  assert.deepEqual(requests[1].request.line, { path: "src/cart/pricing.js", line: 12 });
  assert.deepEqual(github.contents("review", line.id), ["rocket"]);
  assert.deepEqual(github.contents("issue", line.id), []);
});

test("one sweep item failing is logged and the rest are still answered", async () => {
  const c = human("@kane-cli help", { minute: 0 });
  const bad = human("@kane-cli explode", { minute: 1 });
  const good = human("@kane-cli what does this PR change?", { minute: 2 });
  const { github, requests, logs, deps } = setup({
    comments: [c, bad, good],
    answer: (r) => {
      if (r.text === "explode") throw new Error("boom");
      return { ...ANSWER, reply: `re: ${r.text}` };
    },
  });
  await run(issueEvent(c), ENV, deps);
  assert.deepEqual(requests.map((r) => r.request.text), ["help", "explode", "what does this PR change?"]);
  assert.deepEqual(github.contents("issue", bad.id), ["confused"]);
  assert.deepEqual(github.contents("issue", good.id), ["rocket"]);
  assert.ok(logs.some((l) => l === `kane: #1 sweep of issue comment ${bad.id} failed: boom`), logs.join("\n"));
});

// --- bot identity --------------------------------------------------------------------

test("bot-login: state, the already-answered check and the sweep use KANE_BOT_LOGIN", async () => {
  const APP = { login: "kane-app[bot]", type: "Bot" };
  const env = { ...ENV, KANE_BOT_LOGIN: "kane-app[bot]" };
  const old = { ...emptyState(SHA), turns: [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage" }] };
  const mine = { id: 50, user: APP, body: `x\n${MARKER}\n${writeState(old)}`, created_at: "2026-10-26T09:00:00Z" };
  const actions = { id: 51, user: BOT, body: `x\n${MARKER}\n${writeState(emptyState(SHA))}`, created_at: "2026-10-26T09:01:00Z" };
  const c = human("@kane-cli help", { minute: 0 });
  const done = human("@kane-cli check impact", { minute: 1 });
  const other = human("@kane-cli what does this PR change?", { minute: 2 });
  const { github, requests, deps } = setup({ comments: [mine, actions, c, done, other], bot: APP });
  github.reactionsOn("issue", done.id).push({ id: 9, content: "rocket", user: APP });
  github.reactionsOn("issue", other.id).push({ id: 8, content: "rocket", user: BOT });
  await run(issueEvent(c), env, deps);
  assert.deepEqual(requests[0].request.conversation, old.turns, "state is read from the bot-login's comment");
  assert.deepEqual(requests.map((r) => r.request.text), ["help", "what does this PR change?"], "only the bot-login's reaction means answered");
  assert.equal(readState(github.comments, "kane-app[bot]").comment.user.login, "kane-app[bot]");
});

test("bot-login that is a user account (a PAT): its own comments start nothing and are never swept", async () => {
  const KANE = { login: "kane-user", type: "User" };
  const env = { ...ENV, KANE_BOT_LOGIN: "kane-user" };
  const own = { id: 70, user: KANE, body: "@kane-cli go ahead\n\n<sub>hint</sub>", author_association: "MEMBER", created_at: "2026-10-26T10:00:00Z" };
  const s1 = setup({ comments: [own], bot: KANE });
  await run(issueEvent(own), env, s1.deps);
  assert.deepEqual(s1.github.calls, []);

  const c = human("@kane-cli help", { minute: 0 });
  const later = { ...own, id: 71, created_at: "2026-10-26T10:01:00Z" };
  const s2 = setup({ comments: [c, later], bot: KANE });
  await run(issueEvent(c), env, s2.deps);
  assert.deepEqual(s2.requests.map((r) => r.request.text), ["help"]);
});

// --- authorization beyond author_association ------------------------------------------

const MEMBERS = "version: 1\naccess:\n  ask: [OWNER, MEMBER]\n  run: [OWNER, MEMBER]\n";

test("an unlisted association with write, maintain or admin on the repo counts as MEMBER", async () => {
  for (const perm of ["write", "maintain", "admin"]) {
    const c = human("@kane-cli go ahead", { login: "maria", association: "CONTRIBUTOR" });
    const { github, requests, deps } = setup({ comments: [c], config: MEMBERS, permissions: { maria: perm }, answer: { understood: "run", reply: "I would run them.", action: "run", args: { tests: "impacted", policy: null } } });
    await run(issueEvent(c), ENV, deps);
    assert.deepEqual(requests[0].request.author, { login: "maria", association: "CONTRIBUTOR", may: ["ask", "run"] }, perm);
    assert.deepEqual(github.contents("issue", c.id), ["rocket"], perm);
    assert.equal(github.calls.filter(([m]) => m === "getPermission").length, 1, "looked up once");
  }
});

test("read permission, a 404 or a list without MEMBER still refuses", async () => {
  for (const [permissions, config] of [[{ maria: "read" }, MEMBERS], [{}, MEMBERS], [{ maria: "admin" }, "version: 1\naccess:\n  ask: [OWNER]\n"]]) {
    const c = human("@kane-cli help", { login: "maria", association: "CONTRIBUTOR" });
    const { github, requests, deps } = setup({ comments: [c], config, permissions });
    await run(issueEvent(c), ENV, deps);
    assert.equal(requests.length, 0);
    assert.match(kaneComments(github)[0].body, /can ask kane here\./);
    assert.deepEqual(github.contents("issue", c.id), ["confused"]);
  }
});

test("a listed association never costs a permission lookup; write+ lifts ask-only to run", async () => {
  const c = human("@kane-cli help", { association: "OWNER" });
  const s1 = setup({ comments: [c] });
  await run(issueEvent(c), ENV, s1.deps);
  assert.ok(!s1.github.calls.some(([m]) => m === "getPermission"));

  const c2 = human("@kane-cli go ahead", { login: "colla", association: "COLLABORATOR" });
  const s2 = setup({ comments: [c2], permissions: { colla: "write" } });
  await run(issueEvent(c2), ENV, s2.deps);
  assert.deepEqual(s2.requests[0].request.author.may, ["ask", "run"]);
});
