// The few GitHub REST calls kane needs, on Node's built-in fetch.

const KINDS = { issue: "issues", review: "pulls" };

export class GitHub {
  constructor(token, repo, api = "https://api.github.com") {
    this.token = token;
    this.repo = repo;
    this.api = api.replace(/\/$/, "");
  }

  async request(method, path, { body, accept = "application/vnd.github+json", raw = false, allow404 = false } = {}) {
    const url = path.startsWith("http") ? path : `${this.api}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept,
        "x-github-api-version": "2022-11-28",
        "user-agent": "kane-cli-pr",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (allow404 && res.status === 404) {
      await res.body?.cancel();
      return { data: null, res };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text;
      try {
        message = JSON.parse(text).message ?? text;
      } catch {}
      throw Object.assign(new Error(`GitHub ${method} ${new URL(url).pathname} → ${res.status}: ${String(message).slice(0, 300)}`), { status: res.status });
    }
    if (res.status === 204 || raw) return { data: res.status === 204 ? null : await res.text(), res };
    const text = await res.text();
    return { data: text ? JSON.parse(text) : null, res };
  }

  /** Every page of a list endpoint, following the Link header. */
  async all(path) {
    const out = [];
    let next = path;
    while (next) {
      const { data, res } = await this.request("GET", next);
      out.push(...(data ?? []));
      next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
    }
    return out;
  }

  reactionsPath(kind, commentId) {
    const k = KINDS[kind];
    if (!k) throw new Error(`unknown comment kind ${JSON.stringify(kind)}; use "issue" or "review"`);
    return `/repos/${this.repo}/${k}/comments/${commentId}/reactions`;
  }

  listComments(n) {
    return this.all(`/repos/${this.repo}/issues/${n}/comments?per_page=100`);
  }

  /** The PR's review-line comments (reactions kind "review"). */
  listReviewComments(n) {
    return this.all(`/repos/${this.repo}/pulls/${n}/comments?per_page=100`);
  }

  /** The login's permission on the repo ("admin", "maintain", "write", "triage", "read", "none"). Throws on 404. */
  async getPermission(login) {
    const { data } = await this.request("GET", `/repos/${this.repo}/collaborators/${encodeURIComponent(login)}/permission`);
    return { permission: data?.permission ?? null, role: data?.role_name ?? null };
  }

  async createComment(n, body) {
    return (await this.request("POST", `/repos/${this.repo}/issues/${n}/comments`, { body: { body } })).data;
  }

  async updateComment(id, body) {
    return (await this.request("PATCH", `/repos/${this.repo}/issues/comments/${id}`, { body: { body } })).data;
  }

  async deleteComment(id) {
    await this.request("DELETE", `/repos/${this.repo}/issues/comments/${id}`);
  }

  /** Adds a reaction to an issue (or PR conversation) comment or a review-line comment; returns its id. */
  async addReaction(kind, commentId, content) {
    return (await this.request("POST", this.reactionsPath(kind, commentId), { body: { content } })).data.id;
  }

  async deleteReaction(kind, commentId, reactionId) {
    await this.request("DELETE", `${this.reactionsPath(kind, commentId)}/${reactionId}`);
  }

  listReactions(kind, commentId) {
    return this.all(`${this.reactionsPath(kind, commentId)}?per_page=100`);
  }

  async getPull(n) {
    return (await this.request("GET", `/repos/${this.repo}/pulls/${n}`)).data;
  }

  async getDiff(n) {
    return (await this.request("GET", `/repos/${this.repo}/pulls/${n}`, { accept: "application/vnd.github.diff", raw: true })).data;
  }

  /** Creates a check run ({name, head_sha, status, conclusion?, output?}); returns its id. Needs checks: write. */
  async createCheckRun(check) {
    return (await this.request("POST", `/repos/${this.repo}/check-runs`, { body: check })).data.id;
  }

  async updateCheckRun(id, fields) {
    await this.request("PATCH", `/repos/${this.repo}/check-runs/${id}`, { body: fields });
  }

  /** A file's text on the default branch, or null when it doesn't exist. */
  async getDefaultBranchFile(path) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const { data } = await this.request("GET", `/repos/${this.repo}/contents/${encoded}`, { allow404: true });
    if (data == null || typeof data.content !== "string") return null;
    return Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  }
}
