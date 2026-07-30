#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUB_DIR="${1:-$(dirname "$KIT_DIR")/llm-task-tree}"
PROJECT_ROOT="$(cd "$(dirname "$STUB_DIR")" && pwd)"

if [[ -f "$STUB_DIR/task-tree.config.json" ]]; then
  ROOT_RAW="$(node -e "
    const c=require(process.argv[1]);
    const p=c.projectRoot||'..';
    if(p==='.'||p==='') process.stdout.write(process.argv[2]);
    else if(p.startsWith('/')) process.stdout.write(p);
    else process.stdout.write(require('path').resolve(process.argv[2], p));
  " "$STUB_DIR/task-tree.config.json" "$STUB_DIR")"
  PROJECT_ROOT="$(cd "$ROOT_RAW" && pwd)"
fi

step() { echo ">> $*"; }

step "Kit: $KIT_DIR"
step "Stub: $STUB_DIR"
step "Project root: $PROJECT_ROOT"

mkdir -p "$STUB_DIR"
mkdir -p "$PROJECT_ROOT/versions" "$PROJECT_ROOT/knowledge" "$PROJECT_ROOT/scripts"

if [[ ! -f "$STUB_DIR/task-tree.config.json" ]]; then
  printf '%s\n' '{"projectRoot":".."}' > "$STUB_DIR/task-tree.config.json"
  step "Created llm-task-tree/task-tree.config.json"
fi

TREE_FILE="$PROJECT_ROOT/task-tree.md"
if [[ ! -f "$TREE_FILE" ]]; then
  cp "$KIT_DIR/templates/task-tree.starter.md" "$TREE_FILE"
  step "Created task-tree.md from starter template"
else
  step "task-tree.md already exists — kept as-is"
fi

AGENTS_FILE="$PROJECT_ROOT/AGENTS.md"
MERGE_BLOCK="$KIT_DIR/templates/AGENTS.merge.md"
if [[ -f "$MERGE_BLOCK" ]]; then
  BEGIN='<!-- llm-task-tree:begin -->'
  END='<!-- llm-task-tree:end -->'
  BLOCK="$(cat "$MERGE_BLOCK")"
  if [[ -f "$AGENTS_FILE" ]] && grep -qF "$BEGIN" "$AGENTS_FILE"; then
    step "AGENTS.md already has llm-task-tree block — please update manually if needed"
  elif [[ -f "$AGENTS_FILE" ]]; then
    printf '\n%s\n%s\n%s\n' "$BEGIN" "$BLOCK" "$END" >> "$AGENTS_FILE"
    step "Appended llm-task-tree block to AGENTS.md"
  else
    cat > "$AGENTS_FILE" <<EOF
# Agent Instructions

See \`llm-task-tree/AGENTS.task-tree.md\` for the full task graph protocol.

$BEGIN
$BLOCK
$END
EOF
    step "Created AGENTS.md"
  fi
fi

cp -f "$KIT_DIR/AGENTS.task-tree.md" "$STUB_DIR/AGENTS.task-tree.md" 2>/dev/null || true
mkdir -p "$STUB_DIR/skills"
cp -rf "$KIT_DIR/skills/"* "$STUB_DIR/skills/" 2>/dev/null || true

ENV_TARGET="$PROJECT_ROOT/.env"
if [[ ! -f "$ENV_TARGET" && -f "$KIT_DIR/templates/.env.example" ]]; then
  cp "$KIT_DIR/templates/.env.example" "$ENV_TARGET"
  step "Copied .env.example -> .env"
fi

step "Running npm install in kit..."
(cd "$KIT_DIR" && npm install)

cat <<EOF

Done.

  Start:  $KIT_DIR/start-task-tree.sh
  Open:   http://127.0.0.1:\${PORT:-5177}
  Rules:  $STUB_DIR/AGENTS.task-tree.md

EOF
