/**
 * The task graph as an MCP Apps widget: the real UI, embedded in the chat.
 *
 * A picture answers "what does it look like"; it does not answer "let me drag that node". MCP Apps
 * is the only surface in the desktop app that renders something interactive, so the widget is an
 * iframe pointing at the local UI. Embedding the page itself rather than rebuilding it in the
 * widget is the whole point: there is one implementation of the graph, and it cannot drift.
 *
 * Two host rules shape this file:
 *   - The bridge is only enabled for resources served as `text/html;profile=mcp-app`.
 *   - Subframes are blocked unless the resource declares `_meta.ui.csp.frameDomains`.
 */

export const WIDGET_URI = "ui://task-tree/graph.html";
export const WIDGET_MIME = "text/html;profile=mcp-app";

/** Port is unknown until the local server is up, so the allowlist has to cover any loopback port. */
const LOOPBACK = ["http://127.0.0.1:*", "http://localhost:*"];

export const WIDGET_META = {
  ui: {
    csp: {
      connectDomains: LOOPBACK,
      resourceDomains: LOOPBACK,
      frameDomains: LOOPBACK
    },
    preferBorder: false
  }
};

export function widgetHtml({ port, host = "127.0.0.1" }) {
  const origin = `http://${host}:${port}`;
  return `<div id="taskTreeWidget">
  <style>
    #taskTreeWidget {
      --tt-line: #e3e3dd;
      position: relative;
      width: 100%;
      height: 78vh;
      min-height: 460px;
      border: 1px solid var(--tt-line);
      border-radius: 10px;
      overflow: hidden;
      background: #fbfbf8;
      font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    #taskTreeFrame { width: 100%; height: 100%; border: 0; display: block; }
    #taskTreeNotice {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
      justify-content: center;
      padding: 28px 32px;
      background: #fbfbf8;
      color: #2f2f2b;
    }
    #taskTreeNotice.is-shown { display: flex; }
    #taskTreeNotice h3 { margin: 0; font-size: 15px; }
    #taskTreeNotice p { margin: 0; max-width: 46em; color: #5f5f58; }
    #taskTreeNotice code { background: #f0f0ea; padding: 1px 5px; border-radius: 4px; }
    #taskTreeBar {
      position: absolute;
      right: 10px;
      top: 10px;
      display: flex;
      gap: 6px;
      z-index: 2;
    }
    #taskTreeBar button {
      border: 1px solid var(--tt-line);
      background: rgba(255, 255, 255, 0.92);
      border-radius: 6px;
      padding: 4px 10px;
      font: inherit;
      cursor: pointer;
    }
    #taskTreeBar button:hover { background: #fff; }
  </style>

  <div id="taskTreeBar">
    <button type="button" data-action="fullscreen">全屏</button>
    <button type="button" data-action="reload">刷新</button>
  </div>
  <iframe id="taskTreeFrame" src="${origin}/?embed=1" title="任务图"
    allow="clipboard-read; clipboard-write"></iframe>
  <div id="taskTreeNotice">
    <h3>任务图界面没能嵌进来</h3>
    <p id="taskTreeReason"></p>
    <p>可以让我「看一眼任务图」拿一张静态图，或者用 <code>task_tree_server open</code> 在桌面上打开完整界面。</p>
  </div>

  <script type="module">
    const frame = document.getElementById("taskTreeFrame");
    const notice = document.getElementById("taskTreeNotice");
    const reason = document.getElementById("taskTreeReason");
    const bridge = window.openai;
    let ready = false;

    // The page inside says hello once it has painted. Nothing else proves the frame really loaded:
    // a blocked subframe and a dead port both look like a silent, empty box from out here.
    window.addEventListener("message", (event) => {
      if (event.data?.type !== "task-tree-embed-ready") return;
      ready = true;
      notice.classList.remove("is-shown");
    });

    const fail = (text) => {
      if (ready) return;
      reason.textContent = text;
      notice.classList.add("is-shown");
    };

    // A cached widget can outlive the port it was built against, so before giving up, ask the
    // server where it lives now and try that.
    const retryWithLivePort = async () => {
      if (ready || !bridge?.callTool) {
        fail("嵌入的页面没有响应：本地任务图服务可能没在跑，或者宿主拦掉了子页面。");
        return;
      }
      try {
        const result = await bridge.callTool("task_tree_server", { action: "start" });
        const blocks = result?.content || [];
        const text = blocks.map((block) => block?.text || "").join("");
        const url = JSON.parse(text).url;
        if (!url) throw new Error("服务没有返回地址");
        frame.src = url + "/?embed=1";
        setTimeout(() => fail("换成当前端口后仍然没加载出来，多半是宿主不允许嵌入本地页面。"), 6000);
      } catch (error) {
        fail("拉起本地任务图服务失败：" + (error?.message || error));
      }
    };

    setTimeout(retryWithLivePort, 6000);

    document.getElementById("taskTreeBar").addEventListener("click", (event) => {
      const action = event.target?.dataset?.action;
      if (action === "reload") {
        ready = false;
        notice.classList.remove("is-shown");
        frame.src = frame.src;
        setTimeout(retryWithLivePort, 6000);
      }
      if (action === "fullscreen") {
        bridge?.requestDisplayMode?.({ mode: "fullscreen" });
      }
    });
  </script>
</div>`;
}
