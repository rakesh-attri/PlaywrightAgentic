import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export const root = path.resolve(process.env.SFQA_ROOT || process.cwd());
export function json<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function write(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
export function hash(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
export function runPath(id: string) {
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) throw Error("Invalid run ID");
  const dir = path.join(root, "artifacts", id);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.realpathSync(dir) !== dir)
    throw Error("Run path must not be a symlink");
  return dir;
}
export function append(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + "\n");
}
export function safeError(error: unknown) {
  return error instanceof Error
    ? error.message
        .replace(
          /(Bearer\s+|access_token[=:]\s*|sid=)[^\s&"']+/gi,
          "$1[REDACTED]",
        )
        .slice(0, 1000)
    : "Unknown framework error";
}
export function memoryEvent(entry: Record<string, unknown>) {
  append(path.join(root, "memory/run-history.jsonl"), {
    at: new Date().toISOString(),
    ...entry,
  });
}
export function recordIncident(
  runId: string,
  component: string,
  error: unknown,
) {
  append(path.join(root, "memory/incidents.jsonl"), {
    at: new Date().toISOString(),
    runId,
    component,
    status: "unverified",
    message: safeError(error),
  });
}
export function projectMemory() {
  const p = path.join(root, "memory/FRAMEWORK_KNOWLEDGE.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}
