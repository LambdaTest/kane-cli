import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { GitHub } from "../src/github.mjs";

const seen = [];
let handler = () => {};
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    seen.push({ method: req.method, path: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
    handler(req, res);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const api = `http://127.0.0.1:${server.address().port}`;
after(() => {
  server.closeAllConnections();
  server.close();
});
const gh = new GitHub("tok", "o/r", api);
const send = (res, status, obj, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(obj === undefined ? "" : typeof obj === "string" ? obj : JSON.stringify(obj));
};

test("listComments follows every page", async () => {
  seen.length = 0;
  handler = (req, res) => {
    if (req.url.includes("page=2")) send(res, 200, [{ id: 3 }]);
    else send(res, 200, [{ id: 1 }, { id: 2 }], { link: `<${api}/repos/o/r/issues/7/comments?per_page=100&page=2>; rel="next", <${api}/x>; rel="last"` });
  };
  assert.deepEqual((await gh.listComments(7)).map((c) => c.id), [1, 2, 3]);
  assert.equal(seen[0].path, "/repos/o/r/issues/7/comments?per_page=100");
  assert.equal(seen[0].headers.authorization, "Bearer tok");
  assert.equal(seen[0].headers.accept, "application/vnd.github+json");
  assert.ok(seen[0].headers["user-agent"]);
});

test("comment writes hit the issue comment endpoints", async () => {
  seen.length = 0;
  handler = (req, res) => (req.method === "DELETE" ? send(res, 204) : send(res, 200, { id: 9, body: "b" }));
  assert.equal((await gh.createComment(7, "hello")).id, 9);
  await gh.updateComment(9, "again");
  await gh.deleteComment(9);
  assert.deepEqual(seen.map((s) => [s.method, s.path, s.body]), [
    ["POST", "/repos/o/r/issues/7/comments", { body: "hello" }],
    ["PATCH", "/repos/o/r/issues/comments/9", { body: "again" }],
    ["DELETE", "/repos/o/r/issues/comments/9", null],
  ]);
});

test("reactions use the issue or the pulls comment endpoints by kind", async () => {
  seen.length = 0;
  handler = (req, res) => (req.method === "DELETE" ? send(res, 204) : req.method === "GET" ? send(res, 200, [{ id: 4, content: "eyes" }]) : send(res, 201, { id: 4 }));
  assert.equal(await gh.addReaction("issue", 5, "eyes"), 4);
  assert.equal(await gh.addReaction("review", 6, "rocket"), 4);
  await gh.deleteReaction("issue", 5, 4);
  await gh.deleteReaction("review", 6, 4);
  assert.deepEqual(await gh.listReactions("review", 6), [{ id: 4, content: "eyes" }]);
  assert.deepEqual(seen.map((s) => [s.method, s.path, s.body]), [
    ["POST", "/repos/o/r/issues/comments/5/reactions", { content: "eyes" }],
    ["POST", "/repos/o/r/pulls/comments/6/reactions", { content: "rocket" }],
    ["DELETE", "/repos/o/r/issues/comments/5/reactions/4", null],
    ["DELETE", "/repos/o/r/pulls/comments/6/reactions/4", null],
    ["GET", "/repos/o/r/pulls/comments/6/reactions?per_page=100", null],
  ]);
  await assert.rejects(gh.addReaction("commit", 1, "eyes"), /kind/);
});

test("getPull, getDiff (diff media type) and the default-branch file", async () => {
  seen.length = 0;
  handler = (req, res) => {
    if (req.url.startsWith("/repos/o/r/contents/missing")) return send(res, 404, { message: "Not Found" });
    if (req.url.startsWith("/repos/o/r/contents/")) return send(res, 200, { encoding: "base64", content: Buffer.from("version: 1\n").toString("base64").replace(/(.{4})/g, "$1\n") });
    if (req.headers.accept === "application/vnd.github.diff") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("diff --git a/x b/x\n");
    }
    send(res, 200, { number: 7 });
  };
  assert.equal((await gh.getPull(7)).number, 7);
  assert.equal(await gh.getDiff(7), "diff --git a/x b/x\n");
  assert.equal(seen[1].path, "/repos/o/r/pulls/7");
  assert.equal(await gh.getDefaultBranchFile(".github/kane-cli.yml"), "version: 1\n");
  assert.equal(seen[2].path, "/repos/o/r/contents/.github/kane-cli.yml");
  assert.equal(await gh.getDefaultBranchFile("missing.yml"), null);
});

test("a failed call throws with the status and the path", async () => {
  handler = (req, res) => send(res, 403, { message: "Resource not accessible by integration" });
  await assert.rejects(gh.createComment(7, "x"), /POST \/repos\/o\/r\/issues\/7\/comments → 403: .*not accessible/);
});

test("listReviewComments reads the PR's review-line comments", async () => {
  seen.length = 0;
  handler = (req, res) => send(res, 200, [{ id: 11, path: "a.js" }]);
  assert.deepEqual(await gh.listReviewComments(7), [{ id: 11, path: "a.js" }]);
  assert.equal(seen[0].path, "/repos/o/r/pulls/7/comments?per_page=100");
});

test("getPermission reads the collaborator permission; a 404 throws with its status", async () => {
  seen.length = 0;
  handler = (req, res) => (req.url.includes("nobody") ? send(res, 404, { message: "Not Found" }) : send(res, 200, { permission: "write", role_name: "maintain" }));
  assert.deepEqual(await gh.getPermission("maria"), { permission: "write", role: "maintain" });
  assert.equal(seen[0].path, "/repos/o/r/collaborators/maria/permission");
  await assert.rejects(gh.getPermission("nobody"), (e) => e.status === 404);
});

test("createCheckRun posts a check on the head sha; updateCheckRun patches it", async () => {
  seen.length = 0;
  handler = (req, res) => send(res, req.method === "POST" ? 201 : 200, { id: 77 });
  const id = await gh.createCheckRun({ name: "kane-cli / tests", head_sha: "abc", status: "in_progress", output: { title: "Running", summary: "s" } });
  assert.equal(id, 77);
  assert.deepEqual([seen[0].method, seen[0].path], ["POST", "/repos/o/r/check-runs"]);
  assert.deepEqual(seen[0].body, { name: "kane-cli / tests", head_sha: "abc", status: "in_progress", output: { title: "Running", summary: "s" } });
  await gh.updateCheckRun(77, { status: "completed", conclusion: "failure", output: { title: "1 failing", summary: "x" } });
  assert.deepEqual([seen[1].method, seen[1].path], ["PATCH", "/repos/o/r/check-runs/77"]);
  assert.equal(seen[1].body.conclusion, "failure");
});
