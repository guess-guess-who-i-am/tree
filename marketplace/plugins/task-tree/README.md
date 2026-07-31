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

### Codex（ChatGPT 桌面应用，不需要 CLI）

桌面应用、IDE 扩展和 CLI 读的是同一个 `~/.codex/config.toml`，所以装 kit 的时候就顺带注册好了：

```powershell
powershell -File kit\deploy-task-tree.ps1 -ProjectRoot <你的项目路径> -UseSharedKit
```

安装完**重启 ChatGPT 桌面应用**。只想注册不装项目的话，单独跑注册器也行：

```bash
node <kit>/scripts/install-codex-mcp.mjs --with-plugin
```

注册器往 `config.toml` 追加 `[mcp_servers.task_tree]`、`[marketplaces.llm-task-tree]` 和 `[plugins."task-tree@llm-task-tree"]`，写前备份，重复执行是空操作，`--remove` 整块撤销。入口指向共享 kit 而不是某一个仓库，所以一台机器注册一次，所有装了 stub 的项目都生效——每个会话按自己的 cwd 找项目根。

装了 CLI 的话，`codex plugin marketplace add guess-guess-who-i-am/tree` 是另一条等价的取插件路径，但不是必需的。

## 在桌面应用里怎么用

插件目录只在 **ChatGPT 桌面应用**里有（Codex 模式，或 ChatGPT 模式打开 Work 开关）：**Plugins → 选来源「任务图（llm-task-tree）」→ task-tree**。装上之后新开一个会话，输入框的 `+` 里能看到它的图标，四条一键提示词（读焦点 / 写结论 / 推进一步 / 查知识库）点了就跑。

IDE 扩展（VS Code、Cursor 里的 Codex）**没有插件面板**——这是官方限制，不是配置问题。但 `[mcp_servers.task_tree]` 是全局的，所以在 IDE 扩展里 14 个工具照样能调，只是不出现在"插件列表"这个界面里。

## 改了插件之后怎么刷新

1. 改 `marketplace/plugins/task-tree/`（清单、技能、图标）。
2. **提升 `.codex-plugin/plugin.json` 的 `version`**——桌面应用按 `~/.codex/plugins/cache/<市场>/<插件>/<版本>/` 装，版本不变就还是旧目录。
3. 重建 kit（`scripts/build-kit.ps1`），因为 `config.toml` 注册的是 kit 里那份。
4. 重启 ChatGPT 桌面应用。

`codex plugin marketplace upgrade` 对这里没用——它只认 Git 市场，本地市场会直接报错。校验清单是否还合规：

```bash
node scripts/build-plugin-assets.mjs        # 重新生成 360/512 图标，纯 Node，不依赖浏览器
node scripts/test-plugin-manifest.mjs       # 清单字段、资源尺寸、市场 policy 全量校验
```

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
