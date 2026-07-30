import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const TREE_FIELD_BUDGETS = Object.freeze({
  Problem: 140,
  Approach: 450,
  Input: 700,
  Output: 700,
  Metrics: 300,
  Notes: 450,
  CurrentResult: 500,
  RootCauseAnalysis: 350,
  CaseStudy: 400,
  NextIdea: 160
});

const NODE_FIELD_RE = /^-\s+(Position|Size|Completion|Problem|Approach|Input|Output|Metrics|Notes|CodeLoc|CurrentResult|RootCauseAnalysis|CaseStudy|NextIdea|SelectedSkills|Folded|SubtreeFile|SubtreeCount|ReadStatus|ReadFingerprint):\s*(.*)$/;

function normalized(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function visibleLength(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

export function parseTreeNodeFields(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const nodes = [];
  let section = "meta";
  let node = null;
  let field = "";

  const flushNode = () => {
    if (node) nodes.push(node);
    node = null;
    field = "";
  };

  for (const line of lines) {
    if (/^# GraphState\b/.test(line)) {
      flushNode();
      section = "graphState";
      continue;
    }
    if (/^# Edges\b/.test(line)) {
      flushNode();
      section = "edges";
      continue;
    }
    const heading = line.match(/^##\s+(\S+)\s+-\s+(.+)$/);
    if (heading && section !== "edges") {
      flushNode();
      section = "nodes";
      node = { id: heading[1], title: heading[2].trim(), fields: {} };
      continue;
    }
    if (section !== "nodes" || !node) continue;

    const fieldMatch = line.match(NODE_FIELD_RE);
    if (fieldMatch) {
      field = fieldMatch[1];
      node.fields[field] = fieldMatch[2] || "";
      continue;
    }
    if (field) node.fields[field] = `${node.fields[field] || ""}\n${line}`;
  }
  flushNode();
  return nodes;
}

export function inspectTreeMarkdown(markdown, { file = "task-tree.md" } = {}) {
  const text = String(markdown || "");
  const nodes = parseTreeNodeFields(text);
  const violations = [];
  for (const node of nodes) {
    for (const [field, budget] of Object.entries(TREE_FIELD_BUDGETS)) {
      const chars = visibleLength(node.fields[field]);
      if (chars > budget) {
        violations.push({
          file: normalized(file),
          nodeId: node.id,
          field,
          chars,
          budget,
          excess: chars - budget
        });
      }
    }
  }
  const longLines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, chars: line.length }))
    .filter((item) => item.chars > 240);
  return {
    file: normalized(file),
    bytes: Buffer.byteLength(text, "utf8"),
    lines: text.split(/\r?\n/).length,
    nodes: nodes.length,
    violations,
    longLines
  };
}

export function isTreeMarkdownPath(file) {
  const rel = normalized(file);
  return rel === "task-tree.md"
    || /^trees\/.+\.md$/i.test(rel)
    || /^subtrees\/.+\.md$/i.test(rel);
}

export async function inspectTreeFile(projectRoot, file) {
  const rel = normalized(file);
  const fullPath = path.resolve(projectRoot, rel);
  if (!existsSync(fullPath)) return null;
  return inspectTreeMarkdown(await readFile(fullPath, "utf8"), { file: rel });
}

export function compactViolationSummary(reports, { limit = 12 } = {}) {
  const violations = reports.flatMap((report) => report?.violations || []);
  const shown = violations
    .sort((a, b) => b.excess - a.excess)
    .slice(0, limit)
    .map((item) => `${item.file}:${item.nodeId}.${item.field} ${item.chars}>${item.budget}`);
  const rest = Math.max(0, violations.length - shown.length);
  return `${shown.join("；")}${rest ? `；另有 ${rest} 项` : ""}`;
}
