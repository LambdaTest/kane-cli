// An in-memory GitHub with the same methods as src/github.mjs, recording every call.
import { KANE_LOGIN } from "../src/state.mjs";

export const BOT = { login: KANE_LOGIN, type: "Bot" };

const READS = new Set(["listComments", "listReviewComments", "listReactions", "getPull", "getDiff", "getDefaultBranchFile", "getPermission"]);

export class FakeGitHub {
  constructor({ comments = [], pull = null, diff = "", config = null, reviewComments = [], permissions = {}, bot = BOT } = {}) {
    this.bot = bot;
    this.permissions = permissions; // login → "admin" | "maintain" | "write" | "read" | ...; missing → 404
    this.comments = comments.map((c) => ({ ...c }));
    this.reviewComments = reviewComments.map((c) => ({ ...c }));
    this.pull = pull;
    this.diff = diff;
    this.config = config;
    this.reactions = new Map(); // "kind:commentId" → [{id, content, user}]
    this.calls = []; // [method, ...args]
    this.writes = []; // body writes in order: {op, id, body}
    this.nextId = 1000;
    this.checks = []; // {id, name, head_sha, status, conclusion, output, updates: [...]}
  }

  record(method, ...args) {
    this.calls.push([method, ...args]);
  }

  /** Calls that change something on GitHub. */
  get writeCalls() {
    return this.calls.filter(([m]) => !READS.has(m));
  }

  reactionsOn(kind, commentId) {
    const key = `${kind}:${commentId}`;
    if (!this.reactions.has(key)) this.reactions.set(key, []);
    return this.reactions.get(key);
  }

  /** Reaction contents on a comment, in the order they were added. */
  contents(kind, commentId) {
    return this.reactionsOn(kind, commentId).map((r) => r.content);
  }

  async listComments(n) {
    this.record("listComments", n);
    return this.comments.map((c) => ({ ...c }));
  }

  async createComment(n, body) {
    this.record("createComment", n, body);
    const c = { id: this.nextId++, user: this.bot, body, created_at: new Date(Date.UTC(2026, 9, 26, 12, 0, this.nextId % 60)).toISOString(), author_association: "NONE" };
    this.comments.push(c);
    this.writes.push({ op: "create", id: c.id, body });
    return { ...c };
  }

  async updateComment(id, body) {
    this.record("updateComment", id, body);
    const c = this.comments.find((x) => x.id === id);
    if (!c) throw new Error(`no comment ${id}`);
    c.body = body;
    this.writes.push({ op: "update", id, body });
    return { ...c };
  }

  async deleteComment(id) {
    this.record("deleteComment", id);
    const i = this.comments.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`no comment ${id}`);
    this.comments.splice(i, 1);
    this.writes.push({ op: "delete", id });
  }

  async addReaction(kind, commentId, content) {
    this.record("addReaction", kind, commentId, content);
    const r = { id: this.nextId++, content, user: this.bot };
    this.reactionsOn(kind, commentId).push(r);
    return r.id;
  }

  async deleteReaction(kind, commentId, reactionId) {
    this.record("deleteReaction", kind, commentId, reactionId);
    const list = this.reactionsOn(kind, commentId);
    const i = list.findIndex((r) => r.id === reactionId);
    if (i >= 0) list.splice(i, 1);
  }

  async listReviewComments(n) {
    this.record("listReviewComments", n);
    return this.reviewComments.map((c) => ({ ...c }));
  }

  async getPermission(login) {
    this.record("getPermission", login);
    const p = this.permissions[login];
    if (p === undefined) throw Object.assign(new Error(`GitHub GET /collaborators/${login}/permission → 404: Not Found`), { status: 404 });
    return { permission: p === "maintain" ? "write" : p, role: p };
  }

  async listReactions(kind, commentId) {
    this.record("listReactions", kind, commentId);
    return this.reactionsOn(kind, commentId).map((r) => ({ ...r }));
  }

  async getPull(n) {
    this.record("getPull", n);
    return this.pull;
  }

  async getDiff(n) {
    this.record("getDiff", n);
    return this.diff;
  }

  async createCheckRun(check) {
    this.record("createCheckRun", check);
    const c = { id: this.nextId++, ...check, updates: [] };
    this.checks.push(c);
    return c.id;
  }

  async updateCheckRun(id, fields) {
    this.record("updateCheckRun", id, fields);
    const c = this.checks.find((x) => x.id === id);
    if (!c) throw new Error(`no check ${id}`);
    c.updates.push(fields);
    Object.assign(c, fields);
  }

  /** The check named `name`, or undefined. */
  check(name) {
    return this.checks.find((c) => c.name === name);
  }

  async getDefaultBranchFile(path) {
    this.record("getDefaultBranchFile", path);
    return this.config;
  }
}
