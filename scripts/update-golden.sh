#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GOLDEN_DIR="$ROOT_DIR/tests/golden"

strip_ansi() {
  perl -pe 's/\e\[[0-9;]*[a-zA-Z]//g'
}

mkdir -p "$GOLDEN_DIR"

update_golden() {
  local name="$1"
  local golden_file="$2"
  shift 2
  local cmd=("$@")

  echo "Updating: $name -> $golden_file"
  "${cmd[@]}" 2>&1 | strip_ansi > "$golden_file"
}

update_golden \
  "cli-help" \
  "$GOLDEN_DIR/cli-help.txt" \
  bun run "$ROOT_DIR/bin/chop.ts" --help

update_golden \
  "cli-abi-encode" \
  "$GOLDEN_DIR/cli-abi-encode.txt" \
  bun run "$ROOT_DIR/bin/chop.ts" abi-encode "transfer(address,uint256)" 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000

echo ""
echo "Golden files updated."
