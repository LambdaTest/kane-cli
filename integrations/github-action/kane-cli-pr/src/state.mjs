// kane's memory: a hidden block in every kane comment; the newest kane comment holds the current state.

/** The default login kane's token comments as; the action's bot-login input overrides it. */
export const KANE_LOGIN = "github-actions[bot]";
export const MARKER = "<!-- kane-cli:pr-chat -->";
export const MAX_TURNS = 10;
export const MAX_SAID = 600;

const BLOCK = /<!-- kane-cli:state ([A-Za-z0-9_-]*) -->/g;

export function emptyState(headSha = null) {
  return { v: 1, head_sha: headSha, run_sha: null, turns: [], last_action: null, impacted: [], results: null, pending_question: null, answered_upto: null };
}

/** The hidden block for `state`. */
export function writeState(state) {
  return `<!-- kane-cli:state ${Buffer.from(JSON.stringify(state), "utf8").toString("base64url")} -->`;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const strOrNull = (v) => (typeof v === "string" ? v : null);
const named = (list) => list.filter((t) => isObj(t) && typeof t.test === "string");

/** A bot-written state with every field in the shape the rest of the action expects. */
function normalise(s) {
  return {
    ...emptyState(),
    ...s,
    head_sha: strOrNull(s.head_sha),
    run_sha: strOrNull(s.run_sha),
    turns: Array.isArray(s.turns) ? s.turns.filter(isObj) : [],
    last_action: strOrNull(s.last_action),
    impacted: Array.isArray(s.impacted) ? named(s.impacted) : [],
    results: Array.isArray(s.results) ? named(s.results) : null,
    pending_question: strOrNull(s.pending_question),
    answered_upto: typeof s.answered_upto === "string" && !Number.isNaN(Date.parse(s.answered_upto)) ? s.answered_upto : null,
  };
}

function parseBlock(body) {
  const last = [...body.matchAll(BLOCK)].at(-1);
  if (!last) return emptyState();
  try {
    const s = JSON.parse(Buffer.from(last[1], "base64url").toString("utf8"));
    if (s === null || typeof s !== "object" || s.v !== 1) return emptyState();
    return normalise(s);
  } catch {
    return emptyState();
  }
}

/**
 * kane's newest comment and its state: the last comment by `login` (kane's bot login) that
 * carries the marker (there is one per request; newest wins); null when there is none.
 * Nobody else's comments are read as state.
 */
export function readState(comments, login = KANE_LOGIN) {
  const comment = comments.findLast((c) => c?.user?.login === login && typeof c.body === "string" && c.body.includes(MARKER));
  return comment ? { comment, state: parseBlock(comment.body) } : null;
}

const cap = (s) => String(s ?? "").slice(0, MAX_SAID);

/** A new state with the asker's words and kane's reply added; keeps the newest 10 turns. */
export function addTurns(state, who, said, kaneSaid) {
  const turns = [...(state?.turns ?? []), { who, said: cap(said) }];
  if (kaneSaid != null) turns.push({ who: "kane", said: cap(kaneSaid) });
  return { ...emptyState(), ...state, turns: turns.slice(-MAX_TURNS) };
}

/** `state` with answered_upto moved up to `createdAt` (the newest comment kane has handled); never moves back. */
export function answeredUpto(state, createdAt) {
  const at = Date.parse(createdAt ?? "");
  if (Number.isNaN(at)) return state;
  const prev = Date.parse(state?.answered_upto ?? "");
  if (!Number.isNaN(prev) && prev >= at) return state;
  return { ...state, answered_upto: new Date(at).toISOString() };
}
