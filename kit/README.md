# llm-task-tree

把项目的任务图（`task-tree.md`）变成 Agent 可直接调用的工具：读焦点、按字段写树、链式推进、检索知识库、自动排版。

## 别人怎么装

### 1. 拿到本仓库（kit）

```bash
git clone https://github.com/guess-guess-who-i-am/tree.git
```

装了 codex CLI 的话，`codex plugin marketplace add guess-guess-who-i-am/tree` 是等价的取法，但不是必需的。

### 2. 部署到你的项目

```powershell
powershell -File .\deploy-task-tree.ps1 -ProjectRoot <你的项目路径> -UseSharedKit
```

会写入：`task-tree.md`、`AGENTS.md`、`.cursor/mcp.json`、`.cursor/rules/`、`llm-task-tree/` stub，并在这台机器上注册 Codex（`~/.codex/config.toml`）。

### 3. 重启客户端

- **Codex 桌面端**：重启后插件出现在插件列表，14 个工具可用。桌面端和 CLI 读同一份配置，所以不需要敲任何 codex 命令。
- **Cursor**：提交仓库里的 `.cursor/mcp.json`（已用 `${workspaceFolder}`，可直接分享），重启生效。

只想注册 Codex、不装项目：`node .\scripts\install-codex-mcp.mjs --with-plugin`（可重复执行，`--remove` 撤销）。

## 需要

- Node.js 20.11+
- Windows（当前启动器与安装脚本以 PowerShell 为主）

## 文档

- 分发说明：仓库根旁的研究仓库里有 `docs/share-with-others.zh.md`；插件用法见 `marketplace/plugins/task-tree/README.md` 与 `marketplace/plugins/task-tree/skills/task-tree/SKILL.md`
- 完整协议：`AGENTS.task-tree.md`

## License

MIT
