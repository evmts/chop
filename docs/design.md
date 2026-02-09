# Chop: Design Document

UI/TUI/API design specification. Covers how chop looks, feels, and behaves across all three modes.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color Palette & Typography](#2-color-palette--typography)
3. [CLI Design](#3-cli-design)
4. [TUI Design](#4-tui-design)
5. [JSON-RPC API Design](#5-json-rpc-api-design)
6. [MCP Interface Design](#6-mcp-interface-design)
7. [Error Presentation](#7-error-presentation)
8. [Keyboard Shortcut Map](#8-keyboard-shortcut-map)

---

## 1. Design Principles

1. **Cast-first**: CLI commands mirror cast exactly. Users alias `cast=chop` and nothing breaks.
2. **Terminal-native**: No web dependencies. Everything renders in the terminal with proper ANSI support.
3. **Progressive disclosure**: Simple output by default, `--json` for structured, TUI for exploration.
4. **Predictable**: Same input always produces same output. No hidden state between CLI invocations.
5. **Fast feedback**: CLI commands respond in < 100ms for local operations. TUI renders at 60fps.
6. **Accessible**: Color is informational but never required. All information is also conveyed by text/position.

---

## 2. Color Palette & Typography

### 2.1 Dracula Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Dark | `#282A36` | Terminal background |
| Current Line | Slightly lighter | `#44475A` | Selected row, active tab |
| Foreground | White | `#F8F8F2` | Default text |
| Comment | Gray | `#6272A4` | Muted text, borders, labels |
| Cyan | Cyan | `#8BE9FD` | Addresses, identifiers |
| Green | Green | `#50FA7B` | Success, values, amounts |
| Orange | Orange | `#FFB86C` | Warnings, gas values |
| Pink | Pink | `#FF79C6` | Keywords, selectors |
| Purple | Purple | `#BD93F9` | Numbers, block numbers |
| Red | Red | `#FF5555` | Errors, reverts |
| Yellow | Yellow | `#F1FA8C` | Hashes, hex data |

### 2.2 Semantic Color Assignments

| Element | Color | Example |
|---------|-------|---------|
| Ethereum addresses | Cyan | `0x1234...abcd` |
| Hashes (tx, block) | Yellow | `0xabcd...ef01` |
| ETH amounts | Green | `1.5 ETH` |
| Gas values | Orange | `21000 gas` |
| Function selectors | Pink | `0xa9059cbb` |
| Block numbers | Purple | `#19000000` |
| Error messages | Red | `REVERT: insufficient balance` |
| Labels/borders | Comment gray | `Balance:` |
| Success status | Green | `SUCCESS` |
| Revert status | Red | `REVERT` |

### 2.3 Typography

- **Font**: Monospace (user's terminal font)
- **Address display**: `0x1234...abcd` (first 6 + last 4 hex chars) when truncated
- **Hash display**: `0xabcd...ef01` (first 6 + last 4 hex chars) when truncated
- **Numbers**: comma-separated thousands for large decimals (e.g., `1,000,000`)
- **Wei amounts**: auto-format to most readable unit (e.g., `1.5 ETH` not `1500000000000000000 wei`)

---

## 3. CLI Design

### 3.1 Command Structure

```
chop [global-flags] <command> [command-flags] [arguments...]
```

### 3.2 Help Output Format

```
chop - Ethereum Swiss Army knife

USAGE:
  chop <command> [options]

COMMANDS:
  ABI:
    abi-encode (ae)     ABI encode function arguments
    calldata (cd)       Encode full calldata with selector
    abi-decode (ad)     Decode ABI-encoded data
    calldata-decode     Decode calldata with selector

  Address:
    to-check-sum-address (ta)   Checksum an address
    compute-address             Compute CREATE address
    create2                     Compute CREATE2 address

  Conversion:
    from-wei (fw)       Convert wei to ether
    to-wei (tw)         Convert ether to wei
    to-hex (th)         Decimal to hex
    to-dec (td)         Hex to decimal

  [... more categories ...]

OPTIONS:
  -h, --help        Show help
  -V, --version     Show version
  -j, --json        JSON output
  -r, --rpc-url     RPC endpoint URL

Run 'chop <command> --help' for command-specific help.
```

### 3.3 Output Patterns

**Single value output**:
```
$ chop to-hex 255
0xff
```

**Multi-field output (human)**:
```
$ chop block latest -r https://eth.llamarpc.com
Block #19500000
  Hash:       0xabcd...ef01
  Parent:     0x1234...5678
  Timestamp:  2024-03-15 14:30:00 UTC (2 hours ago)
  Gas Used:   15,000,000 / 30,000,000 (50.0%)
  Base Fee:   25.5 gwei
  Tx Count:   150
  Miner:      0xcoinbase...addr
```

**Multi-field output (JSON)**:
```json
$ chop block latest -r https://eth.llamarpc.com --json
{
  "number": "19500000",
  "hash": "0xabcd...full...ef01",
  "parentHash": "0x1234...full...5678",
  "timestamp": "1710510600",
  "gasUsed": "15000000",
  "gasLimit": "30000000",
  "baseFeePerGas": "25500000000",
  "transactions": 150,
  "miner": "0xcoinbase...full...addr"
}
```

**Table output (human)**:
```
$ chop logs --address 0xUSDC... --topic 0xddf252ad... -r https://eth.llamarpc.com
Block      Tx Hash          Event              From → To                    Amount
─────────  ───────────────  ─────────────────  ──────────────────────────  ─────────
19500000   0xabc...123      Transfer           0x111...aaa → 0x222...bbb  1,000 USDC
19500001   0xdef...456      Transfer           0x333...ccc → 0x444...ddd  500 USDC
19500001   0xdef...456      Approval           0x333...ccc → 0x555...eee  MAX
```

**Error output**:
```
$ chop call --to 0x1234... "balanceOf(address)(uint256)" 0xdead... -r https://bad.url
Error: RPC request failed
  URL:    https://bad.url
  Method: eth_call
  Cause:  Connection refused

$ echo $?
1
```

### 3.4 Node Startup Output

```
$ chop node

                   _
          ___| |__   ___  _ __
         / __| '_ \ / _ \| '_ \
        | (__| | | | (_) | |_) |
         \___|_| |_|\___/| .__/
                         |_|     v0.1.0

Chain ID:       31337
Gas Limit:      30,000,000
Gas Price:      0
Base Fee:       1 gwei
Hardfork:       Prague

Available Accounts
==================
(0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000.0 ETH)
(1) 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000.0 ETH)
(2) 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000.0 ETH)
...

Private Keys
==================
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
(1) 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
(2) 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
...

Listening on http://127.0.0.1:8545
```

---

## 4. TUI Design

### 4.1 Overall Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▸ Dashboard │ History │ Contracts │ Accounts │ Blocks │ Txs │ Settings │ State│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          [ View Content Area ]                               │
│                                                                              │
│                         (varies by active tab)                               │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⛓ 31337 │ ▪ #42 │ ⛽ 1 gwei │ 10 accounts │ http://127.0.0.1:8545 │ ?=help │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Tab bar** (top): horizontal tabs, active tab highlighted with `▸` prefix and Current Line background
- **Content area** (middle): full width/height minus tab bar and status bar
- **Status bar** (bottom): chain info, always visible

### 4.2 Dashboard View

```
┌─ Chain Info ──────────────────────────┬─ Recent Blocks ───────────────────────┐
│                                       │                                       │
│  Chain ID:    31337                   │  #42  2 txs  1.2M gas  3s ago        │
│  Block:       #42                     │  #41  0 txs    0   gas  6s ago        │
│  Gas Price:   0 wei                   │  #40  5 txs  3.5M gas  9s ago        │
│  Base Fee:    1 gwei                  │  #39  1 tx   21K  gas  12s ago       │
│  Client:      chop/0.1.0             │  #38  3 txs  890K gas  15s ago       │
│  Mining:      auto                    │                                       │
│                                       │                                       │
├─ Recent Transactions ─────────────────┼─ Accounts ────────────────────────────┤
│                                       │                                       │
│  0xabc...123  0xf39...266 → 0x709..  │  0xf39...266   9998.5 ETH            │
│  0xdef...456  0x3C4...3BC → 0xf39..  │  0x709...9C8  10000.0 ETH            │
│  0x789...abc  CREATE → 0x5Fb...E22   │  0x3C4...3BC   9999.2 ETH            │
│                                       │  0xe92...37D  10000.0 ETH            │
│                                       │  0x15d...5aA  10000.0 ETH            │
│                                       │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

### 4.3 Call History View

**List mode**:
```
┌─ Call History ────────────────────────────────────────────────────────────────┐
│  #   Type          From          To            Value     Gas      Status     │
│ ───  ────────────  ────────────  ────────────  ────────  ───────  ────────── │
│  1   CALL          0xf39...266   0x5Fb...E22   0 ETH    45,231   ✓ Success  │
│▸ 2   STATICCALL    0xf39...266   0x5Fb...E22   0 ETH    23,100   ✓ Success  │
│  3   CALL          0x709...9C8   0x5Fb...E22   1.5 ETH  52,400   ✗ Revert   │
│  4   CREATE        0x3C4...3BC   0xe7f...A01   0 ETH    128,900  ✓ Success  │
│  5   DELEGATECALL  0xe7f...A01   0x5Fb...E22   0 ETH    31,200   ✓ Success  │
│                                                                              │
│                                                                              │
│                                                                              │
│ [Enter] Details  [/] Filter  [j/k] Navigate                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Detail mode** (after pressing Enter):
```
┌─ Call #2 Detail ──────────────────────────────────────────────────────────────┐
│                                                                              │
│  Type:     STATICCALL                                                        │
│  From:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266                       │
│  To:       0x5FbDB2315678afecb367f032d93F642f64180aa7                       │
│  Value:    0 ETH                                                             │
│  Gas:      23,100 / 30,000                                                   │
│  Status:   ✓ Success                                                         │
│                                                                              │
│  ── Calldata ──────────────────────────────────────────────                  │
│  Function: balanceOf(address)                                                │
│  Selector: 0x70a08231                                                        │
│  Args:                                                                       │
│    [0] address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266                  │
│                                                                              │
│  ── Return Data ───────────────────────────────────────────                  │
│  0x0000000000000000000000000000000000000000000000000de0b6b3a7640000          │
│  Decoded: 1000000000000000000 (uint256)                                      │
│                                                                              │
│  ── Logs (0) ──────────────────────────────────────────────                  │
│  (none)                                                                      │
│                                                                              │
│ [Esc] Back  [↑/↓] Scroll                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Contracts View

```
┌─ Contracts ──────────────┬─ 0x5FbDB2315678afecb367f032d93F642f64180aa7 ──────┐
│                          │                                                    │
│ ▸ 0x5Fb...E22  1.2 KB   │  ── Disassembly ──────────────────────────────    │
│   0xe7f...A01  3.4 KB   │  0000  PUSH1 0x80                                 │
│   0x9fE...B33  0.8 KB   │  0002  PUSH1 0x40                                 │
│                          │  0004  MSTORE                                      │
│                          │  0005  CALLVALUE                                   │
│                          │  0006  DUP1                                        │
│                          │  0007  ISZERO                                      │
│                          │  0008  PUSH2 0x0010                                │
│                          │  000B  JUMPI                                       │
│                          │  000C  PUSH1 0x00                                  │
│                          │  000E  DUP1                                        │
│                          │  000F  REVERT                                      │
│                          │  0010  JUMPDEST                                    │
│                          │                                                    │
│                          │  ── Selectors ─────────────────────────────────    │
│                          │  0x70a08231  balanceOf(address)                    │
│                          │  0xa9059cbb  transfer(address,uint256)             │
│                          │  0x095ea7b3  approve(address,uint256)              │
│                          │  0x18160ddd  totalSupply()                         │
│                          │                                                    │
│ [Enter] Select           │ [d] Disasm  [s] Storage  [↑/↓] Scroll             │
└──────────────────────────┴────────────────────────────────────────────────────┘
```

### 4.5 Accounts View

```
┌─ Accounts ────────────────────────────────────────────────────────────────────┐
│  Address                                      Balance        Nonce  Type     │
│ ──────────────────────────────────────────────────────────── ──────  ──────── │
│▸ 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   9,998.5 ETH   42     EOA      │
│  0x70997970C51812dc3A010C7d01b50e0d17dc79C8  10,000.0 ETH    0     EOA      │
│  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC   9,999.2 ETH    3     EOA      │
│  0x5FbDB2315678afecb367f032d93F642f64180aa7       0.0 ETH    1     Contract │
│  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512       1.5 ETH    0     Contract │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│ [Enter] Details  [f] Fund  [i] Impersonate  [j/k] Navigate                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Blocks View

```
┌─ Blocks ──────────────────────────────────────────────────────────────────────┐
│  Block    Hash          Timestamp              Txs  Gas Used    Base Fee     │
│ ───────── ────────────  ─────────────────────  ───  ──────────  ─────────── │
│▸ #42      0xabc...123   2024-03-15 14:30 (3s)   2   1,200,000  1.0 gwei    │
│  #41      0xdef...456   2024-03-15 14:27 (6s)   0           0  1.0 gwei    │
│  #40      0x789...abc   2024-03-15 14:24 (9s)   5   3,500,000  1.1 gwei    │
│  #39      0x012...def   2024-03-15 14:21 (12s)  1      21,000  1.0 gwei    │
│  #38      0x345...678   2024-03-15 14:18 (15s)  3     890,000  1.0 gwei    │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│ [Enter] Details  [m] Mine  [j/k] Navigate                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.7 Transactions View

```
┌─ Transactions ────────────────────────────────────────────────────────────────┐
│  Hash          Block  From          To            Value     Status   Type    │
│ ────────────  ──────  ────────────  ────────────  ────────  ───────  ─────── │
│▸ 0xabc...123   #42   0xf39...266   0x5Fb...E22   0 ETH    ✓       EIP1559  │
│  0xdef...456   #42   0x709...9C8   0xe7f...A01   1.5 ETH  ✓       EIP1559  │
│  0x789...abc   #40   0x3C4...3BC   0x5Fb...E22   0 ETH    ✗       Legacy   │
│  0x012...def   #40   0xf39...266   CREATE        0 ETH    ✓       EIP1559  │
│  0x345...678   #40   0xf39...266   0x5Fb...E22   0 ETH    ✓       EIP1559  │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│ [Enter] Details  [/] Filter  [j/k] Navigate                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 Settings View

```
┌─ Settings ────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Node Configuration                                                          │
│  ─────────────────                                                           │
│  RPC URL:          http://127.0.0.1:8545                                     │
│  Chain ID:         31337                                                     │
│  Hardfork:         Prague                                                    │
│                                                                              │
│  Mining                                                                      │
│  ──────                                                                      │
│▸ Mining Mode:      auto  ◂▸                                                 │
│  Block Time:       -                                                         │
│                                                                              │
│  Gas                                                                         │
│  ───                                                                         │
│  Block Gas Limit:  30,000,000                                                │
│  Base Fee:         1 gwei                                                    │
│  Gas Price:        0                                                         │
│                                                                              │
│  Fork                                                                        │
│  ────                                                                        │
│  Fork URL:         (none)                                                    │
│  Fork Block:       -                                                         │
│                                                                              │
│ [Enter] Edit  [↑/↓] Navigate                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.9 State Inspector View

```
┌─ State Inspector ─────────────────────────────────────────────────────────────┐
│                                                                              │
│  ▾ 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266                              │
│    Balance: 9998.5 ETH                                                       │
│    Nonce:   42                                                               │
│    Code:    (none - EOA)                                                     │
│                                                                              │
│  ▾ 0x5FbDB2315678afecb367f032d93F642f64180aa7                               │
│    Balance: 0 ETH                                                            │
│    Nonce:   1                                                                │
│    Code:    1,234 bytes                                                      │
│    ▾ Storage                                                                 │
│      Slot 0:  0x00000000000000000000000000000000000000000000000000000003e8    │
│               = 1000 (decimal)                                               │
│      Slot 1:  0x00000000000000000000000000000000000000000000000000000000      │
│               = 0 (decimal)                                                  │
│     ▸ Slot 2: 0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cf    │
│               = 0xf39F...79cf (address)                                      │
│                                                                              │
│  ▸ 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512                               │
│                                                                              │
│ [Enter] Expand/Collapse  [e] Edit  [x] Hex/Dec  [/] Search  [↑/↓] Navigate │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.10 Help Overlay

Pressing `?` from any view shows a modal overlay:

```
┌─ Keyboard Shortcuts ──────────────────────────────────────────────────────────┐
│                                                                              │
│  Navigation                         Views                                    │
│  ──────────                         ─────                                    │
│  1-8      Switch to tab             1  Dashboard                             │
│  j/↓      Move down                 2  Call History                          │
│  k/↑      Move up                   3  Contracts                             │
│  h/←      Collapse/left             4  Accounts                              │
│  l/→      Expand/right              5  Blocks                                │
│  Enter    Select/expand             6  Transactions                          │
│  Esc      Back/close                7  Settings                              │
│  /        Filter/search             8  State Inspector                       │
│  q        Quit                                                               │
│  ?        This help                 Actions (view-specific)                  │
│                                     ───────────────────────                  │
│  Display                            m  Mine block (Blocks)                   │
│  ───────                            f  Fund account (Accounts)               │
│  x  Toggle hex/decimal              i  Impersonate (Accounts)                │
│  r  Refresh                         e  Edit value (State Inspector)          │
│  R  Hard refresh (re-fetch)         d  Toggle disasm view (Contracts)        │
│                                     s  Storage view (Contracts)              │
│                                                                              │
│                                            [Esc or ? to close]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. JSON-RPC API Design

### 5.1 Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_call",
  "params": [
    {
      "to": "0x5FbDB2315678afecb367f032d93F642f64180aa7",
      "data": "0x70a08231000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cffb92266"
    },
    "latest"
  ]
}
```

### 5.2 Response Format

**Success**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"
}
```

**Error**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "execution reverted",
    "data": "0x08c379a00000000000000000000000000000000000000000000000000000000000000020..."
  }
}
```

### 5.3 Batch Requests

Array of requests → array of responses. Responses may be in different order than requests. Matched by `id`.

### 5.4 Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Server error (execution revert, etc.) |

---

## 6. MCP Interface Design

### 6.1 Tool Naming Convention

`chop_{category}_{action}` — e.g., `chop_abi_encode`, `chop_call`, `chop_node_mine`

### 6.2 Tool Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "0xa9059cbb000000000000000000000000..."
    }
  ]
}
```

For errors:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Invalid address format. Expected 0x-prefixed 40-character hex string."
    }
  ],
  "isError": true
}
```

### 6.3 Resource Response Format

```json
{
  "contents": [
    {
      "uri": "chop://account/0x1234.../balance",
      "mimeType": "application/json",
      "text": "{\"balance\":\"1500000000000000000\",\"formatted\":\"1.5 ETH\"}"
    }
  ]
}
```

### 6.4 Tool Description Guidelines

- First sentence: action verb + what it does
- Second sentence: when to use it
- Keep under 200 characters total
- Include example input/output types in description

Good: `"Encode full calldata (selector + arguments). Use when you need complete transaction calldata for contract interaction."`

Bad: `"This tool encodes calldata."` (too vague for LLM tool selection)

---

## 7. Error Presentation

### 7.1 CLI Errors

```
Error: <short description>
  <detail key>: <detail value>
  <detail key>: <detail value>
  Cause: <underlying error>
```

Example:
```
Error: Transaction reverted
  Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa7
  Function: transfer(address,uint256)
  Reason:   ERC20: transfer amount exceeds balance
  Gas Used: 23,400
```

### 7.2 CLI JSON Errors

```json
{
  "error": {
    "type": "TransactionRevertError",
    "message": "Transaction reverted",
    "contract": "0x5FbDB2315678afecb367f032d93F642f64180aa7",
    "function": "transfer(address,uint256)",
    "reason": "ERC20: transfer amount exceeds balance",
    "gasUsed": "23400"
  }
}
```

### 7.3 TUI Errors

- Inline errors show as red text in the relevant panel
- Connection errors show in status bar: `⚠ RPC disconnected` in red
- Modal errors for critical failures (e.g., WASM load failure)

### 7.4 Error Types

| Error Type | CLI Exit Code | JSON-RPC Code |
|------------|---------------|---------------|
| Invalid arguments | 1 | -32602 |
| RPC connection failure | 1 | -32603 |
| Transaction revert | 1 | -32000 |
| Account not found | 1 | -32000 |
| Invalid address | 1 | -32602 |
| Unsupported method | 1 | -32601 |

---

## 8. Keyboard Shortcut Map

### 8.1 Global (All Views)

| Key | Action |
|-----|--------|
| `1`-`8` | Switch to view by number |
| `q` | Quit application |
| `Ctrl+C` | Force quit |
| `?` | Toggle help overlay |
| `r` | Refresh current view |
| `R` | Hard refresh (re-fetch from RPC) |

### 8.2 List/Table Views (History, Accounts, Blocks, Transactions)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move selection down |
| `k` / `↑` | Move selection up |
| `g` / `Home` | Jump to top |
| `G` / `End` | Jump to bottom |
| `Enter` | Open detail / select |
| `Escape` | Close detail / clear filter |
| `/` | Open filter/search |
| `n` | Next search result |
| `N` | Previous search result |

### 8.3 Tree Views (State Inspector, Contract Storage)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `h` / `←` | Collapse node |
| `l` / `→` | Expand node |
| `Enter` | Toggle expand/collapse |
| `x` | Toggle hex/decimal display |
| `/` | Search |

### 8.4 View-Specific

| View | Key | Action |
|------|-----|--------|
| Accounts | `f` | Fund account |
| Accounts | `i` | Impersonate account |
| Blocks | `m` | Mine new block |
| Contracts | `d` | Toggle disassembly |
| Contracts | `s` | Toggle storage view |
| State Inspector | `e` | Edit value |
| Settings | `Enter` | Edit setting |
