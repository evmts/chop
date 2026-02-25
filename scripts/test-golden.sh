#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GOLDEN_DIR="$ROOT_DIR/tests/golden"

strip_ansi() {
  perl -pe 's/\e\[[0-9;]*[a-zA-Z]//g'
}

PASS=0
FAIL=0
FAILURES=()

run_golden_test() {
  local name="$1"
  local golden_file="$2"
  shift 2
  local cmd=("$@")

  local actual
  actual=$("${cmd[@]}" 2>&1 | strip_ansi)

  local expected
  expected=$(cat "$golden_file")

  if diff <(echo "$actual") <(echo "$expected") > /dev/null 2>&1; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "  diff:"
    diff <(echo "$actual") <(echo "$expected") | head -20 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
    FAILURES+=("$name")
  fi
}

echo "Running golden tests..."
echo ""

run_golden_test \
  "cli-help" \
  "$GOLDEN_DIR/cli-help.txt" \
  bun run "$ROOT_DIR/bin/chop.ts" --help

run_golden_test \
  "cli-abi-encode" \
  "$GOLDEN_DIR/cli-abi-encode.txt" \
  bun run "$ROOT_DIR/bin/chop.ts" abi-encode "transfer(address,uint256)" 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000

echo ""
echo "---"
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  echo "Failed tests:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

exit 0
