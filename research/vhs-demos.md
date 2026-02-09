# VHS Demo Tape Files for Chop

Chop-specific VHS tape files for generating demo GIFs/videos of CLI commands and TUI interaction, plus CI integration and golden file testing patterns.

---

## Table of Contents

1. [VHS Quick Reference](#1-vhs-quick-reference)
2. [Chop Theme Settings](#2-chop-theme-settings)
3. [CLI Demo Tapes](#3-cli-demo-tapes)
4. [TUI Demo Tapes](#4-tui-demo-tapes)
5. [CI Integration](#5-ci-integration)
6. [Golden File Testing](#6-golden-file-testing)
7. [Advanced Patterns](#7-advanced-patterns)

---

## 1. VHS Quick Reference

VHS uses `.tape` files with a simple DSL to script terminal sessions and render them as GIF/MP4/WebM/PNG.

```bash
# Install VHS
brew install charmbracelet/tap/vhs

# Run a tape file
vhs demo.tape

# Run with output override
vhs demo.tape -o custom-output.gif
```

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `Output` | Set output file | `Output demo.gif` |
| `Set` | Configure terminal settings | `Set FontSize 14` |
| `Type` | Type text (with realistic delay) | `Type "chop to-hex 255"` |
| `Enter` | Press enter key | `Enter` |
| `Sleep` | Wait for duration | `Sleep 1s` |
| `Up`/`Down`/`Left`/`Right` | Arrow keys | `Down 3` |
| `Tab` | Tab key | `Tab` |
| `Ctrl+` | Control key combos | `Ctrl+C` |
| `Escape` | Escape key | `Escape` |
| `Hide`/`Show` | Hide/show typing | `Hide` |
| `Screenshot` | Capture current frame | `Screenshot screenshot.png` |
| `Require` | Require binary to exist | `Require chop` |
| `Source` | Source another tape file | `Source theme.tape` |

---

## 2. Chop Theme Settings

Dracula-inspired theme matching chop's TUI color palette.

### theme.tape (Reusable Settings)

```tape
# Chop Dracula Theme -- Source this in all demo tapes
# Usage: Source theme.tape

Set Shell "bash"
Set FontFamily "JetBrains Mono"
Set FontSize 14
Set LineHeight 1.2
Set LetterSpacing 0
Set Padding 20
Set Margin 10
Set MarginFill "#282A36"
Set BorderRadius 8
Set WindowBar "Colorful"
Set WindowBarSize 40
Set CursorBlink false

# Dracula palette
Set Theme {
  "name": "Chop Dracula",
  "black": "#21222C",
  "red": "#FF5555",
  "green": "#50FA7B",
  "yellow": "#F1FA8C",
  "blue": "#BD93F9",
  "magenta": "#FF79C6",
  "cyan": "#8BE9FD",
  "white": "#F8F8F2",
  "brightBlack": "#6272A4",
  "brightRed": "#FF6E6E",
  "brightGreen": "#69FF94",
  "brightYellow": "#FFFFA5",
  "brightBlue": "#D6ACFF",
  "brightMagenta": "#FF92DF",
  "brightCyan": "#A4FFFF",
  "brightWhite": "#FFFFFF",
  "background": "#282A36",
  "foreground": "#F8F8F2",
  "selection": "#44475A",
  "cursor": "#F8F8F2"
}

Set Width 960
Set Height 540
Set TypingSpeed 50ms
```

---

## 3. CLI Demo Tapes

### 3.1 ABI Encoding Demo

```tape
# demos/cli-abi-encoding.tape
Source theme.tape
Output demos/cli-abi-encoding.gif
Require chop

Set Width 1000
Set Height 400

# Title
Type "# ABI Encoding with Chop"
Enter
Sleep 500ms

# Encode function call
Type "chop calldata 'transfer(address,uint256)' 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000"
Sleep 300ms
Enter
Sleep 2s

# Decode it back
Type "chop calldata-decode 'transfer(address,uint256)' 0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000"
Sleep 300ms
Enter
Sleep 2s

# Get the selector
Type "chop sig 'transfer(address,uint256)'"
Sleep 300ms
Enter
Sleep 2s

# Packed encoding
Type "chop abi-encode --packed 'transfer(address,uint256)' 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000"
Sleep 300ms
Enter
Sleep 2s
```

### 3.2 Data Conversion Demo

```tape
# demos/cli-conversions.tape
Source theme.tape
Output demos/cli-conversions.gif
Require chop

Set Width 800
Set Height 400

Type "# Unit Conversions"
Enter
Sleep 500ms

# Wei to ether
Type "chop from-wei 1000000000000000000"
Enter
Sleep 1.5s

# Ether to wei
Type "chop to-wei 1.5"
Enter
Sleep 1.5s

# Hex conversions
Type "chop to-hex 255"
Enter
Sleep 1s

Type "chop to-dec 0xdeadbeef"
Enter
Sleep 1.5s

# Keccak hash
Type "chop keccak 'transfer(address,uint256)'"
Enter
Sleep 2s

# Function selector
Type "chop sig 'approve(address,uint256)'"
Enter
Sleep 2s
```

### 3.3 Address Utilities Demo

```tape
# demos/cli-address.tape
Source theme.tape
Output demos/cli-address.gif
Require chop

Set Width 900
Set Height 400

Type "# Address Utilities"
Enter
Sleep 500ms

# Checksum
Type "chop to-check-sum-address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
Enter
Sleep 2s

# CREATE address
Type "chop compute-address --deployer 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --nonce 42"
Enter
Sleep 2s

# CREATE2 address
Type "chop create2 --deployer 0x0000000000FFe8B47B3e2130213B802212439497 --salt 0x0000000000000000000000000000000000000000000000000000000000000001 --init-code 0x6080604052"
Enter
Sleep 2s
```

### 3.4 Contract Interaction Demo

```tape
# demos/cli-contract.tape
Source theme.tape
Output demos/cli-contract.gif
Require chop

Set Width 1100
Set Height 500

Type "# Contract Interaction"
Enter
Sleep 500ms

# Read USDC balance
Type "chop call --to 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 'balanceOf(address)(uint256)' 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -r https://eth.llamarpc.com"
Sleep 300ms
Enter
Sleep 3s

# Read storage slot
Type "chop storage 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0 -r https://eth.llamarpc.com"
Enter
Sleep 2s

# Get ETH balance
Type "chop balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -r https://eth.llamarpc.com"
Enter
Sleep 2s

# JSON output
Type "chop balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 -r https://eth.llamarpc.com --json"
Enter
Sleep 2s
```

### 3.5 Bytecode Analysis Demo

```tape
# demos/cli-bytecode.tape
Source theme.tape
Output demos/cli-bytecode.gif
Require chop

Set Width 900
Set Height 500

Type "# Bytecode Analysis"
Enter
Sleep 500ms

# Disassemble simple bytecode
Type "chop disassemble 0x6080604052348015600e575f80fd5b50603580601a5f395ff3fe"
Enter
Sleep 3s

# Look up selector
Type "chop 4byte 0xa9059cbb"
Enter
Sleep 2s

# Look up event topic
Type "chop 4byte-event 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
Enter
Sleep 2s
```

### 3.6 Full CLI Overview Demo

```tape
# demos/cli-overview.tape
Source theme.tape
Output demos/cli-overview.gif
Require chop

Set Width 1000
Set Height 600

# Show help
Type "chop --help"
Enter
Sleep 3s

# Show version
Type "chop --version"
Enter
Sleep 1s

# Quick encoding example
Type "chop sig 'transfer(address,uint256)'"
Enter
Sleep 1.5s

# Quick conversion
Type "chop to-wei 1.5"
Enter
Sleep 1.5s

# Quick hash
Type "chop keccak 'Hello, Ethereum!'"
Enter
Sleep 2s
```

---

## 4. TUI Demo Tapes

### 4.1 TUI Launch and Tab Navigation

```tape
# demos/tui-navigation.tape
Source theme.tape
Output demos/tui-navigation.gif
Require chop

Set Width 1200
Set Height 700
Set TypingSpeed 100ms

# Launch TUI (no arguments)
Type "chop"
Enter
Sleep 2s

# Navigate through tabs
# Tab 1: Dashboard (default)
Sleep 1s
Screenshot demos/tui-dashboard.png

# Tab 2: Call History
Type "2"
Sleep 1s
Screenshot demos/tui-history.png

# Tab 3: Contracts
Type "3"
Sleep 1s
Screenshot demos/tui-contracts.png

# Tab 4: Accounts
Type "4"
Sleep 1s
Screenshot demos/tui-accounts.png

# Tab 5: Blocks
Type "5"
Sleep 1s
Screenshot demos/tui-blocks.png

# Tab 6: Transactions
Type "6"
Sleep 1s
Screenshot demos/tui-transactions.png

# Tab 7: Settings
Type "7"
Sleep 1s
Screenshot demos/tui-settings.png

# Tab 8: State Inspector
Type "8"
Sleep 1s
Screenshot demos/tui-inspector.png

# Back to Dashboard
Type "1"
Sleep 1s

# Quit
Type "q"
Sleep 500ms
```

### 4.2 TUI Call History Detail

```tape
# demos/tui-call-history.tape
Source theme.tape
Output demos/tui-call-history.gif
Require chop

Set Width 1200
Set Height 700
Set TypingSpeed 80ms

Type "chop"
Enter
Sleep 2s

# Switch to Call History
Type "2"
Sleep 1s

# Navigate down through history entries
Down 1
Sleep 500ms
Down 1
Sleep 500ms
Down 1
Sleep 500ms

# Select entry to see details
Enter
Sleep 2s

# Scroll through details
Down 3
Sleep 1s

# Go back
Escape
Sleep 1s

# Quit
Type "q"
```

### 4.3 TUI Contract Inspection

```tape
# demos/tui-contracts.tape
Source theme.tape
Output demos/tui-contracts.gif
Require chop

Set Width 1200
Set Height 700
Set TypingSpeed 80ms

Type "chop"
Enter
Sleep 2s

# Switch to Contracts view
Type "3"
Sleep 1s

# Navigate contracts list
Down 1
Sleep 500ms
Down 1
Sleep 500ms

# Select contract to see bytecode disassembly
Enter
Sleep 2s

# Scroll through disassembly
Down 5
Sleep 1s
Down 5
Sleep 1s

# Go back
Escape
Sleep 1s

# Quit
Type "q"
```

### 4.4 TUI State Inspector

```tape
# demos/tui-state-inspector.tape
Source theme.tape
Output demos/tui-state-inspector.gif
Require chop

Set Width 1200
Set Height 700
Set TypingSpeed 80ms

Type "chop"
Enter
Sleep 2s

# Switch to State Inspector
Type "8"
Sleep 1s

# Navigate state tree
Down 1
Sleep 500ms
Enter
Sleep 1s

# Expand storage slots
Down 2
Sleep 500ms
Enter
Sleep 1.5s

# Scroll through values
Down 3
Sleep 1s

# Collapse
Escape
Sleep 500ms

# Quit
Type "q"
```

---

## 5. CI Integration

### 5.1 GitHub Actions with vhs-action

```yaml
# .github/workflows/demos.yml
name: Generate Demo GIFs

on:
  push:
    branches: [main]
    paths:
      - 'demos/*.tape'
      - 'src/**'
  workflow_dispatch:

jobs:
  generate-demos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Build chop
        run: bun install && bun run build

      - name: Install chop globally
        run: bun link

      - name: Generate CLI demos
        uses: charmbracelet/vhs-action@v2
        with:
          path: "demos/cli-*.tape"

      - name: Generate TUI demos
        uses: charmbracelet/vhs-action@v2
        with:
          path: "demos/tui-*.tape"
        env:
          # TUI demos need a pseudo-terminal
          TERM: xterm-256color

      - name: Upload demo artifacts
        uses: actions/upload-artifact@v4
        with:
          name: demo-gifs
          path: demos/*.gif

      - name: Commit updated demos
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: regenerate demo GIFs"
          file_pattern: "demos/*.gif demos/*.png"
```

### 5.2 Visual Regression Testing

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression

on:
  pull_request:
    paths:
      - 'src/**'
      - 'demos/*.tape'

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Bun
        uses: oven-sh/setup-bun@v2

      - name: Build chop
        run: bun install && bun run build && bun link

      - name: Generate current demos
        uses: charmbracelet/vhs-action@v2
        with:
          path: "demos/cli-overview.tape"

      - name: Compare with baseline
        run: |
          # Use ImageMagick to compare GIFs frame by frame
          if [ -f demos/baseline/cli-overview.gif ]; then
            # Extract first frame and compare
            convert "demos/cli-overview.gif[0]" /tmp/current.png
            convert "demos/baseline/cli-overview.gif[0]" /tmp/baseline.png
            compare -metric RMSE /tmp/current.png /tmp/baseline.png /tmp/diff.png 2>&1 || true
          fi
```

---

## 6. Golden File Testing

### 6.1 Text Output Golden Files

VHS can output text files for diff-based testing:

```tape
# tests/golden/cli-help.tape
Source theme.tape
Output tests/golden/cli-help.txt

Set Width 120
Set Height 50

Type "chop --help"
Enter
Sleep 1s
```

```tape
# tests/golden/cli-abi-encode.tape
Source theme.tape
Output tests/golden/cli-abi-encode.txt

Set Width 120
Set Height 30

Type "chop abi-encode 'transfer(address,uint256)' 0x0000000000000000000000000000000000000001 1000000000000000000"
Enter
Sleep 1s
```

### 6.2 Golden File Test Script

```bash
#!/bin/bash
# scripts/test-golden.sh
# Regenerates golden files and checks for diffs

set -euo pipefail

GOLDEN_DIR="tests/golden"
TEMP_DIR=$(mktemp -d)

echo "Generating golden files..."
for tape in "$GOLDEN_DIR"/*.tape; do
  base=$(basename "$tape" .tape)
  vhs "$tape" -o "$TEMP_DIR/$base.txt" 2>/dev/null
done

echo "Comparing with existing golden files..."
FAILURES=0
for file in "$TEMP_DIR"/*.txt; do
  base=$(basename "$file")
  if [ -f "$GOLDEN_DIR/$base" ]; then
    if ! diff -q "$GOLDEN_DIR/$base" "$file" > /dev/null 2>&1; then
      echo "FAIL: $base differs from golden file"
      diff "$GOLDEN_DIR/$base" "$file" || true
      FAILURES=$((FAILURES + 1))
    else
      echo "PASS: $base"
    fi
  else
    echo "NEW: $base (no baseline)"
    cp "$file" "$GOLDEN_DIR/$base"
  fi
done

rm -rf "$TEMP_DIR"

if [ $FAILURES -gt 0 ]; then
  echo ""
  echo "$FAILURES golden file(s) differ. Run 'scripts/update-golden.sh' to update."
  exit 1
fi

echo "All golden files match."
```

### 6.3 Update Golden Files Script

```bash
#!/bin/bash
# scripts/update-golden.sh
# Regenerates all golden files

set -euo pipefail

GOLDEN_DIR="tests/golden"

for tape in "$GOLDEN_DIR"/*.tape; do
  base=$(basename "$tape" .tape)
  echo "Updating $base..."
  vhs "$tape" -o "$GOLDEN_DIR/$base.txt" 2>/dev/null
done

echo "Golden files updated. Commit the changes."
```

### 6.4 CI Golden File Check

```yaml
# In .github/workflows/test.yml
- name: Golden file tests
  run: |
    chmod +x scripts/test-golden.sh
    ./scripts/test-golden.sh
```

---

## 7. Advanced Patterns

### 7.1 Parameterized Tapes

Use environment variables for parameterization:

```tape
# demos/cli-call-param.tape
Source theme.tape
Output demos/cli-call-${CONTRACT}.gif
Require chop

Type "chop call --to ${CONTRACT} '${FUNCTION}' ${ARGS} -r ${RPC_URL}"
Enter
Sleep 3s
```

```bash
# Run with parameters
CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
FUNCTION="totalSupply()(uint256)" \
ARGS="" \
RPC_URL=https://eth.llamarpc.com \
vhs demos/cli-call-param.tape
```

### 7.2 Multi-Format Output

Generate multiple formats from one tape:

```tape
# demos/cli-overview-multi.tape
Source theme.tape

# Generate all formats
Output demos/cli-overview.gif
Output demos/cli-overview.mp4
Output demos/cli-overview.webm

Require chop

Type "chop --help"
Enter
Sleep 3s
```

### 7.3 Screenshot-Only Tapes

For README badges or documentation images:

```tape
# demos/screenshots/dashboard.tape
Source theme.tape

# No GIF output -- screenshots only
Set Width 1200
Set Height 700

Type "chop"
Enter
Sleep 2s

Screenshot demos/screenshots/dashboard.png

Type "q"
```

### 7.4 Composing Tape Files

Break complex demos into reusable parts:

```tape
# demos/shared/setup-node.tape
# Shared setup: start a local node and wait for it
Hide
Type "chop node --chain-id 31337 &"
Enter
Sleep 2s
Show
```

```tape
# demos/integration-test.tape
Source theme.tape
Output demos/integration-test.gif

# Start node in background
Source demos/shared/setup-node.tape

# Now interact with the running node
Type "chop balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -r http://localhost:8545"
Enter
Sleep 2s

Type "chop block latest -r http://localhost:8545 --json"
Enter
Sleep 2s

# Cleanup
Hide
Ctrl+C
Sleep 500ms
Show
```

---

## Directory Structure

```
demos/
  theme.tape                    # Shared Dracula theme settings
  shared/
    setup-node.tape             # Reusable node startup
  cli-overview.tape             # Full CLI help and overview
  cli-abi-encoding.tape         # ABI encoding/decoding demo
  cli-conversions.tape          # Unit conversion demo
  cli-address.tape              # Address utility demo
  cli-contract.tape             # Contract interaction demo
  cli-bytecode.tape             # Bytecode analysis demo
  tui-navigation.tape           # TUI tab navigation
  tui-call-history.tape         # TUI call history detail
  tui-contracts.tape            # TUI contract inspection
  tui-state-inspector.tape      # TUI state tree browsing
  screenshots/
    dashboard.tape              # Screenshot-only for README
  *.gif                         # Generated outputs (gitignored or committed)
  *.png                         # Generated screenshots

tests/golden/
  cli-help.tape                 # Golden file tape
  cli-help.txt                  # Golden file baseline
  cli-abi-encode.tape
  cli-abi-encode.txt

scripts/
  test-golden.sh                # Golden file comparison
  update-golden.sh              # Regenerate golden files
```

---

## Sources

- VHS documentation: https://github.com/charmbracelet/vhs
- VHS GitHub Action: https://github.com/charmbracelet/vhs-action
- Chop TUI features: `research/zig-tui-features.md`
- Chop CLI commands: `research/cast-anvil-features.md`
- Testing stack: `research/testing-stack.md`
