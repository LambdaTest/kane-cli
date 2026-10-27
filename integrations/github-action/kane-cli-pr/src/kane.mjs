// Runs kane-cli (the action's `kane-cli` input, split into argv) and reads its NDJSON stdout.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

/** An error whose message is safe to show on the PR (kane wrote it, not a stack). */
export class PipelineError extends Error {
  constructor(message) {
    super(message);
    this.name = "PipelineError";
  }
}

/** The JSON object on a line, or null for anything else. */
function parseLine(line) {
  const t = line.trim();
  if (!t.startsWith("{")) return null;
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" && typeof v.type === "string" ? v : null;
  } catch {
    return null;
  }
}

/**
 * kane-cli as `cmd` (argv prefix). exec(args, {cwd, onEvent, outFile}) resolves
 * {code, events, stdout, stderr}; stdin is closed (< /dev/null), stdout is teed to outFile.
 * It never logs args, so a login's key never reaches the log.
 */
export function kaneRunner({ cmd, env = process.env, spawnImpl = spawn }) {
  return {
    cmd,
    exec(args, { cwd = process.cwd(), onEvent, outFile, env: extra = null } = {}) {
      return new Promise((resolve, reject) => {
        let child;
        try {
          child = spawnImpl(cmd[0], [...cmd.slice(1), ...args], { cwd, env: extra ? { ...env, ...extra } : env, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) {
          reject(new PipelineError(`kane-cli couldn't start (${e.code ?? e.message})`));
          return;
        }
        const file = outFile ? createWriteStream(outFile) : null;
        const events = [];
        let stdout = "";
        let stderr = "";
        let buf = "";
        const take = (line) => {
          const e = parseLine(line);
          if (!e) return;
          events.push(e);
          try {
            onEvent?.(e);
          } catch {}
        };
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (d) => {
          stdout += d;
          file?.write(d);
          buf += d;
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            take(buf.slice(0, i));
            buf = buf.slice(i + 1);
          }
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (d) => {
          stderr = (stderr + d).slice(-4000);
        });
        child.on("error", (e) => reject(new PipelineError(`kane-cli couldn't start (${e.code ?? e.message})`)));
        child.on("close", (code) => {
          if (buf) take(buf);
          const finish = () => resolve({ code: code ?? 1, events, stdout, stderr });
          if (file) file.end(finish);
          else finish();
        });
      });
    },
  };
}

/** `kane-cli login --username --access-key [--env]`: kane-cli reads no LT_* env, so CI signs in first. */
export async function login(kane, { username, accessKey, env }) {
  if (!username || !accessKey) throw new PipelineError("kane can't run tests here: the username or access-key input is empty.");
  const { code } = await kane.exec(["login", "--username", username, "--access-key", accessKey, ...(env ? ["--env", env] : [])]);
  if (code !== 0) throw new PipelineError("kane couldn't sign in to TestMu with the configured username and access key.");
}

/** The message of a kane-cli `error` event in `events`, or null. */
export function errorOf(events) {
  const e = events.find((x) => x.type === "error");
  return e ? String(e.message ?? e.code ?? "kane-cli reported an error") : null;
}
