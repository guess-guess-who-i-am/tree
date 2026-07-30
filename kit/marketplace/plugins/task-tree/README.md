# 任务图（task-tree）

把项目里的 `task-tree.md` 变成 Agent 可以直接调用的工具：读焦点、按字段写树、链式推进一步、跑执行流程漂移检查、检索本地知识库、自动整理画布。

不是"再教模型一遍协议"，而是让协议变成 14 个 `task_tree_*` 工具：写树自动备份到 `versions/`、自动过精炼门禁、自动同步 `scripts/project.json` 的流程状态，并且**改不动** `GraphState` 的 `Current / Next / NextPlan`——焦点永远是人来定。

## 前置条件

插件本身只带技能文档和 MCP 定义，真正干活的运行时是 **llm-task-tree kit**。目标项目里必须已经有 kit stub：

```
<项目>/llm-task-tree/mcp-server.mjs      # 转发到共享 kit
<项目>/llm-task-tree/task-tree.config.json
<项目>/task-tree.md
```

没有的话，先在项目根目录跑一次 kit 的部署：

```powershell
powershell -File <kit>\deploy-task-tree.ps1 -ProjectRoot <项目路径> -UseSharedKit
```

需要 Node.js 20.11 以上。

## 安装

### Codex（桌面端，不需要 CLI）

桌面端和 CLI 读的是同一个 `~/.codex/config.toml`，所以装 kit 的时候就顺带注册好了：

```powershell
powershell -File kit\deploy-task-tree.ps1 -ProjectRoot <你的项目路径> -UseSharedKit
```

安装完**重启 Codex 桌面端**，插件就出现在插件列表里，14 个工具可用。只想注册不装项目的话，单独跑注册器也行：

```bash
node <kit>/scripts/install-codex-mcp.mjs --with-plugin
```

注册器往 `config.toml` 追加 `[mcp_servers.task_tree]`、`[marketplaces.llm-task-tree]` 和 `[plugins."task-tree@llm-task-tree"]`，写前备份，重复执行是空操作，`--remove` 整块撤销。入口指向共享 kit 而不是某一个仓库，所以一台机器注册一次，所有装了 stub 的项目都生效——每个会话按自己的 cwd 找项目根。

装了 CLI 的话，`codex plugin marketplace add guess-guess-who-i-am/tree` 是另一条等价的取插件路径，但不是必需的。

### Cursor

两条路，任选：

- **随仓库分发**：项目里提交 `.cursor/mcp.json`（kit 安装时自动写好，用的是 `${workspaceFolder}`，不含任何本机绝对路径）。别人克隆仓库、信任工作区即可使用。
- **装成插件**：把本目录拷到 `~/.cursor/plugins/local/task-tree/`，然后 Developer: Reload Window。

## 14 个工具

| 类别 | 工具 |
|---|---|
| 只读 | `task_tree_focus`、`task_tree_node`、`task_tree_check_compact`、`task_tree_flow_status`、`task_tree_versions`、`task_tree_knowledge`、`task_tree_models`、`task_tree_skills` |
| 写入 | `task_tree_write`、`task_tree_chain`、`task_tree_subtree`、`task_tree_flow_write`、`task_tree_layout` |
| 服务 | `task_tree_server`（按需无界面拉起 / 停止 / `open` 弹界面） |

详细用法见 `skills/task-tree/SKILL.md`——Agent 会自己读。

## 边界

- Agent 看不见界面。`task_tree_server open` 只是在用户桌面弹出窗口，模型读不到画面内容。
- 写树必须给 `reason`，会写进 `versions/` 的备份文件名。
- 精炼门禁不过就拒绝写入，文件零字节改动。
