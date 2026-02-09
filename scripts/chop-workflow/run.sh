#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

# Force CLI agents (not API agents)
unset ANTHROPIC_API_KEY

# Show engine errors
export SMITHERS_DEBUG=1

echo "Starting Chop build workflow"
echo "Root directory: $ROOT_DIR"
echo "Press Ctrl+C to stop."
echo ""

bun run ../../smithers/src/cli/index.ts run workflow.tsx \
  --input '{"projectDir": "'"$ROOT_DIR"'"}' \
  --root-dir "$ROOT_DIR"
