# Zig TUI POC - Complete Feature Specification

This document catalogs every feature, behavior, data type, keyboard shortcut, and architectural pattern in the Zig TUI proof-of-concept at `src/`. This serves as the authoritative feature spec for what must be replicated in the TypeScript port.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entry Point and CLI/TUI Dispatch](#2-entry-point-and-clitui-dispatch)
3. [Root Widget and Tab Navigation](#3-root-widget-and-tab-navigation)
4. [Color Palette and Styling](#4-color-palette-and-styling)
5. [Data Types](#5-data-types)
6. [Tab State Management](#6-tab-state-management)
7. [Views](#7-views)
   - 7.1 [Dashboard View](#71-dashboard-view)
   - 7.2 [Call History View](#72-call-history-view)
   - 7.3 [Contracts View](#73-contracts-view)
   - 7.4 [Accounts View](#74-accounts-view)
   - 7.5 [Blocks View](#75-blocks-view)
   - 7.6 [Transactions View](#76-transactions-view)
   - 7.7 [Settings View](#77-settings-view)
   - 7.8 [State Inspector View](#78-state-inspector-view)
8. [CLI Commands](#8-cli-commands)
9. [Blockchain Simulation Core](#9-blockchain-simulation-core)
10. [EVM Bytecode Disassembler](#10-evm-bytecode-disassembler)
11. [Draw Utilities](#11-draw-utilities)
12. [Navigation State Machine](#12-navigation-state-machine)
13. [Cross-Cutting Patterns](#13-cross-cutting-patterns)

---

## 1. Architecture Overview

The application has a dual-mode architecture:

```
main.zig
  |
  +-- CLI mode (cli/mod.zig -> cli/commands/*.zig)
  |     Activated when command-line arguments are present.
  |     Returns exit code 0 on success, 1 on error.
  |
  +-- TUI mode (root.zig -> views/*.zig)
        Activated when NO arguments are given (exit code 255 sentinel).
        Uses the vaxis/vxfw terminal UI framework.
```

**Key source files:**

| File | Role |
|------|------|
| `src/main.zig` | Entry point, CLI/TUI dispatch |
| `src/root.zig` | Root widget (ChopApp), tab navigation, layout shell |
| `src/types.zig` | All shared data types |
| `src/styles.zig` | Dracula-inspired color palette and style constants |
| `src/state/tab.zig` | Tab enum and key mapping |
| `src/views/mod.zig` | View module re-exports |
| `src/views/dashboard.zig` | Dashboard view |
| `src/views/history.zig` | Call history view (most complex view) |
| `src/views/contracts.zig` | Contracts view with disassembly |
| `src/views/accounts.zig` | Accounts view |
| `src/views/blocks.zig` | Blocks view |
| `src/views/transactions.zig` | Transactions view |
| `src/views/settings.zig` | Settings view |
| `src/views/inspector.zig` | State inspector view |
| `src/views/draw.zig` | Shared draw helper functions |
| `src/cli/mod.zig` | CLI entry, argument parsing, command dispatch |
| `src/cli/commands/*.zig` | Individual CLI command implementations |
| `src/core/blockchain.zig` | Blockchain simulation engine |
| `src/core/disassembler.zig` | EVM bytecode disassembler |

---

## 2. Entry Point and CLI/TUI Dispatch

**File:** `src/main.zig`

### Behavior

1. Allocate a `GeneralPurposeAllocator`.
2. Call `cli.run(allocator)` which parses `std.process.args()`.
3. If no subcommand is provided, `cli.run` returns the sentinel value `255`.
4. If `cli_result != 255`, exit with that code (CLI ran and completed).
5. If `cli_result == 255`, initialize the vxfw TUI app, create a `ChopApp` root widget, and run the event loop.

### The Exit Code 255 Pattern

This is the critical integration pattern:
- The CLI module returns `255` to mean "no CLI command was requested, launch the TUI instead."
- The `tui` subcommand also returns `255` explicitly.
- Any other return value (0 for success, 1 for error) causes the process to exit immediately without launching the TUI.

### Global CLI Flags

| Flag | Aliases | Description |
|------|---------|-------------|
| `--help` | `-h` | Print help text and exit 0 |
| `--version` | `-V` | Print "chop 0.1.0" and exit 0 |
| `--json` | `-j` | Output results in JSON format |

---

## 3. Root Widget and Tab Navigation

**File:** `src/root.zig`

### ChopApp Structure

The root widget manages:
- `current_tab: Tab` -- which tab is active (default: `.dashboard`)
- `blockchain: *core.Blockchain` -- the shared blockchain simulation instance
- Eight view instances, one per view type

### Initialization Flow

1. Create `Blockchain` instance (which creates genesis block + 10 test accounts).
2. Create all view instances.
3. Wire blockchain data into views:
   - `dashboard_view.blockchain`, `.stats`, `.recent_blocks`, `.recent_txs`
   - `accounts_view.accounts`
   - `blocks_view.blocks`
   - `transactions_view.transactions`
   - `contracts_view.contracts`
   - `history_view.entries`, `.blockchain`
   - `settings_view.blockchain`
   - `inspector_view.blockchain`

### Layout Structure

The screen is divided into three horizontal bands:

```
+--------------------------------------------------+
| Row 0: Tab bar (1:Dashboard 2:History 3:Contracts | ... )
+--------------------------------------------------+
| Row 1: Separator line (dashes full width)         |
+--------------------------------------------------+
| Row 2 to (height-2): Content area (current view)  |
+--------------------------------------------------+
| Row (height-1): Help bar (context-sensitive)       |
+--------------------------------------------------+
```

- **Tab bar**: Each tab rendered as `N:Label` with a space separator. Active tab uses `tab_active` style (white on cyan, bold). Inactive tabs use `tab_inactive` style (muted gray).
- **Separator**: Full-width dashes in muted style.
- **Content area**: Delegated to the current view's `draw()` function. Height = `total_height - 3`.
- **Help bar**: Context-sensitive text at the very bottom row, in muted style.

### Global Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit the application |
| `Ctrl+C` | Quit the application |
| `1` | Switch to Dashboard tab |
| `2` | Switch to Call History tab |
| `3` | Switch to Contracts tab |
| `4` | Switch to Accounts tab |
| `5` | Switch to Blocks tab |
| `6` | Switch to Transactions tab |
| `7` | Switch to Settings tab |

### Event Delegation

Global keys (quit, tab switch) are handled by the root. All other events are delegated to `getCurrentView().handleEvent(ctx, event)`.

### Help Bar Text Per Tab

| Tab | Help text |
|-----|-----------|
| Dashboard | `q: Quit \| 1-7: Switch tabs \| a: Toggle auto-refresh \| r: Refresh` |
| Call History | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Detail \| n: New call \| e: Execute` |
| Contracts | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Detail \| h/l: Blocks \| g: Jump \| G: Goto PC` |
| Accounts | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Detail \| c: Copy \| p: Private key` |
| Blocks | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Detail \| c: Copy hash` |
| Transactions | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Detail \| c: Copy hash` |
| Settings | `q: Quit \| 1-7: Tabs \| j/k: Navigate \| Enter: Select` |

---

## 4. Color Palette and Styling

**File:** `src/styles.zig`

### Color Constants (Dracula-inspired)

| Name | RGB | Usage |
|------|-----|-------|
| `primary` | `#00D9FF` (Cyan) | Headings, highlights, active tab background |
| `secondary` | `#7D56F4` (Purple) | Secondary elements |
| `amber` | `#FFB86C` (Orange) | Values, data, selection indicator |
| `success` | `#50FA7B` (Green) | Success states |
| `err` | `#FF5555` (Red) | Error states |
| `muted` | `#6272A4` (Gray) | Help text, labels, inactive tabs |
| `text` | `#F8F8F2` (Light) | Default text |
| `bg` | `#282A36` (Dark) | Background |
| `bg_highlight` | `#44475A` (Lighter dark) | Selected row background |

### Pre-defined Styles

| Style Name | Properties |
|------------|------------|
| `title` | fg: primary, bold |
| `selected` | fg: text, bg: bg_highlight, bold |
| `normal` | fg: text |
| `muted` | fg: muted |
| `success` | fg: success |
| `err` | fg: err |
| `value` | fg: amber |
| `tab_active` | fg: text, bg: primary, bold |
| `tab_inactive` | fg: muted |

---

## 5. Data Types

**File:** `src/types.zig`

### CallType (enum)

```
call, static_call, create, create2, delegate_call
```

Display strings: `CALL`, `STATICCALL`, `CREATE`, `CREATE2`, `DELEGATECALL`

### CallParams (struct)

Fields for configuring an EVM call from the UI:

| Field | Type | Default |
|-------|------|---------|
| `call_type` | `CallType` | `.call` |
| `caller` | `[]const u8` | `""` |
| `target` | `[]const u8` | `""` |
| `value` | `[]const u8` | `"0"` |
| `input_data` | `[]const u8` | `""` |
| `gas_limit` | `[]const u8` | `"1000000"` |
| `salt` | `[]const u8` | `""` |

### Log (struct)

| Field | Type |
|-------|------|
| `address` | `[]const u8` |
| `topics` | `[]const []const u8` |
| `data` | `[]const u8` |

### CallResult (struct)

| Field | Type |
|-------|------|
| `success` | `bool` |
| `return_data` | `[]const u8` |
| `gas_left` | `u64` |
| `error_info` | `?[]const u8` |
| `logs` | `[]const Log` |
| `deployed_addr` | `?[]const u8` |

### Account (struct)

| Field | Type | Notes |
|-------|------|-------|
| `address` | `[]const u8` | Hex string with 0x prefix |
| `balance` | `u256` | In wei |
| `nonce` | `u64` | |
| `code` | `[]const u8` | Bytecode (empty for EOA) |
| `code_hash` | `[]const u8` | |
| `private_key` | `?[]const u8` | Only for pre-funded test accounts |
| `index` | `u8` | 1-10 for pre-funded accounts |

Has a `formatBalance()` method that divides by 10^18 and appends " ETH".

### Block (struct)

| Field | Type |
|-------|------|
| `number` | `u64` |
| `hash` | `[]const u8` |
| `parent_hash` | `[]const u8` |
| `timestamp` | `i64` |
| `gas_used` | `u64` |
| `gas_limit` | `u64` |
| `transactions` | `[]const []const u8` (tx hashes) |
| `miner` | `[]const u8` |
| `state_root` | `[]const u8` |
| `size` | `u64` |

### Transaction (struct)

| Field | Type |
|-------|------|
| `id` | `[]const u8` |
| `hash` | `[]const u8` |
| `block_number` | `u64` |
| `block_hash` | `[]const u8` |
| `from` | `[]const u8` |
| `to` | `?[]const u8` (null for CREATE) |
| `value` | `u256` |
| `gas_limit` | `u64` |
| `gas_used` | `u64` |
| `gas_price` | `u256` |
| `input_data` | `[]const u8` |
| `nonce` | `u64` |
| `call_type` | `CallType` |
| `status` | `bool` (true = success) |
| `return_data` | `[]const u8` |
| `logs` | `[]const Log` |
| `error_info` | `?[]const u8` |
| `timestamp` | `i64` |
| `deployed_addr` | `?[]const u8` |

### BlockchainStats (struct)

| Field | Type | Default |
|-------|------|---------|
| `block_height` | `u64` | 0 |
| `total_blocks` | `u64` | 0 |
| `total_transactions` | `u64` | 0 |
| `successful_txs` | `u64` | 0 |
| `failed_txs` | `u64` | 0 |
| `total_gas_used` | `u64` | 0 |
| `total_accounts` | `u32` | 0 |
| `total_contracts` | `u32` | 0 |
| `total_balance` | `u256` | 0 |
| `last_block_time` | `i64` | 0 |

### CallHistoryEntry (struct)

| Field | Type |
|-------|------|
| `id` | `[]const u8` |
| `params` | `CallParams` |
| `result` | `?CallResult` |
| `timestamp` | `i64` |

### Contract (struct)

| Field | Type |
|-------|------|
| `address` | `[]const u8` |
| `bytecode` | `[]const u8` |
| `timestamp` | `i64` |

### Instruction (struct) -- for disassembly

| Field | Type |
|-------|------|
| `pc` | `u32` |
| `opcode` | `u8` |
| `opcode_name` | `[]const u8` |
| `operand` | `?[]const u8` |
| `size` | `u8` |

### BasicBlock (struct) -- for disassembly

| Field | Type |
|-------|------|
| `start_pc` | `u32` |
| `end_pc` | `u32` |
| `instructions` | `[]const Instruction` |

### DisassemblyResult (struct)

| Field | Type |
|-------|------|
| `blocks` | `[]const BasicBlock` |
| `total_instructions` | `u32` |
| `bytecode_size` | `u32` |

### AccountState (struct) -- for inspector

| Field | Type |
|-------|------|
| `address` | `[]const u8` |
| `balance` | `u256` |
| `nonce` | `u64` |
| `code` | `[]const u8` |
| `code_size` | `u32` |
| `storage_slots` | `StringHashMap([]const u8)` |
| `is_contract` | `bool` |

### NavState (struct) -- stack-based navigation

A stack of `AppState` values supporting `push`, `pop`, `peek`, `clear`, `depth`. Defined but not currently wired into the views (views use their own `show_detail` booleans instead).

### AppState (enum) -- navigation states

```
dashboard, call_history, call_history_detail, contracts, contract_detail,
accounts, account_detail, blocks, block_detail, transactions, transaction_detail,
settings, state_inspector, call_param_list, call_param_edit, call_type_edit,
call_executing, call_result, log_detail, fixtures_list, confirm_reset, goto_pc
```

### SettingsOption (enum)

| Value | Label | Description |
|-------|-------|-------------|
| `server_status` | "Server Status" | "View RPC server status" |
| `reset_state` | "Reset Blockchain State" | "Clear all blocks, transactions, and contracts" |
| `regenerate_accounts` | "Regenerate Test Accounts" | "Generate new test account keys" |
| `export_state` | "Export State" | "Export current state to JSON" |

---

## 6. Tab State Management

**File:** `src/state/tab.zig`

### Tab Enum

7 tabs mapped to keys 1-7:

| Enum | Key | Label | Short Label | Help |
|------|-----|-------|-------------|------|
| `dashboard` | 1 | "1:Dashboard" | "Dashboard" | "Blockchain stats and overview" |
| `call_history` | 2 | "2:History" | "History" | "EVM call history and execution" |
| `contracts` | 3 | "3:Contracts" | "Contracts" | "Deployed contracts and disassembly" |
| `accounts` | 4 | "4:Accounts" | "Accounts" | "Account balances and state" |
| `blocks` | 5 | "5:Blocks" | "Blocks" | "Block explorer" |
| `transactions` | 6 | "6:Txns" | "Txns" | "Transaction history" |
| `settings` | 7 | "7:Settings" | "Settings" | "Configuration options" |

Note: There is NO tab for the Inspector view. It is defined as a view but is not accessible via the tab bar. The `getCurrentView()` method in root.zig does not map any tab to `inspector_view`. This appears to be a planned feature that is not yet wired up.

### Tab Key Mapping

`fromKey(codepoint)`: maps characters '1'..'7' to tab indices 0..6.

---

## 7. Views

All views follow the same widget pattern:
- A struct with state fields.
- `init(allocator)` constructor.
- `widget()` method returning a `vxfw.Widget`.
- `handleEvent()` for keyboard input.
- `draw()` returning a `vxfw.Surface`.
- Each view uses local `writeString()` and `drawLine()` helper functions.

### Common View Patterns

- **List/Detail Toggle**: Most views have a `show_detail: bool` field. `Enter` sets it to `true`, `Escape` sets it to `false`.
- **Selection Cursor**: `selected_index: usize` tracks which list item is selected.
- **Scroll Offset**: `scroll_offset: usize` (present but not fully utilized in most views).
- **Vim Navigation**: `j`/`Down` to move down, `k`/`Up` to move up.
- **Selection Indicator**: ">" character drawn at column 0 in `value` style (amber).

---

### 7.1 Dashboard View

**File:** `src/views/dashboard.zig`

#### What It Does

Displays blockchain overview statistics, recent blocks, and recent transactions.

#### State

| Field | Type | Default |
|-------|------|---------|
| `blockchain` | `?*core.Blockchain` | `null` |
| `stats` | `BlockchainStats` | `{}` |
| `recent_blocks` | `[]const Block` | `&.{}` |
| `recent_txs` | `[]const Transaction` | `&.{}` |
| `auto_refresh` | `bool` | `true` |

#### Layout

```
Row 0: "Chop Dashboard" (title style)
Row 1: "Local EVM Development Environment" (muted)
Row 3: Auto-refresh indicator ("Auto-refresh: Enabled/Disabled")
Row 5: "BLOCKCHAIN STATS" section header
Row 6: Separator line
Row 7-10: Stats grid (2 columns at col 2 and col 30):
  - Block Height / Total Blocks
  - Transactions / Successful
  - Failed Txs / Gas Used
  - Accounts / Contracts
Row 12: "RECENT BLOCKS" section header
Row 13: Separator line
Row 14+: Recent block entries (up to 5)
  Format: "Block #N - M txs - Gas: G"
Row N: "RECENT TRANSACTIONS" section header
Row N+1: Separator line
Row N+2+: Recent transaction entries (up to 5)
  Format: "[OK] 0xabc123... -> 0xdef456..." or "[FAIL] ..."
```

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `a` | Toggle `auto_refresh` boolean |
| `r` | Manual refresh (re-fetches stats, recent blocks, recent txs from blockchain) |

#### Data Displayed

- Block Height, Total Blocks, Total Transactions, Successful Txs, Failed Txs, Gas Used, Accounts count, Contracts count
- Last 5 blocks with number, tx count, gas used
- Last 5 transactions with status, from (shortened to 10 chars), to (or "CREATE")

#### Address Shortening

`shortenAddress()` returns first 10 characters of the address.

---

### 7.2 Call History View

**File:** `src/views/history.zig`

This is the most complex view with 5 sub-screens and a full text editing system.

#### What It Does

Shows EVM call execution history. Allows creating new calls, editing call parameters, executing calls against the blockchain, viewing results, and saving fixtures.

#### State

| Field | Type | Default |
|-------|------|---------|
| `blockchain` | `?*core.Blockchain` | `null` |
| `entries` | `[]const CallHistoryEntry` | `&.{}` |
| `selected_index` | `usize` | 0 |
| `scroll_offset` | `usize` | 0 |
| `show_detail` | `bool` | false |
| `selected_entry` | `?CallHistoryEntry` | null |
| `log_selected_index` | `usize` | 0 |
| `show_log_detail` | `bool` | false |
| `show_params` | `bool` | false |
| `param_cursor` | `usize` | 0 |
| `editing_param` | `bool` | false |
| `call_params` | `CallParams` | defaults |
| `validation_error` | `?[]const u8` | null |
| `edit_buffer` | `[256]u8` | zeroed |
| `edit_buffer_len` | `usize` | 0 |
| `edit_cursor` | `usize` | 0 |

#### Sub-Screens (5 total)

**Screen 1: List View** (default)

```
"Call History" (title)
"EVM Execution History" (muted subtitle)

Column headers: Status | Type | Target | Gas | Time
Separator line
Entry rows with:
  ">" indicator for selected
  Status: [---] (no result), [OK] (success, green), [FAIL] (error, red)
  Call type string
  Target address (truncated to 20 chars)
  Gas left (from result)
  Timestamp
```

Keys:
- `j`/`Down`: Move selection down
- `k`/`Up`: Move selection up
- `Enter`: Open detail view for selected entry
- `n`: Open new call parameter editor (resets params to defaults)

**Screen 2: Detail View** (`show_detail == true`)

```
"Call Detail" (title)

Status: SUCCESS/FAILED (green/red)

PARAMETERS section:
  Type: CALL/STATICCALL/etc.
  Caller: 0x...
  Target: 0x...
  Value: ...
  Gas: ...

RESULT section (if result exists):
  Gas Left: N
  Return Data: (first 64 chars)
  Error: (if failed)
  Deployed: (if CREATE/CREATE2)

LOGS (N) section:
  Selectable list of logs showing "Log N: 0xAddress"
```

Keys:
- `Escape`: Back to list
- `j`/`Down`: Navigate logs
- `k`/`Up`: Navigate logs
- `Enter`: Open log detail for selected log
- `e`: Replay call (copies params to editor, opens param screen)
- `f`: Save as fixture (writes JSON to `~/.chop/fixtures/fixture_TIMESTAMP.json`)

**Screen 3: Parameters View** (`show_params == true`)

```
"Call Parameters" (title)
"Configure EVM call" (muted subtitle)

Selectable parameter list (7 items):
  > Call Type : CALL
    Caller    : (empty)
    Target    : 0x...
    Value     : 0
    Input Data: (empty)
    Gas Limit : 1000000
    Salt      : (empty)

Error: validation message (if any)
```

Keys:
- `Escape`: Back to previous screen
- `j`/`Down`: Move param cursor down (max index 6)
- `k`/`Up`: Move param cursor up
- `Enter`: Enter edit mode for selected parameter
- `e`: Execute the call
- `r`: Reset current parameter to default
- `R`: Reset ALL parameters to defaults

**Screen 4: Parameter Edit View** (`editing_param == true`)

```
"Edit Parameter" (title)

Parameter Name (muted)
[ current_value_with_cursor| ]

esc: cancel | enter: confirm | arrows: move cursor
```

Full text editing with:
- Character insertion at cursor position
- Backspace/Delete support
- Left/Right arrow cursor movement
- Home/End keys
- Enter to confirm and save
- Escape to cancel without saving

For `call_type` (index 0), Enter cycles through the enum: call -> static_call -> delegate_call -> create -> create2 -> call.

**Screen 5: Log Detail View** (`show_log_detail == true`)

```
"Log #N" (title)

Contract: 0x...

Topics (N):
  [0] 0x...
  [1] 0x...

Data:
  0x... (or "(empty)")
```

Keys:
- `Escape`: Back to detail view

#### Call Execution Flow

1. Validates required parameters (caller always required, target required for non-CREATE calls).
2. Calls `blockchain.executeCall(call_params)`.
3. On success: creates a `CallHistoryEntry`, switches to detail view, refreshes entries list.
4. On error: sets `validation_error` message.

Error messages: "No blockchain connection", "Caller address required", "Target address required", "Invalid address length", "Invalid hex format", "Invalid value format", "Invalid gas format", "Execution failed".

#### Fixture Saving

Writes a JSON file to `~/.chop/fixtures/fixture_TIMESTAMP.json` containing:

```json
{
  "params": {
    "call_type": "CALL",
    "caller": "0x...",
    "target": "0x...",
    "value": "0",
    "gas_limit": "1000000"
  },
  "expected_result": {
    "success": true,
    "gas_left": 999000
  },
  "timestamp": 1234567890
}
```

---

### 7.3 Contracts View

**File:** `src/views/contracts.zig`

#### What It Does

Lists deployed contracts and provides an inline bytecode disassembler with a split-pane detail view.

#### State

| Field | Type | Default |
|-------|------|---------|
| `contracts` | `[]const Contract` | `&.{}` |
| `selected_index` | `usize` | 0 |
| `scroll_offset` | `usize` | 0 |
| `show_detail` | `bool` | false |
| `selected_contract` | `?Contract` | null |
| `disassembly` | `?DisassemblyResult` | null |
| `disassembly_error` | `?[]const u8` | null |
| `current_block_index` | `usize` | 0 |
| `instruction_index` | `usize` | 0 |
| `show_goto_pc` | `bool` | false |
| `goto_pc_buffer` | `[16]u8` | zeroed |
| `goto_pc_len` | `usize` | 0 |

#### Sub-Screens (3 total)

**Screen 1: List View**

```
"Contracts" (title)
"Deployed Contracts" (muted subtitle)

Column headers: Address | Size | Deployed
Separator line
Contract rows:
  ">" indicator
  Full address
  "N bytes"
  Timestamp
```

Keys:
- `j`/`Down`: Move selection down
- `k`/`Up`: Move selection up
- `Enter`: Open detail view (triggers disassembly)

**Screen 2: Split Detail View** (`show_detail == true`)

Layout: 40% left panel, 60% right panel, separated by "│" character.

Left panel:
```
"Contract Detail" (title)

Address:
  0x... (value style)

Size: N bytes

Bytecode:
  first 64 chars... (with "..." if longer)
```

Right panel:
```
"Disassembly" (title)
Block N/M (muted)
Separator line
Column headers: PC | OP | Name | Operand
Instruction rows:
  ">" indicator for selected instruction
  PC (4-digit hex, e.g., "0004")
  Opcode hex (2-digit, e.g., "60")
  Opcode name (e.g., "PUSH1")
  Operand hex (e.g., "0x40")
```

Keys:
- `Escape`: Back to list (clears disassembly state)
- `j`/`Down`: Move instruction cursor down within current basic block
- `k`/`Up`: Move instruction cursor up
- `l`/`Right`: Navigate to next basic block (resets instruction index to 0)
- `h`/`Left`: Navigate to previous basic block (resets instruction index to 0)
- `g`: Jump to jump target (finds PUSH operand before current JUMP/JUMPI, navigates to that PC)
- `G`: Open "Goto PC" modal
- `c`: Copy contract address to clipboard

**Screen 3: Goto PC Modal** (`show_goto_pc == true`)

Centered modal dialog (40 wide, 6 tall):

```
----------------------------------------
  Go to PC
  Enter PC (hex): [user_input_]

  esc: cancel | enter: jump
----------------------------------------
```

Keys:
- `Escape`: Close modal, clear buffer
- `Enter`: Parse hex input (handles "0x" prefix), navigate to that PC
- `Backspace`: Delete character
- Hex characters (`0-9`, `a-f`, `A-F`, `x`, `X`): Append to buffer (max 15 chars)

#### Disassembly Trigger

When entering detail view, `triggerDisassembly()` is called:
1. Clears previous disassembly state.
2. Validates contract has bytecode.
3. Calls `core.disassembler.disassemble(allocator, bytecode)`.
4. Stores result or error message.

Error messages: "No contract selected", "Contract has no bytecode", "Invalid bytecode: odd hex length", "Invalid bytecode: invalid hex character", "Out of memory during disassembly".

#### Jump Navigation

`jumpToJumpTarget()`:
1. Gets current instruction.
2. Checks if opcode is JUMP (0x56) or JUMPI (0x57).
3. Looks at previous instruction for a PUSH opcode (0x60-0x7F).
4. Parses the PUSH operand as a target PC.
5. Calls `navigateToPC()` to find the block/instruction at that PC.

`navigateToPC()`: Linear search through all blocks and instructions to find matching PC.

---

### 7.4 Accounts View

**File:** `src/views/accounts.zig`

#### What It Does

Lists pre-funded test accounts with balances. Detail view shows full account info with optional private key reveal.

#### State

| Field | Type | Default |
|-------|------|---------|
| `accounts` | `[]const Account` | `&.{}` |
| `selected_index` | `usize` | 0 |
| `scroll_offset` | `usize` | 0 |
| `show_detail` | `bool` | false |
| `show_private_key` | `bool` | false |
| `confirming_reveal` | `bool` | false |

#### Sub-Screens (2 total)

**Screen 1: List View**

```
"Accounts" (title)
"Pre-funded Test Accounts" (muted subtitle)

Column headers: # | Address | Balance
Separator line (using "─" character)
Account rows:
  ">" indicator
  Account index (1-10)
  Full address
  "N wei" (balance as truncated u64)
```

Note: Uses the Unicode "─" box-drawing character for the separator line (unlike other views that use "-").

Keys:
- `j`/`Down`: Move selection down
- `k`/`Up`: Move selection up
- `Enter`: Open detail view

**Screen 2: Detail View**

```
"Account Detail" (title)

Address:
  0x... (value style, indented)

Balance:
  N wei (value style, indented)

Nonce:
  N (value style, indented)

Code Hash:
  0x... (normal style, indented)

Private Key:
  ******* (press 'p' to reveal) -- initial state
  Press 'p' again to reveal (security risk!) -- confirming state (red)
  0x... -- revealed state (red)
```

Keys:
- `Escape`: Back to list (also resets private key visibility)
- `p`: Toggle private key reveal (two-press confirmation: first press shows warning, second reveals key)
- `c`: Copy address to clipboard

#### Private Key Reveal Flow

1. Initial state: Shows "******* (press 'p' to reveal)" in muted style.
2. First `p` press: Sets `confirming_reveal = true`, shows "Press 'p' again to reveal (security risk!)" in red.
3. Second `p` press: Sets `show_private_key = true`, `confirming_reveal = false`, shows actual key in red.
4. Pressing `p` again toggles `show_private_key` off/on (no re-confirmation needed once confirmed once, until Escape resets).

---

### 7.5 Blocks View

**File:** `src/views/blocks.zig`

#### What It Does

Block explorer showing all blocks with detail view.

#### State

| Field | Type | Default |
|-------|------|---------|
| `blocks` | `[]const Block` | `&.{}` |
| `selected_index` | `usize` | 0 |
| `scroll_offset` | `usize` | 0 |
| `show_detail` | `bool` | false |
| `selected_block` | `?Block` | null |
| `block_transactions` | `[]const Transaction` | `&.{}` |

#### Sub-Screens (2 total)

**Screen 1: List View**

```
"Blocks" (title)
"Block Explorer" (muted subtitle)

Column headers at columns: 2=Block, 12=Hash, 36=Txs, 44=Gas Used, 60=Timestamp
Separator line
Block rows:
  ">" indicator
  "#N" (block number)
  Hash (first 18 chars)
  Transaction count
  Gas used
  Timestamp (numeric)
```

Keys:
- `j`/`Down`: Move selection down
- `k`/`Up`: Move selection up
- `Enter`: Open detail view

**Screen 2: Detail View**

```
"Block #N" (title)

Hash:
  0x... (value style)

Parent Hash:
  0x... (normal style)

Miner:
  0x... (normal style)

Gas Used: N / M
Size: N bytes

Timestamp:
  N (numeric)

TRANSACTIONS (N) section:
Separator line
List of transaction hashes (or "No transactions in this block")
```

Keys:
- `Escape`: Back to list
- `c`: Copy block hash to clipboard

---

### 7.6 Transactions View

**File:** `src/views/transactions.zig`

#### What It Does

Shows all transactions with detail and log drill-down views.

#### State

| Field | Type | Default |
|-------|------|---------|
| `transactions` | `[]const Transaction` | `&.{}` |
| `selected_index` | `usize` | 0 |
| `scroll_offset` | `usize` | 0 |
| `show_detail` | `bool` | false |
| `selected_tx` | `?Transaction` | null |
| `log_selected_index` | `usize` | 0 |
| `show_log_detail` | `bool` | false |

#### Sub-Screens (3 total)

**Screen 1: List View**

```
"Transactions" (title)
"Transaction History" (muted subtitle)

Column headers at columns: 2=Status, 10=Hash, 30=From, 50=To, 70=Gas
Separator line
Transaction rows:
  ">" indicator
  [OK] (green) or [FAIL] (red)
  Hash (first 16 chars)
  From (first 16 chars)
  To (first 16 chars, or "CREATE")
  Gas used
```

Keys:
- `j`/`Down`: Move selection down
- `k`/`Up`: Move selection up
- `Enter`: Open detail view

**Screen 2: Detail View**

```
"Transaction Detail" (title)

Status: SUCCESS (green) or FAILED (red)

Hash:
  0x... (value style)

Block: #N
From:
  0x...
To:
  0x... (or "(Contract Creation)")

Value: N wei
Gas: N / M

Type: CALL/STATICCALL/etc.

Error: (if failed, red)
  error message

Deployed: (if CREATE)
  0x... (green)

LOGS (N) section:
Separator line
Selectable list: "Log N: 0xAddress"
```

Keys:
- `Escape`: Back to list
- `j`/`Down`: Navigate logs
- `k`/`Up`: Navigate logs
- `Enter`: Open log detail
- `c`: Copy transaction hash to clipboard

**Screen 3: Log Detail View**

```
"Log #N" (title)

Contract:
  0x... (value style)

Topics (N):
  [0] 0x...
  [1] 0x...

Data:
  0x... (or "(empty)")
```

Keys:
- `Escape`: Back to detail view

---

### 7.7 Settings View

**File:** `src/views/settings.zig`

#### What It Does

Configuration and administrative actions for the blockchain simulation.

#### State

| Field | Type | Default |
|-------|------|---------|
| `blockchain` | `?*core.Blockchain` | null |
| `selected_option` | `usize` | 0 |
| `confirming_action` | `bool` | false |
| `server_running` | `bool` | false |
| `server_port` | `u16` | 8545 |
| `feedback_message` | `?[]const u8` | null |

#### Layout

```
"Settings" (title)
"Configuration & Options" (muted subtitle)

RPC SERVER section:
Separator line
Status: Running (green) or Stopped (muted)
Port: 8545 (shown when running)
URL: http://localhost:8545 (shown when running, value style)

OPTIONS section:
Separator line
Selectable option list:
  > Server Status
      View RPC server status
    Reset Blockchain State
      Clear all blocks, transactions, and contracts
    Regenerate Test Accounts
      Generate new test account keys
    Export State
      Export current state to JSON

Confirmation dialog: "Are you sure? (y/n)" (red, shown when confirming)
Feedback message (green, shown after action)
```

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j`/`Down` | Move selection down |
| `k`/`Up` | Move selection up |
| `Enter` | Execute selected option |

#### Option Actions

1. **Server Status** (Enter): Toggles `server_running`. Feedback: "Server started" / "Server stopped".
2. **Reset Blockchain State** (Enter): Shows confirmation dialog.
   - `y`/`Y`: Calls `blockchain.reset()`. Feedback: "Blockchain state reset" or "Reset failed".
   - `n`/`N`/`Escape`: Cancels.
3. **Regenerate Test Accounts** (Enter): Shows confirmation dialog.
   - `y`/`Y`: Calls `blockchain.regenerateAccounts()`. Feedback: "Accounts regenerated with new keys" or "Account regeneration failed".
   - `n`/`N`/`Escape`: Cancels.
4. **Export State** (Enter): Calls `exportState()`. Feedback: "State exported to ~/.chop/export.json" or "Export failed - check permissions".

#### Export State

Writes JSON to `~/.chop/export.json`:

```json
{
  "version": "1.0",
  "stats": {
    "block_height": 0,
    "total_transactions": 0,
    "total_accounts": 10,
    "total_contracts": 0
  },
  "accounts": [
    { "address": "0x...", "nonce": 0 },
    ...
  ]
}
```

---

### 7.8 State Inspector View

**File:** `src/views/inspector.zig`

**Note:** This view is defined and initialized but is NOT accessible via any tab in the current implementation. The `getCurrentView()` in root.zig does not include a mapping for it. It appears to be a planned feature.

#### What It Does

Allows querying blockchain state by entering an address. Displays account state including balance, nonce, code, and storage slots.

#### State

| Field | Type | Default |
|-------|------|---------|
| `blockchain` | `?*core.Blockchain` | null |
| `address_buffer` | `[64]u8` | zeroed |
| `address_len` | `usize` | 0 |
| `cursor_pos` | `usize` | 0 |
| `result` | `?AccountState` | null |
| `error_message` | `?[]const u8` | null |
| `is_loading` | `bool` | false |
| `storage_scroll` | `usize` | 0 |

#### Layout

```
"State Inspector" (title)
"Query Blockchain State" (muted subtitle)

Address:
[ 0x..._] (input field with cursor)
  or [0x...] placeholder when empty

Loading... (shown during query)
Error: message (shown on error, red)

ACCOUNT STATE section (when result exists):
Separator line

Address:
  0x... (value style)

Type: Contract or EOA
Balance: N wei
Nonce: N

Code Size: N bytes (if contract)

STORAGE section (if contract):
Separator line
key = value rows (scrollable with j/k)
(or "No storage slots")
```

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Execute query for entered address |
| `Escape` | Clear input, result, and error |
| `Backspace` | Delete character before cursor |
| `Delete` | Delete character at cursor |
| `Left` | Move cursor left |
| `Right` | Move cursor right |
| `Home` | Move cursor to start |
| `End` | Move cursor to end |
| `j` | Scroll storage down (when result shown) |
| `k` | Scroll storage up (when result shown) |
| `c` | Copy result address to clipboard |
| Printable ASCII | Insert character at cursor position |

#### Query Logic

Searches through `blockchain.getAccounts()` for a matching address using string comparison (case-insensitive for the hex portion after "0x"). Creates an `AccountState` with the matched account's data.

---

## 8. CLI Commands

**File:** `src/cli/mod.zig` and `src/cli/commands/*.zig`

### Command Dispatch

All commands support both text output (default) and JSON output (`--json`/`-j` flag).

### Complete Command Reference

#### Conversion Commands (`src/cli/commands/convert.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `keccak` | `keccak256`, `k` | `chop keccak <data>` | Hash data with Keccak-256. Accepts hex (0x...) or raw string input. |
| `to-hex` | `th`, `2h` | `chop to-hex <value>` | Convert decimal or hex number to hex output. |
| `to-dec` | `td`, `2d` | `chop to-dec <value>` | Convert hex or decimal number to decimal output. |
| `to-wei` | `tw`, `2w` | `chop to-wei <amount> [unit]` | Convert ETH amount to wei. Default unit: `ether`. |
| `from-wei` | `fw` | `chop from-wei <wei> [unit]` | Convert wei to ETH amount. Default unit: `ether`. |

**Supported units for to-wei/from-wei:**
- `wei` (1)
- `kwei`, `babbage` (1,000)
- `mwei`, `lovelace` (1,000,000)
- `gwei`, `shannon` (1,000,000,000)
- `szabo`, `microether` (10^12)
- `finney`, `milliether` (10^15)
- `ether`, `eth` (10^18)

Decimal amounts are supported for `to-wei` (e.g., `chop to-wei 1.5 ether`).

#### Address Commands (`src/cli/commands/address.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `to-check-sum-address` | `to-checksum`, `ta`, `2a` | `chop to-checksum <address>` | EIP-55 checksum conversion. |
| `compute-address` | `ca` | `chop compute-address <deployer> <nonce>` | Compute CREATE contract address from deployer+nonce. |
| `create2` | `c2` | `chop create2 <deployer> <salt> <init_code_hash>` | Compute CREATE2 address. Salt and init_code_hash are 32-byte hex values. |
| `address-zero` | `az` | `chop address-zero` | Print zero address (`0x0000...0000`). |

#### Encoding Commands (`src/cli/commands/abi.zig`, `src/cli/commands/rlp.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `abi-encode` | `ae` | `chop abi-encode <signature> [args...]` | ABI encode without selector. |
| `abi-decode` | `ad` | `chop abi-decode <signature> <data>` | ABI decode data. **NOT YET IMPLEMENTED** (returns error). |
| `calldata` | `cd` | `chop calldata <signature> [args...]` | Encode function selector + ABI-encoded args. |
| `to-rlp` | - | `chop to-rlp <data>` | RLP encode hex data. JSON array encoding **NOT YET IMPLEMENTED**. |
| `from-rlp` | - | `chop from-rlp <data>` | RLP decode data. Outputs String or List types. |

**ABI type support:**
- Static types: `address`, `uint8/16/32/64/128/256`, `int8/16/32/64/128/256`, `bool`, `bytes32`
- Dynamic types (`bytes`, `string`): **NOT YET SUPPORTED** (returns `DynamicTypeNotSupported`)
- Signature parsing is simplified: counts commas and returns common patterns (1-3 params).

#### Hex Commands (`src/cli/commands/hex.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `concat-hex` | `ch` | `chop concat-hex <hex1> <hex2> [hex3...]` | Concatenate hex strings (strips 0x prefix from each). |
| `to-utf8` | `tu8`, `2u8` | `chop to-utf8 <hex>` | Convert hex to UTF-8 string. |
| `from-utf8` | `fu`, `fa` | `chop from-utf8 <string>` | Convert UTF-8 string to hex. |

#### Selector Commands (`src/cli/commands/selector.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `sig` | `si` | `chop sig <signature>` | Get function selector (first 4 bytes of keccak256). |
| `sig-event` | `se` | `chop sig-event <signature>` | Get event topic (full 32-byte keccak256 hash). |

#### Utility Commands (`src/cli/commands/util.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `hash-zero` | `hz` | `chop hash-zero` | Print 32-byte zero hash. |
| `max-uint` | `maxu` | `chop max-uint [bits]` | Print max uint value (default: 256 bits). JSON includes both decimal and hex. |
| `max-int` | `maxi` | `chop max-int [bits]` | Print max signed int value (default: 256). |
| `min-int` | `mini` | `chop min-int [bits]` | Print min signed int value (default: 256). |
| `address-zero` | `az` | `chop address-zero` | Print zero address. |

#### ENS Commands (`src/cli/commands/ens.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `namehash` | `na`, `nh` | `chop namehash <name>` | Calculate ENS namehash. Splits name by dots, processes labels in reverse, hashes with keccak256. |

#### Bytecode Commands (`src/cli/commands/bytecode.zig`)

| Command | Aliases | Usage | Description |
|---------|---------|-------|-------------|
| `disassemble` | `da` | `chop disassemble <bytecode>` | Disassemble EVM bytecode. Shows PC, opcode name, PUSH values. |
| `selectors` | `sel` | `chop selectors <bytecode>` | Extract function selectors. Finds PUSH4 instructions followed by DUP2/EQ patterns. |

#### Special Commands

| Command | Action |
|---------|--------|
| `tui` | Returns 255 (launches TUI) |

### JSON Output Format

When `--json` flag is used, all commands wrap output in JSON objects:

```
keccak: {"hash":"0x..."}
to-hex: {"hex":"0x..."}
to-dec: {"decimal":"N"}
to-wei: {"wei":"N"}
from-wei: {"value":"N.NNN"}
to-checksum: {"address":"0x..."}
compute-address: {"address":"0x..."}
create2: {"address":"0x..."}
address-zero: {"address":"0x..."}
hash-zero: {"hash":"0x..."}
max-uint: {"value":"N","hex":"0x..."}
max-int: {"value":"N","hex":"0x..."}
min-int: {"value":"-N","hex":"0x..."}
sig: {"selector":"0x..."}
sig-event: {"topic":"0x..."}
concat-hex: {"hex":"0x..."}
to-utf8: {"string":"..."}
from-utf8: {"hex":"0x..."}
namehash: {"namehash":"0x..."}
abi-encode: {"encoded":"0x..."}
calldata: {"calldata":"0x..."}
to-rlp: {"rlp":"0x..."}
from-rlp: {"type":"string","value":"0x..."} or {"type":"list","items":[...]}
disassemble: {"instructions":[{"pc":N,"opcode":"0x..","name":"...","value":"0x..."},...]}
selectors: {"selectors":["0x...","0x...",...]}
```

---

## 9. Blockchain Simulation Core

**File:** `src/core/blockchain.zig`

### Blockchain Structure

The blockchain simulation wraps an EVM database (`evm.Database`) and maintains parallel tracking lists for UI display.

#### Internal State

| Field | Type |
|-------|------|
| `db` | `evm.Database` |
| `blocks` | `ArrayListUnmanaged(Block)` |
| `transactions` | `ArrayListUnmanaged(Transaction)` |
| `accounts` | `ArrayListUnmanaged(Account)` |
| `contracts` | `ArrayListUnmanaged(Contract)` |
| `call_history` | `ArrayListUnmanaged(CallHistoryEntry)` |
| `stats` | `BlockchainStats` |
| `current_block` | `u64` (default 0) |
| `chain_id` | `u64` (default 1) |
| `gas_price` | `u256` (default 20 gwei = 20,000,000,000) |

### Initialization

1. Creates an `evm.Database`.
2. Creates genesis block (block #0) with:
   - Hash: zero hash
   - Parent hash: zero hash
   - Gas limit: 30,000,000
   - Miner: zero address
   - Timestamp: current time
3. Creates 10 pre-funded test accounts.

### Pre-funded Test Accounts

**These are the same accounts as Hardhat/Anvil default accounts:**

| # | Address | Private Key |
|---|---------|-------------|
| 1 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 2 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 3 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| 4 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| 5 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| 6 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |
| 7 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` |
| 8 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356` |
| 9 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | `0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97` |
| 10 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` |

Each account starts with **10,000 ETH** (10,000 * 10^18 wei).

### EVM Call Execution

`executeCall(params: CallParams) -> CallResult`

1. Parses caller address, value, gas, input data from string parameters.
2. Creates `BlockInfo` with chain_id=1, current block number, current timestamp, gas_limit=30M, post-merge (difficulty=0).
3. Creates `TransactionContext` with gas_limit and chain_id.
4. Initializes `MainnetEvm` with the database, block info, tx context, gas price, and caller.
5. Builds EVM-native call params based on `call_type`:
   - `call`: caller, to, value, input, gas
   - `static_call`: caller, to, input, gas
   - `delegate_call`: caller, to, input, gas
   - `create`: caller, value, init_code, gas
   - `create2`: caller, value, init_code, salt, gas
6. Executes `vm.call(evm_params)`.
7. Converts result: formats addresses/bytes as hex strings, converts logs.

### Reset

`reset()`:
1. Clears transactions, contracts, call_history.
2. Shrinks blocks to just genesis.
3. Resets all stats.
4. Resets all account balances to 10,000 ETH and nonces to 0.
5. Destroys and recreates EVM database.
6. Re-adds test accounts.

### Regenerate Accounts

`regenerateAccounts()`:
1. Clears accounts list.
2. Destroys and recreates EVM database.
3. For each of 10 accounts:
   a. Generates random 32-byte private key using `std.crypto.random`.
   b. Validates non-zero.
   c. Derives public key via secp256k1 scalar multiplication (G * privateKey).
   d. Serializes as uncompressed public key (64 bytes, x || y).
   e. Hashes with Keccak-256.
   f. Takes last 20 bytes of hash as address.
   g. Formats address and private key as hex strings.
   h. Creates account with 10,000 ETH balance.
   i. Adds to EVM database.

### Data Access Methods

| Method | Returns |
|--------|---------|
| `getStats()` | `BlockchainStats` |
| `getAccounts()` | `[]const Account` |
| `getBlocks()` | `[]const Block` |
| `getTransactions()` | `[]const Transaction` |
| `getContracts()` | `[]const Contract` |
| `getCallHistory()` | `[]const CallHistoryEntry` |
| `getRecentBlocks(count)` | Last N blocks |
| `getRecentTransactions(count)` | Last N transactions |

---

## 10. EVM Bytecode Disassembler

**File:** `src/core/disassembler.zig`

### What It Does

Converts EVM bytecode (hex string) into structured disassembly organized into basic blocks.

### Disassembly Process

**Two-pass approach:**

**Pass 1: Parse Instructions**
- Iterates through raw bytes.
- For each byte, looks up opcode name from the 256-entry table.
- For PUSH opcodes (0x60-0x7F), extracts the operand bytes. PUSH1 has 1 operand byte, PUSH32 has 32 bytes. Formats operand as "0x..." hex string.
- Creates `Instruction` struct with pc, opcode, name, operand, size.

**Pass 2: Group into Basic Blocks**
- A new block starts at:
  - JUMPDEST (0x5B) opcodes (if current block is non-empty)
- A block ends after:
  - STOP (0x00)
  - JUMP (0x56)
  - JUMPI (0x57)
  - RETURN (0xF3)
  - REVERT (0xFD)
  - INVALID (0xFE)
  - SELFDESTRUCT (0xFF)
- Remaining instructions form a final block.

### Input Handling

Accepts hex string with or without "0x" prefix. Validates even length and valid hex characters.

### Full Opcode Table

256 entries covering:
- Arithmetic: STOP, ADD, MUL, SUB, DIV, SDIV, MOD, SMOD, ADDMOD, MULMOD, EXP, SIGNEXTEND
- Comparison: LT, GT, SLT, SGT, EQ, ISZERO
- Bitwise: AND, OR, XOR, NOT, BYTE, SHL, SHR, SAR
- Crypto: KECCAK256
- Environment: ADDRESS, BALANCE, ORIGIN, CALLER, CALLVALUE, CALLDATALOAD, CALLDATASIZE, CALLDATACOPY, CODESIZE, CODECOPY, GASPRICE, EXTCODESIZE, EXTCODECOPY, RETURNDATASIZE, RETURNDATACOPY, EXTCODEHASH
- Block: BLOCKHASH, COINBASE, TIMESTAMP, NUMBER, PREVRANDAO, GASLIMIT, CHAINID, SELFBALANCE, BASEFEE, BLOBHASH, BLOBBASEFEE
- Stack/Memory: POP, MLOAD, MSTORE, MSTORE8, SLOAD, SSTORE, JUMP, JUMPI, PC, MSIZE, GAS, JUMPDEST, TLOAD, TSTORE, MCOPY, PUSH0
- PUSH1-PUSH32 (0x60-0x7F)
- DUP1-DUP16 (0x80-0x8F)
- SWAP1-SWAP16 (0x90-0x9F)
- LOG0-LOG4 (0xA0-0xA4)
- System: CREATE, CALL, CALLCODE, RETURN, DELEGATECALL, CREATE2, STATICCALL, REVERT, SELFDESTRUCT
- All unmapped opcodes: "INVALID"

---

## 11. Draw Utilities

**File:** `src/views/draw.zig`

Shared drawing helper functions (also duplicated as local functions in each view file):

### writeString

Writes a string to a surface at a given (col, row) position using proper UTF-8 grapheme iteration. Respects surface width bounds.

### drawLine

Draws a horizontal line of "-" characters at a given row spanning a given width.

### drawStatRow

Draws a label-value pair like "Label: 12345" where the label uses muted style and the value uses amber/value style.

---

## 12. Navigation State Machine

**File:** `src/types.zig` (NavState and AppState)

### AppState Enum

Defines all possible navigation states:

**Main views:** dashboard, call_history, contracts, accounts, blocks, transactions, settings, state_inspector

**Detail views:** call_history_detail, contract_detail, account_detail, block_detail, transaction_detail

**Modal states:** call_param_list, call_param_edit, call_type_edit, call_executing, call_result, log_detail, fixtures_list, confirm_reset, goto_pc

### NavState

A stack-based navigation system with push/pop/peek/clear/depth operations. Currently defined but NOT used by the views -- each view manages its own `show_detail`/`show_params`/etc. booleans independently. This is a candidate for cleanup in the TypeScript port to use a unified navigation stack.

---

## 13. Cross-Cutting Patterns

### Widget Pattern

Every view follows this exact pattern:
1. Struct with state fields and an `allocator`.
2. `init(allocator)` returns the struct with defaults.
3. `widget()` returns a `vxfw.Widget` with type-erased function pointers.
4. `typeErasedEventHandler` and `typeErasedDrawFn` bridge the type erasure.
5. `handleEvent()` processes keyboard events.
6. `draw()` returns a surface.

For the TypeScript port, this maps to React/Ink components with useState hooks.

### List View Pattern

All list views share:
- `selected_index: usize` starting at 0
- `j`/`Down` increments (with bounds check)
- `k`/`Up` decrements (with bounds check)
- `Enter` opens detail view
- `Escape` from detail returns to list
- ">" indicator at column 0 for selected row
- Selected row uses `selected` style (bold, bg_highlight)

### Clipboard Integration

Multiple views support `c` key to copy data to clipboard via `ctx.copyToClipboard()`.

### Data Flow

Data flows one-way from Blockchain to Views:
1. Blockchain is initialized with genesis state.
2. View references are set in `ChopApp.init()`.
3. Views read data through slice references (not reactive).
4. The dashboard has a manual `refresh()` method.
5. History view refreshes entries after executing a call.

For the TypeScript port, consider using reactive state (signals, stores, or React state) to automatically propagate blockchain changes to all views.

### File System Usage

- Fixture saving: `~/.chop/fixtures/fixture_TIMESTAMP.json`
- State export: `~/.chop/export.json`
- Both create `~/.chop/` directory if it does not exist.

### Error Handling

Errors are displayed inline in the view using `styles.styles.err` (red text). No global error overlay or toast system exists. Validation errors in the History view are stored as `?[]const u8` and rendered below the relevant form.

### Unfinished Features

1. **State Inspector**: Fully implemented as a view but not accessible via tab navigation.
2. **ABI decode**: Returns "not yet fully implemented" error.
3. **RLP JSON array encoding**: Returns "not yet implemented" error.
4. **Dynamic ABI types** (bytes, string): Returns `DynamicTypeNotSupported` error.
5. **ABI signature parsing**: Simplified (counts commas, returns common patterns).
6. **NavState stack**: Defined but unused.
7. **Auto-refresh timer**: The `auto_refresh` boolean exists but no actual timer mechanism is implemented.
8. **Scroll offset**: Present in view structs but not used for virtual scrolling.
9. **Block transaction list**: `block_transactions` field exists in BlocksView but is never populated.
