/**
 * What the task graph's Codex button actually sends.
 *
 * The prompts are built from the live tree instead of being typed by the user, because the two
 * things that make a turn useful — which node is Next and what its NextIdea says — are exactly the
 * things that go stale in a hand-written prompt. Keeping them pure keeps them testable: the server
 * reads the tree, these functions decide the wording.
 */

/** Asks the model for the widget and nothing else, so the turn stays as small as it can be. */
export const OPEN_GRAPH_PROMPT = "调用 task_tree_open 打开任务图。只做这一件事，不要解释，不要调用其它工具。";

export const PRESETS = ["open", "next", "chain"];

/**
 * One step on the Next node. Repeats the two rules that are easy to break from a fresh context:
 * NextPlan is the user's memo and must not be executed, and focus is the user's to move.
 */
export function buildNextStepPrompt({ nodeId, title, nextIdea } = {}) {
  const idea = (nextIdea || "").trim();
  if (!nodeId) return { prompt: "", blocked: "任务图里没有 Next 节点，先在界面上把 Next 指到一个节点。" };
  if (!idea) return { prompt: "", blocked: `Next 节点 ${nodeId} 没写 NextIdea（下一步思路），没有可执行的依据。` };

  return {
    prompt: [
      "【任务图 · 执行下一步】",
      `Next: ${nodeId}${title ? ` - ${title}` : ""}`,
      `NextIdea: ${idea}`,
      "",
      "本轮只做这一步。执行依据就是上面这条 NextIdea，不要去读 GraphState.NextPlan（那是用户备忘，可能过期）。",
      "不要改 GraphState 的 Current / Next / NextPlan。",
      `做完用 task_tree_write 把测得的结果写进 ${nodeId} 的 CurrentResult，并告诉我改了哪个节点。`
    ].join("\n"),
    blocked: ""
  };
}

/**
 * One step of the chain loop. The server already computes the loop's own prompt and its stop
 * condition, so this only decides whether sending is honest: a chain that should stop gets the
 * reason handed back instead of a turn that would spin on nothing.
 */
export function buildChainPrompt({ agentPrompt, shouldStopLoop, stopReason } = {}) {
  if (shouldStopLoop) return { prompt: "", blocked: `链式循环现在该停：${stopReason || "未说明原因"}。` };
  const body = (agentPrompt || "").trim();
  if (!body) return { prompt: "", blocked: "拿不到链式单步的上下文。" };
  return { prompt: `【任务图 · 链式循环】\n${body}`, blocked: "" };
}

/**
 * @param {"open"|"next"|"chain"} preset
 * @param {{focus?: object, chain?: object}} live state read from the tree
 */
export function buildPresetPrompt(preset, { focus = {}, chain = {} } = {}) {
  if (preset === "next") {
    return buildNextStepPrompt({ nodeId: focus.nodeId, title: focus.title, nextIdea: focus.nextIdea });
  }
  if (preset === "chain") {
    return buildChainPrompt(chain);
  }
  return { prompt: OPEN_GRAPH_PROMPT, blocked: "" };
}

/** Menu entries, with the reason a disabled one is disabled, so the UI never guesses. */
export function describePresets({ focus = {}, chain = {} } = {}) {
  const next = buildNextStepPrompt({ nodeId: focus.nodeId, title: focus.title, nextIdea: focus.nextIdea });
  const loop = buildChainPrompt(chain);
  return [
    { id: "open", label: "打开任务图", hint: "只把可交互界面放进对话，不动树", blocked: "" },
    {
      id: "next",
      label: focus.nodeId ? `执行下一步：${focus.nodeId}` : "执行下一步",
      hint: focus.title || "",
      blocked: next.blocked
    },
    { id: "chain", label: "链式循环推进一步", hint: chain.position || "", blocked: loop.blocked }
  ];
}
