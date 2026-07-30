# llm-task-tree

把项目的任务图（`task-tree.md`）变成 Agent 可以直接调用的工具：读焦点、按字段写树、链式推进一步、检查执行流程漂移、检索本地知识库、自动整理画布。

任务图是人与 Agent 共享的外置记忆：节点保存**当前有效结论**（不是历史日志），`GraphState` 指定焦点，`scripts/project.json` 定义执行顺序。协议不再靠模型自觉遵守，而是变成 14 个 `task_tree_*` 工具——写树自动备份到 `versions/`、自动过精炼门禁、自动同步流程状态，并且**改不动**焦点。

需要 Node.js 20.11+ 和 Windows PowerShell（运行时跨平台，安装脚本目前是 PowerShell）。

## 装到一个项目

```powershell
powershell -File kit\deploy-task-tree.ps1 -ProjectRoot <你的项目路径> -UseSharedKit
```

会在该项目写入：`task-tree.md`（起始树）、`AGENTS.md`（任务图协议 + 工具优先规则）、`scripts/`（执行流程）、`.cursor/rules/*.mdc`、`.cursor/mcp.json`、`llm-task-tree/` stub。

打开界面：项目里的 `llm-task-tree\open-task-tree.cmd`。

## 让 Agent 用上工具

**Cursor**：安装已经写好 `.cursor/mcp.json`，入口是 `${workspaceFolder}/llm-task-tree/mcp-server.mjs`，不含绝对路径，可以直接提交进你的仓库——队友克隆后同样可用。重启 Cursor 生效。

**Codex**：

```bash
codex plugin marketplace add guess-guess-who-i-am/tree
node kit/scripts/install-codex-mcp.mjs --with-plugin
```

第二条命令往 `~/.codex/config.toml` 追加 `[mcp_servers.task_tree]`，写前备份，重复执行是空操作，`--remove` 整块撤销。注册的入口是共享 kit，所以一台机器注册一次，所有装了 stub 的项目都能用。

## 14 个工具

| 类别 | 工具 |
|---|---|
| 只读 | `task_tree_focus`、`task_tree_node`、`task_tree_check_compact`、`task_tree_flow_status`、`task_tree_versions`、`task_tree_knowledge`、`task_tree_models`、`task_tree_skills` |
| 写入 | `task_tree_write`、`task_tree_chain`、`task_tree_subtree`、`task_tree_flow_write`、`task_tree_layout` |
| 服务 | `task_tree_server`（按需无界面拉起 / 停止 / `open` 弹界面） |

Agent 看不见界面：`task_tree_server open` 只是在用户桌面弹窗，模型读不到画面。

## 目录

```
kit/                              运行时：server.js、server/、public/、scripts/、模板、安装脚本
marketplace/plugins/task-tree/    插件包（Codex + Cursor 两份清单，共用 SKILL.md）
.agents/plugins/marketplace.json  Codex 市场清单（仓库根，供 marketplace add 解析）
docs/share-with-others.zh.md      三条分发路径说明
```

## 许可

MIT
