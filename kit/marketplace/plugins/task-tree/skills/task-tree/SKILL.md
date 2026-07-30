---
name: task-tree
description: 用 task_tree_* 工具读写项目任务图：读焦点、按字段写树（自动备份+精炼门禁）、链式推进一步、检索本地知识库、多模型协作、自动整理画布。当用户提到任务图/任务树/节点/焦点/下一步/链式/自动整理时使用。
---

# 任务图（task-tree）

任务图是人和 Agent 共享的外置记忆，不是文档：

- `task-tree.md` 的每个节点保存**当前有效结论**（Problem / Approach / Input / Output / Metrics / CurrentResult / RootCauseAnalysis / NextIdea…），历史进 `versions/`。
- `# GraphState` 指定焦点：`Current` 是刚做完的，`Next` 是接下来要做的。**执行依据只有 `Next` 节点的 `NextIdea`**；`NextPlan` 是用户备忘，可能过期，禁止执行。
- 执行顺序看 `scripts/project.json`，不要用节点 ID 或画布位置推断。

## 每轮怎么走

1. `task_tree_focus` —— 先读焦点，别凭记忆猜当前任务。
2. `task_tree_node {nodeId}` —— 读该节点全部字段（会自动在 `subtrees/`、`trees/` 里找）。
3. 干活。需要证据就 `task_tree_knowledge`（本地 Markdown 知识库 / 联网）或 `task_tree_models`（多模型并行回答）。
4. `task_tree_write {nodeId, fields, reason}` —— 把结论写回节点。**不要手改 markdown**：这个工具会自动备份到 `versions/`、跑精炼门禁、同步流程状态，并且写不动 GraphState 焦点（焦点归用户）。
5. `task_tree_check_compact` —— 写完自查；`ok=false` 就继续语义精炼（保留结论/数字/风险，别机械截断）。
6. 结构或顺序变了：`task_tree_flow_write {action:"sync_status"}`；漂移详情用 `task_tree_flow_status`。

## 工具清单

只读：

- `task_tree_focus`：活动树、`Current`/`Next`、Next 节点的 `NextIdea` 与完成度。
- `task_tree_node`：按 ID 读节点全字段。
- `task_tree_check_compact`：字段预算 + 长行门禁。
- `task_tree_flow_status`：`scripts/project.json` 的块顺序、状态与漂移。

写入（都走本地服务，自动备份）：

- `task_tree_write`：改节点字段，或整树覆盖。`reason` 必填。
- `task_tree_chain`：`step` 取当前该做的一步；`advance` 沿 `Chain` 推进一步；`force_next` 强制下一节点。**每轮只推进一步。**
- `task_tree_subtree`：`read` / `context` / `write` / `sync_stub` / `unfold`。折叠一个节点 = 先 `write` 子树文件，再 `sync_stub` 把摘要同步回主树。
- `task_tree_layout`：用界面同一份轮廓算法重排 `Position`（`dryRun` 只算不写）。写完提醒用户刷新界面。
- `task_tree_versions`：`list` / `restore` 版本回退。
- `task_tree_flow_write`：`sync_status` / `rebuild` / `write_step` / `drift`。

辅助：

- `task_tree_knowledge`：`search` / `ask` / `web` / `status` / `reindex`。
- `task_tree_models`：`list` / `health` / `run`（节点级多模型协作）。
- `task_tree_skills`：按节点意图推荐本地 skill（只给候选，不写回 `SelectedSkills`）。
- `task_tree_server`：`status` / `start` / `open` / `stop`。需要服务的工具会自动拉起，一般不用手动调；`open` 会在**用户桌面**打开界面——模型看不到画面，数据请用上面的工具读。

## 边界

- 焦点（`Current` / `Next` / `NextPlan`）只由用户在界面里定；Agent 写树不会改动它。
- 界面是给人看的，模型不能"看"网页：需要什么信息就调对应工具，不要试图截图或解析页面。
- 门禁不过就不能收工：字段超预算说明这一轮的表述还不够收敛。
