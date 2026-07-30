import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function readStdinJson() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

function safe(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function locateRoot(start) {
  let current = path.resolve(start || process.cwd());
  while (true) {
    if (existsSync(path.join(current, "task-trees.json")) || existsSync(path.join(current, "task-tree.md"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start || process.cwd());
    current = parent;
  }
}

async function loadRuntimeModule(root, name) {
  const hookDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(root, "server", name),
    path.join(root, "llm-task-tree", "server", name),
    path.resolve(hookDir, "../../server", name)
  ];
  const kitPathFile = path.join(root, "llm-task-tree", "setup-task-tree.kitpath");
  if (existsSync(kitPathFile)) candidates.push(path.join(readFileSync(kitPathFile, "utf8").trim(), "server", name));
  const target = candidates.find((candidate) => existsSync(candidate));
  if (!target) throw new Error(`task-tree runtime module not found: ${name}`);
  return import(pathToFileURL(target).href);
}

const input = await readStdinJson();
const root = locateRoot(input.cwd || process.cwd());
const { snapshotWorkspace } = await loadRuntimeModule(root, "turn-tracker.js");
const dir = path.join(root, ".task-tree-maintenance", "turns");
await mkdir(dir, { recursive: true });
const baseline = await snapshotWorkspace(root);
let activeTreePath = "task-tree.md";
try {
  const registry = JSON.parse(await readFile(path.join(root, "task-trees.json"), "utf8"));
  activeTreePath = registry.trees?.find((tree) => tree.id === registry.activeMethod)?.path || activeTreePath;
} catch {
  // Single-tree projects use task-tree.md.
}
let activeTreeMarkdown = "";
try { activeTreeMarkdown = await readFile(path.join(root, activeTreePath), "utf8"); } catch { activeTreeMarkdown = ""; }
const marker = {
  schema: "task-tree-turn/v1",
  sessionId: input.session_id || "",
  turnId: input.turn_id || "",
  cwd: input.cwd || process.cwd(),
  startedAt: new Date().toISOString(),
  startedAtMs: Date.now(),
  baseline,
  activeTreePath,
  activeTreeMarkdown
};
await writeFile(path.join(dir, `${safe(input.session_id)}-${safe(input.turn_id)}.json`), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
process.stdout.write("{}");
