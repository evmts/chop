# Chop: Product Requirements Document

---

## 1. Product Overview

Chop is a cast-compatible Ethereum CLI, TUI, and MCP server. It provides data encoding/decoding, contract interaction, chain queries, bytecode analysis, and a local Anvil-compatible devnet. It operates in three modes: a command-line interface for scripting and one-off operations, a terminal UI for interactive blockchain exploration, and an MCP server for AI agent integration. The primary users are Solidity developers, security researchers, and AI coding agents.

---

## 2. Problem Statement

- **Fragmented tooling**: Ethereum developers use cast for CLI, a separate block explorer for visual inspection, and have no standardized way to give AI agents blockchain access. Chop unifies all three.
- **No TUI explorer**: Existing tools (cast, seth) are CLI-only. Developers context-switch to web block explorers for visual state inspection. Chop provides an in-terminal explorer.
- **AI agent blind spot**: AI coding agents (Claude Code, Codex) cannot natively interact with blockchains. Chop's MCP server gives agents programmatic access to encoding, decoding, state reads, and local simulation.
- **cast lock-in**: cast is Rust-only, not embeddable, and not extensible via JavaScript/TypeScript. Chop provides cast command compatibility in a TypeScript stack that can be imported as a library.

---

## 3. User Personas

### 3.1 Solidity Developer
- Uses CLI for ABI encoding, calldata construction, unit conversion, address checksumming
- Uses TUI to visually monitor local devnet state during development
- Needs cast command compatibility (same names, same flags, same output)

### 3.2 Security Researcher
- Uses CLI for bytecode disassembly, storage slot inspection, selector lookup
- Uses TUI state inspector to examine contract storage layouts
- Needs JSON output for piping into analysis scripts

### 3.3 Protocol Engineer
- Uses local devnet with fork mode to simulate mainnet interactions
- Uses TUI to monitor transaction pools, blocks, and accounts
- Needs snapshot/revert for iterative testing

### 3.4 AI Coding Agent
- Uses MCP server tools for ABI encoding/decoding, contract calls, chain queries
- Uses MCP resources for reading blockchain state via URI templates
- Uses MCP prompts for multi-step workflows (contract analysis, tx debugging)
- Discovers chop via SKILL.md (Claude Code) or AGENTS.md (Codex)

### 3.5 DevOps / CI Pipeline
- Uses CLI in non-interactive mode for automated testing and deployment verification
- Needs deterministic JSON output
- Needs exit codes for pass/fail in scripts

---

## 4. Product Modes

### 4.1 CLI Mode
- Activated when command-line arguments are provided
- Stateless: each invocation is independent
- Output: human-readable by default, JSON with `--json` / `-j`
- Exit codes: 0 = success, 1 = error
- Must work on Node.js and Bun runtimes

### 4.2 TUI Mode
- Activated when no arguments are provided (or with `tui` subcommand)
- Persistent: maintains connection to a local or remote node
- 8 tabbed views with keyboard navigation
- Requires Bun runtime (OpenTUI dependency)
- Dracula-inspired color palette

### 4.3 MCP Server Mode
- Activated via `chop-mcp` binary or `chop mcp` subcommand
- Runs as a long-lived process communicating over stdio or HTTP
- Exposes tools, resources, and prompts per MCP protocol
- Must work on Node.js and Bun runtimes

---

## 5. CLI Requirements

### 5.1 Global Options

| Flag | Aliases | Description |
|------|---------|-------------|
| `--help` | `-h` | Print help and exit 0 |
| `--version` | `-V` | Print version and exit 0 |
| `--json` | `-j` | Output in JSON format |
| `--rpc-url` | `-r` | RPC endpoint URL |

### 5.2 ABI Encoding / Decoding

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `abi-encode` | `ae` | ABI encode arguments (no selector) | signature, args | hex bytes |
| `abi-encode-event` | `aee` | ABI encode event with topics | event signature, args | topics + data |
| `calldata` | `cd` | Encode full calldata (selector + args) | signature, args | hex calldata |
| `abi-decode` | `ad` | Decode ABI-encoded output | signature, hex data | decoded values |
| `calldata-decode` | `cdd` | Decode calldata (with selector) | signature, hex calldata | decoded args |
| `abi-encode-packed` | - | Packed ABI encoding | signature, args | packed hex |

**Flags**: `--packed` on abi-encode for abi.encodePacked behavior.

### 5.3 Address Utilities

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `to-check-sum-address` | `ta` | EIP-55 checksum | address | checksummed address |
| `compute-address` | - | CREATE deployment address | --deployer, --nonce | address |
| `create2` | - | CREATE2 deployment address | --deployer, --salt, --init-code | address |
| `code-size` | - | Get deployed code size | address, --rpc-url | byte count |
| `balance` | `b` | Get ETH balance | address, --rpc-url | balance in wei |
| `nonce` | - | Get account nonce | address, --rpc-url | nonce number |
| `code` | `co` | Get deployed bytecode | address, --rpc-url | hex bytecode |

### 5.4 Data Conversion

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `from-wei` | `fw` | Wei to ether (or unit) | amount, [unit] | converted value |
| `to-wei` | `tw` | Ether (or unit) to wei | amount, [unit] | wei amount |
| `to-hex` | `th` | Decimal to hex | decimal number | 0x-prefixed hex |
| `to-dec` | `td` | Hex to decimal | hex number | decimal number |
| `to-base` | `tb` | Base conversion | value, --base-in, --base-out | converted value |
| `to-bytes32` | - | Pad to 32 bytes | hex or number | 32-byte hex |
| `from-utf8` | `fu` | UTF-8 string to hex | string | hex bytes |
| `to-utf8` | `tu` | Hex to UTF-8 string | hex bytes | string |
| `from-fixed-point` | `ffp` | Fixed-point to decimal | value, decimals | decimal string |
| `to-fixed-point` | `tfp` | Decimal to fixed-point | value, decimals | integer string |
| `to-unit` | - | Convert between named units | value, --from, --to | converted value |
| `from-rlp` | - | Decode RLP data | hex RLP | decoded values |
| `to-rlp` | - | Encode to RLP | values | hex RLP |
| `to-ascii` | - | Hex to ASCII | hex | ASCII string |
| `from-ascii` | - | ASCII to hex | ASCII string | hex bytes |
| `shl` | - | Shift left | value, bits | shifted value |
| `shr` | - | Shift right | value, bits | shifted value |

**Units supported**: wei, gwei, finney, szabo, ether.

### 5.5 Cryptographic Operations

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `keccak` | `k` | Keccak-256 hash | data (text or hex) | 32-byte hash |
| `hash-message` | - | EIP-191 signed message hash | message | hash |
| `sig` | - | 4-byte function selector | function signature | selector hex |
| `sig-event` | `se` | 32-byte event topic | event signature | topic hex |

### 5.6 Contract Interaction

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `call` | `c` | Read-only eth_call | --to, signature, args, --rpc-url | return data |
| `estimate` | - | Estimate gas | --to, signature, args, --rpc-url | gas estimate |
| `send` | `s` | Send transaction | --to, signature, args, --rpc-url, --private-key | tx hash |
| `publish` | - | Publish raw signed tx | raw tx hex, --rpc-url | tx hash |
| `receipt` | `re` | Get transaction receipt | tx hash, --rpc-url | receipt data |
| `run` | - | Execute bytecode locally | bytecode, --rpc-url | execution result |

**Flags for call/send**: `--from`, `--value`, `--gas`, `--gas-price`, `--nonce`, `--block`, `--trace`.

### 5.7 Block & Transaction Queries

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `block` | `bl` | Get block data | number/tag/hash, --rpc-url | block data |
| `block-number` | `bn` | Get latest block number | --rpc-url | number |
| `tx` | - | Get transaction data | tx hash, --rpc-url | tx data |
| `receipt` | `re` | Get transaction receipt | tx hash, --rpc-url | receipt |
| `logs` | - | Get event logs | --address, --topic, --from-block, --to-block, --rpc-url | log entries |
| `gas-price` | - | Get current gas price | --rpc-url | gas price in wei |
| `base-fee` | - | Get base fee | --rpc-url | base fee in wei |
| `chain-id` | `ci` | Get chain ID | --rpc-url | chain ID number |
| `client` | - | Get client version | --rpc-url | version string |
| `find-block` | - | Find block by timestamp | timestamp, --rpc-url | block number |

**Flags for block**: `--full` (include full tx objects).

### 5.8 Storage Operations

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `storage` | `st` | Read storage slot | address, slot, --rpc-url | 32-byte value |
| `proof` | - | Get storage proof | address, slots[], --rpc-url | Merkle proof |
| `index` | - | Compute mapping storage slot | key type, key, slot | computed slot |

### 5.9 Bytecode Analysis

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `disassemble` | `da` | Disassemble EVM bytecode | hex bytecode | opcode listing |
| `4byte` | `4b` | Look up function selector | 4-byte selector | function signatures |
| `4byte-decode` | `4bd` | Decode calldata via 4byte | calldata | decoded call |
| `4byte-event` | `4be` | Look up event topic | 32-byte topic | event signatures |
| `interface` | `iface` | Generate interface from bytecode | hex bytecode or address + --rpc-url | Solidity interface |
| `selectors` | `sel` | List all selectors in bytecode | hex bytecode | selector list |

### 5.10 Signature Database

| Command | Aliases | Description |
|---------|---------|-------------|
| `sig` | - | Compute selector from text signature |
| `sig-event` | - | Compute topic from event signature |
| `4byte` | - | Reverse lookup selector to text |
| `4byte-event` | - | Reverse lookup topic to text |
| `upload-signature` | - | Upload signature to database |

### 5.11 ENS Operations

| Command | Aliases | Description | Inputs | Output |
|---------|---------|-------------|--------|--------|
| `resolve-name` | `rn` | Resolve ENS name to address | name, --rpc-url | address |
| `lookup-address` | `la` | Reverse resolve address to ENS | address, --rpc-url | ENS name |
| `namehash` | `nh` | Compute ENS namehash | name | hash |

### 5.12 Chain & Network Utilities

| Command | Aliases | Description |
|---------|---------|-------------|
| `chain-id` | `ci` | Get chain ID from RPC |
| `client` | - | Get client version from RPC |
| `rpc` | - | Make raw JSON-RPC call |
| `age` | - | Get age of a block (timestamp) |

### 5.13 Local Devnet

| Command | Aliases | Description |
|---------|---------|-------------|
| `node` | `n` | Start local Anvil-compatible devnet |

**Node flags**: See section 7 for full devnet requirements.

---

## 6. TUI Requirements

### 6.1 Global Navigation

- **Tab bar** at top showing all 8 views with active tab highlighted
- **Status bar** at bottom showing: connected RPC, chain ID, latest block, gas price
- **Tab switching**: number keys `1`-`8` or name shortcuts
- **Quit**: `q` or `Ctrl+C`
- **Help overlay**: `?` shows keyboard shortcuts

### 6.2 Dashboard View (Tab 1)

**Layout**: 2x2 grid of summary panels

| Panel | Content |
|-------|---------|
| Chain Info | Chain ID, block number, gas price, base fee, client version |
| Recent Blocks | Last 5 blocks with number, timestamp, tx count, gas used |
| Recent Transactions | Last 10 transactions with hash, from, to, value |
| Account Summary | Test accounts with balances (local devnet) or watched accounts |

**Interactions**: Select any item to navigate to its detail view.

### 6.3 Call History View (Tab 2)

**Layout**: Scrollable table of past EVM calls

| Column | Data |
|--------|------|
| # | Call index |
| Type | CALL / STATICCALL / DELEGATECALL / CREATE / CREATE2 |
| From | Caller address (truncated) |
| To | Target address (truncated) |
| Value | ETH value |
| Gas Used | Gas consumed |
| Status | Success / Revert |

**Interactions**:
- `Enter` on row: expand to show full call details (calldata, return data, logs, gas breakdown, stack trace)
- `j`/`k` or arrow keys: navigate rows
- `/`: filter by address, type, or status
- `Escape`: collapse detail / clear filter

### 6.4 Contracts View (Tab 3)

**Layout**: Split pane - contract list (left), detail (right)

**Left pane**: Known contracts with address, name (if available), code size

**Right pane** (when selected):
- Deployed bytecode (hex, scrollable)
- Disassembled opcodes
- Function selectors with resolved names
- Storage slots (first 10, expandable)

**Interactions**:
- `Enter`: select contract to show detail
- `d`: toggle between bytecode and disassembly view
- `s`: switch to storage slot browser
- `Escape`: back to list

### 6.5 Accounts View (Tab 4)

**Layout**: Scrollable table

| Column | Data |
|--------|------|
| Address | Full address |
| Balance | ETH balance (formatted) |
| Nonce | Transaction count |
| Code | Has code? (contract indicator) |
| Type | EOA / Contract |

**Interactions**:
- `Enter`: show account detail (full balance, storage root, code hash)
- `j`/`k`: navigate
- `f`: fund account (local devnet only, prompts for amount)
- `i`: impersonate account (local devnet only)

### 6.6 Blocks View (Tab 5)

**Layout**: Scrollable table

| Column | Data |
|--------|------|
| Number | Block number |
| Hash | Block hash (truncated) |
| Timestamp | Block timestamp (relative + absolute) |
| Tx Count | Number of transactions |
| Gas Used | Total gas used |
| Gas Limit | Block gas limit |
| Base Fee | Base fee per gas |

**Interactions**:
- `Enter`: show block detail (header fields, transaction list)
- `m`: mine a new block (local devnet only)
- `j`/`k`: navigate

### 6.7 Transactions View (Tab 6)

**Layout**: Scrollable table

| Column | Data |
|--------|------|
| Hash | Tx hash (truncated) |
| Block | Block number |
| From | Sender (truncated) |
| To | Recipient (truncated) |
| Value | ETH value |
| Gas Price | Effective gas price |
| Status | Success / Revert |
| Type | Legacy / EIP-1559 / EIP-4844 |

**Interactions**:
- `Enter`: show transaction detail (full calldata decoded, logs, receipt, trace)
- `j`/`k`: navigate
- `/`: filter by address or status

### 6.8 Settings View (Tab 7)

**Layout**: Form-style key-value pairs

| Setting | Description |
|---------|-------------|
| RPC URL | Connected endpoint |
| Chain ID | Current chain |
| Mining Mode | auto / manual / interval |
| Block Time | Interval mining period |
| Gas Limit | Block gas limit |
| Base Fee | Current base fee |
| Fork URL | Fork source (if forked) |
| Fork Block | Pinned fork block number |

**Interactions**:
- `Enter` on setting: edit value (where applicable)
- Settings changes take effect immediately on local devnet

### 6.9 State Inspector View (Tab 8)

**Layout**: Tree browser

```
Root
├── Account: 0x1234...
│   ├── Balance: 100.0 ETH
│   ├── Nonce: 42
│   ├── Code: 0x6080... (1234 bytes)
│   └── Storage
│       ├── Slot 0: 0x0000...0001
│       ├── Slot 1: 0x0000...abcd
│       └── ...
├── Account: 0x5678...
│   └── ...
```

**Interactions**:
- Arrow keys / `j`/`k`: navigate tree
- `Enter`: expand/collapse node
- `h`/`l`: collapse/expand
- `e`: edit value (local devnet only)
- `/`: search by address or slot
- `x`: toggle hex/decimal display for values

---

## 7. Local Devnet Requirements

### 7.1 Node Startup

| Flag | Description | Default |
|------|-------------|---------|
| `--port` | HTTP RPC port | 8545 |
| `--host` | Bind address | 127.0.0.1 |
| `--chain-id` | Chain ID | 31337 |
| `--accounts` | Number of funded accounts | 10 |
| `--balance` | Initial balance per account (ETH) | 10000 |
| `--mnemonic` | HD wallet mnemonic | default test mnemonic |
| `--derivation-path` | HD derivation path | m/44'/60'/0'/0/ |
| `--block-time` | Auto-mine interval (seconds) | 0 (instant) |
| `--gas-limit` | Block gas limit | 30000000 |
| `--gas-price` | Initial gas price | 0 |
| `--base-fee` | Initial base fee | 1000000000 |
| `--fork-url` | RPC URL to fork from | none |
| `--fork-block-number` | Block number to fork at | latest |
| `--no-mining` | Disable auto-mining | false |
| `--order` | Transaction ordering (fees, fifo) | fees |
| `--silent` | Suppress output | false |
| `--hardfork` | Target hardfork | prague |

### 7.2 Mining Modes

| Mode | Behavior |
|------|----------|
| **Auto** | Mine a block after every transaction |
| **Interval** | Mine a block every N seconds |
| **Manual** | Only mine when explicitly requested via `anvil_mine` or `evm_mine` |

### 7.3 Fork Mode

- Fork from any EIP-1193 compatible RPC endpoint
- Pin to a specific block number (or latest at fork time)
- Lazy state loading: fetch account/storage/code on first access
- Cache fetched state locally
- Local modifications overlay fork cache
- Replay protection: forked chain ID preserved

### 7.4 Account Management

- Pre-fund N accounts from HD mnemonic
- Print account addresses and private keys on startup
- Impersonation: send transactions as any address without private key
- Auto-impersonation mode: all addresses are impersonatable

### 7.5 Snapshot / Revert

- `evm_snapshot`: capture full state, return snapshot ID
- `evm_revert`: restore state to snapshot, invalidate later snapshots
- Multiple snapshot levels supported

### 7.6 Supported RPC Methods

#### Standard Ethereum (eth_*)

| Method | Description |
|--------|-------------|
| `eth_chainId` | Chain ID |
| `eth_blockNumber` | Latest block number |
| `eth_getBalance` | Account balance |
| `eth_getCode` | Contract bytecode |
| `eth_getStorageAt` | Storage slot value |
| `eth_getTransactionCount` | Account nonce |
| `eth_call` | Simulate call |
| `eth_estimateGas` | Estimate gas |
| `eth_sendTransaction` | Send transaction |
| `eth_sendRawTransaction` | Send signed transaction |
| `eth_getBlockByNumber` | Block by number |
| `eth_getBlockByHash` | Block by hash |
| `eth_getTransactionByHash` | Transaction by hash |
| `eth_getTransactionReceipt` | Transaction receipt |
| `eth_getLogs` | Event logs |
| `eth_gasPrice` | Current gas price |
| `eth_accounts` | List accounts |
| `eth_sign` | Sign data |
| `eth_signTransaction` | Sign transaction |
| `eth_getProof` | Merkle proof |
| `eth_feeHistory` | Fee history |
| `eth_maxPriorityFeePerGas` | Priority fee suggestion |
| `eth_newFilter` | Create log filter |
| `eth_newBlockFilter` | Create block filter |
| `eth_newPendingTransactionFilter` | Create pending tx filter |
| `eth_getFilterChanges` | Poll filter |
| `eth_getFilterLogs` | Get filter logs |
| `eth_uninstallFilter` | Remove filter |
| `eth_subscribe` | WebSocket subscription |
| `eth_unsubscribe` | Remove subscription |
| `eth_syncing` | Sync status |
| `eth_coinbase` | Coinbase address |
| `eth_mining` | Mining status |
| `eth_hashrate` | Hash rate |
| `eth_getBlockTransactionCountByHash` | Tx count in block |
| `eth_getBlockTransactionCountByNumber` | Tx count in block |
| `eth_getTransactionByBlockHashAndIndex` | Tx by position |
| `eth_getTransactionByBlockNumberAndIndex` | Tx by position |
| `net_version` | Network version |
| `net_listening` | Listening status |
| `net_peerCount` | Peer count |
| `web3_clientVersion` | Client version |
| `web3_sha3` | Keccak hash |

#### Anvil Extensions (anvil_*)

| Method | Description |
|--------|-------------|
| `anvil_setBalance` | Set account balance |
| `anvil_setCode` | Set account bytecode |
| `anvil_setNonce` | Set account nonce |
| `anvil_setStorageAt` | Set storage slot |
| `anvil_impersonateAccount` | Enable impersonation |
| `anvil_stopImpersonatingAccount` | Disable impersonation |
| `anvil_autoImpersonateAccount` | Toggle auto-impersonation |
| `anvil_mine` | Mine N blocks |
| `anvil_setMinGasPrice` | Set minimum gas price |
| `anvil_setNextBlockBaseFeePerGas` | Set next block base fee |
| `anvil_setCoinbase` | Set coinbase address |
| `anvil_dumpState` | Export full state as JSON |
| `anvil_loadState` | Import state from JSON |
| `anvil_snapshot` | Alias for evm_snapshot |
| `anvil_revert` | Alias for evm_revert |
| `anvil_setBlockTimestampInterval` | Set block time interval |
| `anvil_removeBlockTimestampInterval` | Remove interval |
| `anvil_setBlockGasLimit` | Set block gas limit |
| `anvil_setChainId` | Set chain ID |
| `anvil_enableTraces` | Enable call tracing |
| `anvil_setRpcUrl` | Change fork URL |
| `anvil_reset` | Reset to initial state or new fork |
| `anvil_dropTransaction` | Remove pending tx |
| `anvil_dropAllTransactions` | Clear pending txs |
| `anvil_nodeInfo` | Get node information |

#### EVM Methods (evm_*)

| Method | Description |
|--------|-------------|
| `evm_snapshot` | Capture state snapshot |
| `evm_revert` | Restore state snapshot |
| `evm_increaseTime` | Advance block timestamp |
| `evm_setNextBlockTimestamp` | Set next block timestamp |
| `evm_mine` | Mine a block |
| `evm_setAutomine` | Toggle auto-mining |
| `evm_setIntervalMining` | Set interval mining |

#### Debug Methods (debug_*)

| Method | Description |
|--------|-------------|
| `debug_traceTransaction` | Trace transaction execution |
| `debug_traceCall` | Trace call execution |
| `debug_traceBlockByNumber` | Trace all txs in block |
| `debug_traceBlockByHash` | Trace all txs in block |

#### Compatibility Aliases

- All `anvil_*` methods are also available as `hardhat_*` and `ganache_*`
- `tevm_call`, `tevm_getAccount`, `tevm_setAccount`, `tevm_dumpState`, `tevm_loadState`

---

## 8. MCP Server Requirements

### 8.1 Tools

The MCP server must expose the following tool categories:

| Category | Tools | Description |
|----------|-------|-------------|
| ABI | abi_encode, calldata_encode, abi_decode, calldata_decode | Encoding and decoding |
| Address | checksum_address, compute_address, create2 | Address utilities |
| Crypto | keccak256, sig, sig_event | Hashing and selectors |
| Conversion | from_wei, to_wei, to_hex, to_dec, to_base | Unit/base conversion |
| Contract | call, storage, balance, code, nonce | On-chain reads |
| Chain | block, tx, receipt, chain_id, gas_price | Chain queries |
| Bytecode | disassemble, 4byte, 4byte_event | Bytecode analysis |
| Devnet | node_start, node_mine, node_set_balance, node_snapshot, node_revert | Local node management |

Each tool must have:
- Descriptive name and description (optimized for LLM tool selection)
- Typed input schema (JSON Schema)
- Structured output

### 8.2 Resources

URI-addressable blockchain state:

| URI Template | Description |
|-------------|-------------|
| `chop://account/{address}/balance` | Account balance |
| `chop://account/{address}/nonce` | Account nonce |
| `chop://account/{address}/code` | Contract bytecode |
| `chop://account/{address}/storage/{slot}` | Storage slot value |
| `chop://block/{numberOrTag}` | Block data |
| `chop://tx/{hash}` | Transaction data |
| `chop://receipt/{hash}` | Transaction receipt |
| `chop://chain/id` | Chain ID |
| `chop://chain/gas-price` | Current gas price |
| `chop://node/status` | Local devnet status |
| `chop://node/accounts` | Devnet accounts |

### 8.3 Prompts

Reusable multi-step workflows:

| Prompt | Description |
|--------|-------------|
| `analyze-contract` | Fetch bytecode, disassemble, identify selectors, summarize |
| `debug-tx` | Fetch receipt, check status, decode revert, decode logs |
| `inspect-storage` | Read storage slots, identify layout, map variables |
| `setup-test-env` | Start fork, fund accounts, snapshot |

### 8.4 Transport

- **stdio**: Default for local use with Claude Code
- **HTTP (Streamable HTTP)**: For remote/shared access

---

## 9. AI Agent Integration

### 9.1 Claude Code (SKILL.md)

- Place `SKILL.md` at project root
- Frontmatter: name, description, trigger keywords
- Body: command reference with examples
- Auto-discovered by Claude Code when working in the project

### 9.2 OpenAI Codex (AGENTS.md)

- Place `AGENTS.md` at project root
- Document all commands with usage patterns
- Include installation and common workflows

### 9.3 MCP Registration

- Project-level: `.mcp.json` at project root (committed to repo)
- User-level: `~/.claude.json` (global, personal)

---

## 10. Cast Compatibility

### 10.1 Command Name Parity

Every cast command must have a chop equivalent with the same name and aliases.

### 10.2 Flag Parity

Common flags must use the same names:
- `--rpc-url` / `-r`
- `--json` / `-j`
- `--private-key`
- `--from`
- `--value`
- `--gas`
- `--gas-price`
- `--nonce`
- `--block`

### 10.3 Output Parity

- Default human-readable output must match cast's format
- JSON output must match cast's JSON structure
- Error messages should be similar

### 10.4 Drop-In Goal

Users should be able to alias `cast=chop` and have existing scripts work unchanged for the supported command set.

---

## 11. Output Format Requirements

### 11.1 Human-Readable (Default)

- One value per line for simple outputs
- Table format for list outputs
- Truncated addresses/hashes with `...` for readability
- Color output when terminal supports it (disable with `--no-color` or `NO_COLOR` env)

### 11.2 JSON (`--json`)

- Valid JSON to stdout
- Consistent structure: `{ "result": ... }` for success, `{ "error": { "message": ... } }` for failure
- All numeric values as strings (to preserve precision for uint256)
- All byte values as 0x-prefixed hex strings

### 11.3 Piping

- When stdout is not a TTY, suppress color and progress indicators
- Errors always go to stderr
- Exit code 0 for success, 1 for error (deterministic for scripts)

---

## 12. Non-Functional Requirements

### 12.1 Performance

| Metric | Target |
|--------|--------|
| CLI startup (no-op) | < 100ms |
| ABI encode/decode | < 10ms |
| Keccak hash | < 1ms |
| Local eth_call | < 50ms |
| Fork eth_call (cached) | < 50ms |
| Fork eth_call (cold) | < 2s (network-bound) |
| TUI render frame | < 16ms (60fps) |

### 12.2 Size

| Metric | Target |
|--------|--------|
| npm package (no WASM) | < 5MB |
| WASM EVM module | < 500KB |
| Total installed | < 20MB |

### 12.3 Platform Support

| Platform | CLI | TUI | MCP Server |
|----------|-----|-----|-----------|
| macOS (ARM) | Yes | Yes | Yes |
| macOS (x64) | Yes | Yes | Yes |
| Linux (x64) | Yes | Yes | Yes |
| Linux (ARM) | Yes | Yes | Yes |
| Windows (WSL) | Yes | Best-effort | Yes |
| Windows (native) | Best-effort | No | Best-effort |

### 12.4 Runtime Requirements

| Mode | Runtime |
|------|---------|
| CLI | Node.js >= 22 or Bun >= 1.2 |
| TUI | Bun >= 1.2 (required for OpenTUI) |
| MCP Server | Node.js >= 22 or Bun >= 1.2 |

### 12.5 Compatibility

- EVM: support Frontier through Prague hardforks
- 100% ethereum/tests GeneralStateTests passing (via guillotine-mini WASM)
- JSON-RPC: comply with Ethereum JSON-RPC spec
- MCP: comply with MCP protocol specification

---

## 13. Out of Scope (v1)

The following are explicitly NOT included in v1:

- **Transaction signing with hardware wallets** (Ledger, Trezor)
- **Keystore management** (encrypted keystore files)
- **Multi-chain support** (switching between chains in TUI)
- **Contract verification** (Etherscan source verification)
- **Solidity compilation** (use foundry/hardhat for this)
- **Foundry test runner** (forge test compatibility)
- **WebSocket transport** for devnet (HTTP only in v1)
- **Persistent devnet state** (state is in-memory only)
- **Block explorer web UI** (TUI only, no browser interface)
- **EIP-4337 (Account Abstraction)** bundler operations
- **Blob transaction construction** (read-only blob support only)
- **L2-specific features** (OP Stack, Arbitrum, zkSync specifics)
- **Custom precompile registration** via JavaScript
- **Foundry script compatibility** (forge script)

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **ABI** | Application Binary Interface - encoding standard for EVM function calls |
| **Calldata** | The input data sent with a transaction (4-byte selector + ABI-encoded args) |
| **EIP** | Ethereum Improvement Proposal |
| **ENS** | Ethereum Name Service - human-readable names for addresses |
| **EOA** | Externally Owned Account (not a contract) |
| **EVM** | Ethereum Virtual Machine |
| **Gas** | Unit of computation cost on Ethereum |
| **Hardfork** | Network upgrade that changes consensus rules |
| **Keccak-256** | Hash function used throughout Ethereum |
| **MCP** | Model Context Protocol - Anthropic's standard for AI-tool integration |
| **Merkle Patricia Trie** | Data structure used for Ethereum state storage |
| **Nonce** | Transaction counter per account |
| **RLP** | Recursive Length Prefix - Ethereum serialization format |
| **Selector** | First 4 bytes of keccak256(function signature) |
| **Slot** | 32-byte storage position in a contract |
| **Wei** | Smallest unit of ETH (1 ETH = 10^18 wei) |
| **WASM** | WebAssembly - portable binary format used for EVM engine |
