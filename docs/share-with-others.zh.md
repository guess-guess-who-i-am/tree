# 把任务图分发给别人

三条路径，按"对方要做多少事"从少到多排列。全部经 `node scripts/test-share-install.mjs` 端到端验证（临时项目 + 临时 `CODEX_HOME`，不碰真实配置）。

## 前提：别人拿到的是什么

真正干活的运行时是 **kit**（`llm-task-tree-kit/`：`server.js`、`server/`、`public/`、`scripts/mcp-server.mjs`）。插件只带技能文档和 MCP 定义，不含运行时。

所以对方的最小动作永远是两步：拿到 kit → 在自己项目里部署一次 stub。

```powershell
powershell -File <kit>\deploy-task-tree.ps1 -ProjectRoot <项目路径> -UseSharedKit
```

这一步会写好：`task-tree.md`、`AGENTS.md`（含任务图协议块 + MCP 工具优先规则）、`scripts/`、`.cursor/rules/*.mdc`、`.cursor/mcp.json`、`llm-task-tree/` stub（含 `mcp-server.mjs`）。

## 路径 1：Cursor —— 随仓库分发，对方零配置

`.cursor/mcp.json` 用 `${workspaceFolder}` 写死相对入口，不含任何本机绝对路径，可以直接提交进仓库：

```json
{
  "mcpServers": {
    "task_tree": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/llm-task-tree/mcp-server.mjs"]
    }
  }
}
```

对方克隆仓库、信任工作区，重启 Cursor 即可用上 14 个工具。前提是仓库里带着 `llm-task-tree/` stub 和一份可达的 kit。

## 路径 2：Codex 桌面端 —— 装 kit 时自动注册（不需要 CLI）

桌面端（VS Code / Cursor 里的 Codex 扩展、Codex app）和 CLI 读的是同一个 `~/.codex/config.toml`，插件与 MCP 都由这份配置驱动。所以对方只要克隆仓库、跑一次部署：

```powershell
powershell -File kit\deploy-task-tree.ps1 -ProjectRoot <项目路径> -UseSharedKit
```

安装末尾会调 `Ensure-CodexRegistration`，往 `config.toml` 写三个块：`[mcp_servers.task_tree]`、`[marketplaces.llm-task-tree]`、`[plugins."task-tree@llm-task-tree"]`。**重启 Codex 桌面端**后，桌面端会自己把插件物化到 `~/.codex/plugins/cache/llm-task-tree/task-tree/<版本>/`，插件列表里就能看到，14 个工具可用。

只想注册不装项目：`node <kit>/scripts/install-codex-mcp.mjs --with-plugin`。

注册的是**共享 kit** 的入口而不是某个仓库路径，所以一台机器注册一次，所有装了 stub 的项目都能用；每个会话按自己的 cwd 定位项目根。写入前自动备份 `config.toml`，重复执行是空操作，`--remove` 整块撤销；机器上没有 `~/.codex` 时安装脚本直接跳过，不会凭空造配置。

装了 codex CLI 的人还可以 `codex plugin marketplace add guess-guess-who-i-am/tree` 从 Git 市场取插件（仓库根的 `.agents/plugins/marketplace.json` 指向 `./marketplace/plugins/task-tree`）。Git 快照登记由该命令自己管理，安装脚本只写已验证的本地市场形态（`source_type = "local"`），不伪造 Git 字段。

## 路径 3：本地市场 / 本地插件（不发布也能用）

- Codex：`node <kit>/scripts/install-codex-mcp.mjs --with-plugin` 会把 kit 里的 `marketplace/` 注册成 `[marketplaces.llm-task-tree]`，插件即刻可见。
- Cursor：把 `marketplace/plugins/task-tree/` 拷到 `~/.cursor/plugins/local/task-tree/`，Developer: Reload Window。

## 官方市场收录

- **Codex**：本地/Git 市场已经等价于"能装"，进 OpenAI 官方目录是另一套流程。
- **Cursor**：官方市场是策展制——必须公开开源仓库 + 人工审核，提交不等于收录。团队版可以用 Team Marketplace 从仓库导入，绕开审核。

## 一个包，两个宿主

`marketplace/plugins/task-tree/` 同时是 Codex 插件和 Cursor 插件：

```
.codex-plugin/plugin.json   # Codex 清单
.cursor-plugin/plugin.json  # Cursor 清单
mcp.json                    # Cursor 自动发现的 MCP 定义
skills/task-tree/SKILL.md   # 两边共用的技能文档
README.md
```

## 验证

```bash
node scripts/test-share-install.mjs   # 8 例：装到陌生项目、注册到空白 CODEX_HOME、跑通 14 个工具
node scripts/test-mcp-server.mjs      # 22 例：工具行为回归
```
