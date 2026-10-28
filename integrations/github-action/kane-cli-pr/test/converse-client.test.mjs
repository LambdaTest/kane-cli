import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { converse, basicAuth } from "../src/converse-client.mjs";

const routes = new Map(); // path → (req, res, body) => void
const seen = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    seen.push({ path: req.url, method: req.method, headers: req.headers, body });
    routes.get(req.url)?.(req, res, body);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => {
  server.closeAllConnections();
  server.close();
});

const json = (status, obj) => (req, res) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof obj === "string" ? obj : JSON.stringify(obj));
};
const GOOD = { understood: "explain the fee", reply: "The fee sits in subtotal().", action: "answer", args: { tests: null, policy: null } };
const AUTH = basicAuth("lt-user", "lt-key");
const REQ = { version: 1, text: "why?" };

test("basicAuth is base64(user:key)", () => {
  assert.equal(AUTH, `Basic ${Buffer.from("lt-user:lt-key").toString("base64")}`);
});

test("a 200 answer comes back, posted as JSON with the auth header", async () => {
  routes.set("/ok", json(200, GOOD));
  assert.deepEqual(await converse(`${base}/ok`, AUTH, REQ), GOOD);
  const s = seen.at(-1);
  assert.equal(s.method, "POST");
  assert.equal(s.headers.authorization, AUTH);
  assert.match(s.headers["content-type"], /application\/json/);
  assert.deepEqual(JSON.parse(s.body), REQ);
});

test("missing args or nulls are normalised", async () => {
  routes.set("/flat", json(200, { understood: null, reply: "hi", action: "help" }));
  assert.deepEqual(await converse(`${base}/flat`, AUTH, REQ), { understood: "", reply: "hi", action: "help", args: { tests: null, policy: null } });
});

test("timeout → null", async () => {
  routes.set("/hang", () => {});
  const t0 = Date.now();
  assert.equal(await converse(`${base}/hang`, AUTH, REQ, { timeoutMs: 150 }), null);
  assert.ok(Date.now() - t0 < 2000);
});

test("500 → null", async () => {
  routes.set("/500", json(500, GOOD));
  assert.equal(await converse(`${base}/500`, AUTH, REQ), null);
  routes.set("/401", json(401, { error: "unauthorized" }));
  assert.equal(await converse(`${base}/401`, AUTH, REQ), null);
});

test("junk JSON → null", async () => {
  routes.set("/junk", json(200, "{not json"));
  assert.equal(await converse(`${base}/junk`, AUTH, REQ), null);
  for (const bad of [null, [], "str", { ...GOOD, action: "deploy" }, { ...GOOD, reply: 5 }, { ...GOOD, args: "x" }, { ...GOOD, understood: 3 }]) {
    routes.set("/bad", json(200, JSON.stringify(bad)));
    assert.equal(await converse(`${base}/bad`, AUTH, REQ), null, JSON.stringify(bad));
  }
});

test("an unreachable host → null", async () => {
  assert.equal(await converse("http://127.0.0.1:1/nope", AUTH, REQ, { timeoutMs: 1000 }), null);
  assert.equal(await converse("not a url", AUTH, REQ), null);
});

/** Runs converse with a recording log; returns [answer, lines]. */
async function logged(path, opts = {}) {
  const lines = [];
  const answer = await converse(path.startsWith("http") || path.startsWith("not") ? path : `${base}${path}`, AUTH, REQ, { ...opts, log: (l) => lines.push(l) });
  return [answer, lines];
}

test("every fallback logs one line saying why, never the body or the keys", async () => {
  routes.set("/500b", json(500, { error: "SECRET provider detail" }));
  routes.set("/junkb", json(200, "{not json"));
  routes.set("/badb", json(200, { ...GOOD, action: "deploy" }));
  routes.set("/hangb", () => {});
  const cases = [
    ["/500b", {}, "converse: fallback (500)"],
    ["/junkb", {}, "converse: fallback (invalid)"],
    ["/badb", {}, "converse: fallback (invalid)"],
    ["/hangb", { timeoutMs: 150 }, "converse: fallback (timeout)"],
    ["http://127.0.0.1:1/nope", { timeoutMs: 1000 }, "converse: fallback (unreachable)"],
  ];
  for (const [path, opts, want] of cases) {
    const [answer, lines] = await logged(path, opts);
    assert.equal(answer, null, path);
    assert.deepEqual(lines, [want], path);
  }
});

test("401 and 403 also raise a ::warning:: annotation; a 200 logs nothing", async () => {
  for (const status of [401, 403]) {
    routes.set(`/s${status}`, json(status, { error: "unauthorized" }));
    const [answer, lines] = await logged(`/s${status}`);
    assert.equal(answer, null);
    assert.equal(lines[0], `converse: fallback (${status})`);
    assert.match(lines[1], /^::warning::.*\(\d{3}\).*username and access-key/);
    assert.equal(lines.length, 2);
    for (const l of lines) {
      assert.doesNotMatch(l, /lt-key|lt-user|unauthorized/);
    }
  }
  routes.set("/okb", json(200, GOOD));
  const [answer, lines] = await logged("/okb");
  assert.deepEqual(answer, GOOD);
  assert.deepEqual(lines, []);
});
