/**
 * Starts a Codex conversation from the task graph UI, so a click is enough to get the interactive
 * graph into the desktop app.
 *
 * The `codex://threads/new?prompt=` deeplink only prefills the composer — the app's route handler
 * does `navigate("/", { focusComposerNonce, prefillPrompt })` and nothing in the bundle can submit
 * it, so that path always ends with the user pressing Enter. The app-server protocol has no such
 * limit: `thread/start` + `turn/start` run a turn outright, and the thread lands in the same store
 * the desktop app lists, so `codex://threads/<id>` opens the running conversation.
 *
 * A turn is also the only way to get the widget rendered. Host-driven calls cannot produce the
 * `mcpToolCall` item that carries `ui://task-tree/graph.html`: `mcpServer/tool/call` returns the
 * result to the caller without touching the transcript, and `thread/inject_items` only writes the
 * model-visible history (`thread/read` still reports zero items). One model turn is the floor.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { OPEN_GRAPH_PROMPT } from "./codex-prompts.js";

export { OPEN_GRAPH_PROMPT };

/** Shown in the desktop app's thread list, so the pinned conversation is findable without the id. */
export const PINNED_THREAD_NAME = "任务图工作台";

const PIN_FILE = ".task-tree-thread";

/**
 * This build routes every MCP tool through the code-mode `exec` host, which rebuilds results as
 * text and images: 7119 exec calls against 0 direct calls across the newest 60 rollouts. The switch
 * for it, `tool_search_always_defer_mcp_tools`, is a removed-stage feature pinned to its default,
 * so setting it false in config.toml changes nothing (verified). A turn started here therefore gets
 * the tool's text, never the `McpToolCall` event that carries `mcp_app_resource_uri`.
 */

/** Long enough for a slow first model response; the child is killed either way so nothing leaks. */
const TURN_TIMEOUT_MS = 10 * 60 * 1000;
/** Failing to even accept the turn should surface fast instead of hanging the button. */
const ACCEPT_TIMEOUT_MS = 60 * 1000;
/**
 * How long to watch a started turn before answering the caller. A turn that dies on the model call
 * (a rate-limited provider, say) dies within a few seconds, and reporting that beats handing back a
 * thread that will be empty when the user switches to it.
 */
const SETTLE_MS = 15 * 1000;

function newestCodexInBinDir(binDir) {
  if (!existsSync(binDir)) return "";
  const candidates = readdirSync(binDir)
    .map((entry) => path.join(binDir, entry, process.platform === "win32" ? "codex.exe" : "codex"))
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => ({ candidate, mtime: statSync(candidate).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.candidate || "";
}

export function findCodexBinary() {
  const explicit = process.env.TASK_TREE_CODEX;
  if (explicit && existsSync(explicit)) return explicit;

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      const managed = newestCodexInBinDir(path.join(local, "OpenAI", "Codex", "bin"));
      if (managed) return managed;
    }
  } else {
    const home = process.env.HOME;
    if (home) {
      const managed = newestCodexInBinDir(path.join(home, ".local", "share", "OpenAI", "Codex", "bin"));
      if (managed) return managed;
    }
  }

  // Falls back to PATH; spawn reports a clear ENOENT if Codex is not installed at all.
  return process.platform === "win32" ? "codex.exe" : "codex";
}

export const spawnAppServer = () => spawn(findCodexBinary(), ["app-server"], { stdio: ["pipe", "pipe", "pipe"] });

class AppServerSession {
  constructor(child, { trustedServer = "task_tree" } = {}) {
    this.child = child;
    this.trustedServer = trustedServer;
    this.nextId = 1;
    this.pending = new Map();
    this.notify = () => {};
    this.stderr = "";
    this.buffer = "";

    this.child.stderr.on("data", (chunk) => { this.stderr += chunk.toString("utf8"); });
    this.child.stdout.on("data", (chunk) => this.#consume(chunk));
    this.child.on("exit", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`codex app-server 退出了：${this.stderr.slice(-300) || "没有错误输出"}`));
      }
      this.pending.clear();
    });
  }

  #consume(chunk) {
    this.buffer += chunk.toString("utf8");
    let index;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }

      // A server->client request carries both a method and an id, and the turn blocks until it is
      // answered. Leaving these unanswered is what used to hang every tool call forever.
      if (message.method && message.id !== undefined) {
        this.#answer(message);
        continue;
      }

      if (message.method) {
        this.notify(message);
        continue;
      }
      const waiter = this.pending.get(message.id);
      if (!waiter) continue;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  }

  /**
   * Approves the task graph's own tools and refuses everything else. The launch only needs one tool
   * on one server, so a blanket yes would hand a click more authority than it asked for.
   */
  #answer(message) {
    const respond = (result) => this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);

    if (message.method === "mcpServer/elicitation/request") {
      const mine = message.params?.serverName === this.trustedServer;
      respond({ action: mine ? "accept" : "decline", content: mine ? {} : null });
      return;
    }

    // Approval shapes differ per request, but every one of them takes a decision string.
    respond({ decision: "denied" });
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  close() {
    this.child.kill();
  }
}

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s）`)), ms))
]);

/**
 * Which conversation this project's button talks to. Kept in the project rather than in the app so
 * that two projects open from the same desktop app do not fight over one thread.
 */
export function readPinnedThread(projectRoot) {
  try {
    const id = readFileSync(path.join(projectRoot, PIN_FILE), "utf8").replace(/^\uFEFF/, "").trim();
    // Codex hands out UUIDs today, but pinning to that exact shape would silently stop reusing the
    // thread if the format ever changed. This only has to reject junk; an id Codex no longer knows
    // fails the resume and falls back to a new thread anyway.
    return /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function writePinnedThread(projectRoot, threadId) {
  writeFileSync(path.join(projectRoot, PIN_FILE), `${threadId}\n`, "utf8");
}

/** Runs one short request/response exchange and always reaps the child. */
async function withSession(spawnCodex, run) {
  const session = new AppServerSession(spawnCodex());
  try {
    await withTimeout(
      session.request("initialize", { clientInfo: { name: "task-tree-ui", title: "任务图", version: "1.0.0" } }),
      ACCEPT_TIMEOUT_MS,
      "连接 codex app-server"
    );
    return await run(session);
  } finally {
    session.close();
  }
}

/**
 * The conversations this project can be sent to. Codex stores every thread with the cwd it was
 * started in, so filtering on that keeps another project's history out of the picker.
 */
export async function listProjectThreads({ cwd, limit = 12, spawnCodex = spawnAppServer } = {}) {
  const mine = path.resolve(cwd).toLowerCase();
  const listed = await withSession(spawnCodex, (session) => withTimeout(
    session.request("thread/list", { limit: 60 }),
    ACCEPT_TIMEOUT_MS,
    "读取会话列表"
  ));

  return (listed?.data || [])
    .filter((thread) => thread?.id && thread.cwd && path.resolve(thread.cwd).toLowerCase() === mine)
    .filter((thread) => !thread.ephemeral)
    .slice(0, limit)
    .map((thread) => ({
      id: thread.id,
      name: thread.name || "",
      // Collapsed: a preview carrying newlines turns one menu row into a paragraph.
      preview: String(thread.preview || "").replace(/\s+/g, " ").trim().slice(0, 80),
      updatedAt: thread.updatedAt || thread.recencyAt || thread.createdAt || 0
    }));
}

/**
 * Runs one turn and resolves as soon as Codex accepts it, so the caller can jump to the thread
 * while the model is still working. The child stays alive until the turn ends, because killing the
 * app-server would abort the turn it is running.
 *
 * @returns {Promise<{threadId: string, turnId: string|null, resumed: boolean}>}
 */
export async function startCodexTurn({
  prompt = OPEN_GRAPH_PROMPT,
  cwd,
  threadId: wanted = "",
  model = null,
  sandbox = "read-only",
  approvalPolicy = "never",
  config = null,
  spawnCodex = spawnAppServer
} = {}) {
  const session = new AppServerSession(spawnCodex());

  try {
    await withTimeout(
      session.request("initialize", { clientInfo: { name: "task-tree-ui", title: "任务图", version: "1.0.0" } }),
      ACCEPT_TIMEOUT_MS,
      "连接 codex app-server"
    );

    // Resuming loads the conversation's history, so the turn lands in the thread the user is
    // already working in instead of starting a stranger. A thread that was archived or deleted
    // outside the UI should not turn a click into an error, so that case falls through to a new one.
    let resumed = false;
    let started = null;
    if (wanted) {
      try {
        started = await withTimeout(session.request("thread/resume", { threadId: wanted }), ACCEPT_TIMEOUT_MS, "恢复会话");
        resumed = Boolean(started?.thread?.id);
      } catch {
        started = null;
      }
    }

    if (!started) {
      started = await withTimeout(
        session.request("thread/start", {
          cwd,
          sandbox,
          approvalPolicy,
          ...(config ? { config } : {}),
          ...(model ? { model } : {})
        }),
        ACCEPT_TIMEOUT_MS,
        "新建会话"
      );
    }

    const threadId = started?.thread?.id || started?.threadId;
    if (!threadId) throw new Error("codex 没有返回会话 id");

    // A named thread is findable in the app's list; an id is not. Failure here is cosmetic.
    if (!resumed) {
      try {
        await withTimeout(session.request("thread/name/set", { threadId, name: PINNED_THREAD_NAME }), ACCEPT_TIMEOUT_MS, "命名会话");
      } catch { /* the thread still works unnamed */ }
    }

    let failure = "";
    let produced = false;
    let settle = () => {};
    const settled = new Promise((resolve) => { settle = resolve; });

    session.notify = (message) => {
      const params = message.params || {};
      if (params.threadId && params.threadId !== threadId) return;

      // A retrying error is Codex narrating a hiccup ("Reconnecting... 1/5"), not a dead turn.
      if (message.method === "error" && params.willRetry !== true) {
        failure = params.error?.message || "模型这一轮失败了";
        settle();
      }
      // Anything the model emits means the turn is alive; the caller can stop waiting and jump.
      if (message.method === "item/started" && params.item?.type !== "userMessage") {
        produced = true;
        settle();
      }
      if (message.method === "turn/completed" || message.method === "turn/failed") {
        settle();
        session.close();
      }
    };

    const accepted = await withTimeout(
      session.request("turn/start", { threadId, input: [{ type: "text", text: prompt }] }),
      ACCEPT_TIMEOUT_MS,
      "发起对话"
    );

    await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, SETTLE_MS))]);
    if (failure && !produced) {
      const error = new Error(failure);
      error.threadId = threadId;
      error.resumed = resumed;
      throw error;
    }

    // Nothing awaits the rest of the turn; this only guarantees the child is reaped.
    setTimeout(() => session.close(), TURN_TIMEOUT_MS).unref?.();

    return { threadId, turnId: accepted?.turn?.id || null, resumed };
  } catch (error) {
    session.close();
    throw error;
  }
}

export function threadDeepLink(threadId) {
  return `codex://threads/${threadId}`;
}

/** Hands the url to the OS so the desktop app comes forward on the thread we just started. */
export function openInCodex(threadId) {
  const url = threadDeepLink(threadId);
  const [command, args] = process.platform === "win32"
    ? ["cmd.exe", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];

  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
  return url;
}
