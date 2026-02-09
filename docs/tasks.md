# Chop: Implementation Tasks & Validation Plan

Ordered task list with acceptance criteria and tests. All tasks satisfied = production ready.

---

## Phase 1: Foundation (CLI Pure Commands)

### T1.1 Project Scaffolding
- [ ] `package.json` with all dependencies
- [ ] `tsconfig.json` with strict mode, ESM, paths
- [ ] `vitest.config.ts` with @effect/vitest
- [ ] `tsup.config.ts` with ESM output
- [ ] `biome.json` with lint + format rules
- [ ] `bin/chop.ts` entry point (stub)
- [ ] `src/shared/types.ts` re-exporting voltaire-effect types
- [ ] `src/shared/errors.ts` with base ChopError

**Validation**:
- `bun run typecheck` passes
- `bun run lint` passes
- `bun run test` passes (empty suite)
- `bun run build` produces `dist/` with entry points

### T1.2 CLI Framework Setup
- [ ] Root command with `--help`, `--version`, `--json` global flags
- [ ] `chop --help` prints categorized command list
- [ ] `chop --version` prints version
- [ ] Exit code 0 for success, 1 for error
- [ ] `--json` flag available on all commands
- [ ] No-args launches TUI stub (prints "TUI not yet implemented")

**Validation**:
- `bun run bin/chop.ts --help` exits 0, prints help
- `bun run bin/chop.ts --version` exits 0, prints version
- `bun run bin/chop.ts nonexistent` exits 1, prints error

### T1.3 ABI Encoding Commands
- [ ] `chop abi-encode <sig> [args...]`
- [ ] `chop abi-encode --packed <sig> [args...]`
- [ ] `chop calldata <sig> [args...]`
- [ ] `chop abi-decode <sig> <data>`
- [ ] `chop calldata-decode <sig> <data>`

**Validation** (tests per command):
- `chop abi-encode "transfer(address,uint256)" 0x1234...abcd 1000000000000000000` → correct hex
- `chop calldata "transfer(address,uint256)" ...` → 0xa9059cbb + encoded args
- `chop abi-decode "balanceOf(address)(uint256)" <data>` → decoded value
- `chop calldata-decode "transfer(address,uint256)" <calldata>` → decoded args
- All commands with `--json` produce valid JSON
- Invalid signature → exit 1, descriptive error
- Wrong arg count → exit 1, descriptive error

### T1.4 Address Utility Commands
- [ ] `chop to-check-sum-address <addr>`
- [ ] `chop compute-address --deployer <addr> --nonce <n>`
- [ ] `chop create2 --deployer <addr> --salt <hex> --init-code <hex>`

**Validation**:
- `chop to-check-sum-address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045` → `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
- `chop compute-address --deployer 0xf39...266 --nonce 0` → known address
- `chop create2 --deployer 0x000...497 --salt 0x00...01 --init-code 0x6080...` → known address
- Invalid address → exit 1

### T1.5 Data Conversion Commands
- [ ] `chop from-wei <amount> [unit]`
- [ ] `chop to-wei <amount> [unit]`
- [ ] `chop to-hex <decimal>`
- [ ] `chop to-dec <hex>`
- [ ] `chop to-base <value> --base-in <n> --base-out <n>`
- [ ] `chop from-utf8 <string>`
- [ ] `chop to-utf8 <hex>`
- [ ] `chop to-bytes32 <value>`
- [ ] `chop from-rlp <hex>`
- [ ] `chop to-rlp <values>`
- [ ] `chop shl <value> <bits>`
- [ ] `chop shr <value> <bits>`

**Validation**:
- `chop from-wei 1000000000000000000` → `1.000000000000000000`
- `chop to-wei 1.5` → `1500000000000000000`
- `chop to-hex 255` → `0xff`
- `chop to-dec 0xff` → `255`
- `chop to-base 255 --base-out 2` → `11111111`
- Overflow/underflow → descriptive error

### T1.6 Cryptographic Commands
- [ ] `chop keccak <data>`
- [ ] `chop sig <signature>`
- [ ] `chop sig-event <signature>`
- [ ] `chop hash-message <message>`

**Validation**:
- `chop keccak "transfer(address,uint256)"` → `0xa9059cbb...` (full 32 bytes)
- `chop sig "transfer(address,uint256)"` → `0xa9059cbb`
- `chop sig-event "Transfer(address,address,uint256)"` → `0xddf252ad...`

### T1.7 Bytecode Analysis Commands
- [ ] `chop disassemble <bytecode>`
- [ ] `chop 4byte <selector>`
- [ ] `chop 4byte-event <topic>`

**Validation**:
- `chop disassemble 0x6080604052` → opcode listing with PC offsets
- `chop 4byte 0xa9059cbb` → `transfer(address,uint256)` (from local or remote DB)
- Empty bytecode → empty output
- Invalid hex → exit 1

### T1.8 Phase 1 Gate
- [ ] All T1.1-T1.7 tasks complete
- [ ] `bun run test` all passing
- [ ] `bun run test:coverage` ≥ 80% on `src/cli/`
- [ ] `bun run lint` clean
- [ ] `bun run typecheck` clean
- [ ] `bun run build` succeeds

---

## Phase 2: EVM + State (Local Devnet Core)

### T2.1 WASM EVM Integration
- [ ] `src/evm/wasm.ts` loads guillotine-mini WASM
- [ ] `EvmWasmService` with `acquireRelease` lifecycle
- [ ] Execute simple bytecode (PUSH1 + STOP)
- [ ] Execute with storage reads (async protocol)
- [ ] Execute with balance reads (async protocol)

**Validation**:
- Unit test: PUSH1 0x42 PUSH1 0x00 MSTORE PUSH1 0x20 PUSH1 0x00 RETURN → returns 0x42 padded
- Unit test: SLOAD yields, provide storage, resumes correctly
- Unit test: WASM cleanup called on scope close

### T2.2 State Services
- [ ] `JournalService` with append, snapshot, restore, commit
- [ ] `WorldStateService` with account + storage CRUD
- [ ] Snapshot/restore semantics for nested calls

**Validation**:
- Unit test: set account → get account → matches
- Unit test: set storage → get storage → matches
- Unit test: snapshot → modify → restore → original values
- Unit test: snapshot → modify → commit → modified values
- Unit test: nested snapshots (depth 3)

### T2.3 Blockchain Services
- [ ] `BlockStoreService` with block CRUD, canonical index
- [ ] `BlockchainService` with genesis, fork choice, events
- [ ] `BlockHeaderValidatorService`

**Validation**:
- Unit test: put block → get by hash → matches
- Unit test: set canonical head → get by number → matches
- Unit test: orphan tracking and resolution
- Unit test: genesis initialization
- Unit test: header validation (gas limit bounds, base fee, timestamp)

### T2.4 Host Adapter
- [ ] Bridge WASM async protocol to WorldState
- [ ] Storage reads: WASM yields → HostAdapter fetches from WorldState → WASM resumes
- [ ] Balance, code, nonce reads same pattern

**Validation**:
- Integration test: deploy contract (CREATE) → storage is set
- Integration test: call contract → reads storage correctly
- Integration test: nested calls with snapshot/restore

### T2.5 Node Layer Composition (Local Mode)
- [ ] `TevmNode.Local()` layer composes all services
- [ ] Single `Effect.provide` at composition root
- [ ] All services accessible via TevmNodeService

**Validation**:
- Integration test: create node → execute simple call → get result
- Integration test: create node → set balance → get balance → matches
- Integration test: create node → deploy contract → call contract → correct return

### T2.6 Core Handlers
- [ ] `callHandler` (eth_call)
- [ ] `getBalanceHandler`
- [ ] `getCodeHandler`
- [ ] `getStorageAtHandler`
- [ ] `getTransactionCountHandler` (nonce)
- [ ] `blockNumberHandler`
- [ ] `chainIdHandler`

**Validation**:
- Unit test per handler with mocked node

### T2.7 Core Procedures + RPC Server
- [ ] JSON-RPC request parsing
- [ ] Method routing (method name → procedure)
- [ ] eth_call, eth_getBalance, eth_getCode, eth_getStorageAt, eth_getTransactionCount
- [ ] eth_blockNumber, eth_chainId
- [ ] HTTP server on configurable port
- [ ] Batch request support

**Validation**:
- RPC test: `eth_chainId` → `"0x7a69"` (31337)
- RPC test: `eth_blockNumber` → `"0x0"`
- RPC test: `eth_call` with deployed contract → correct return
- RPC test: batch request → batch response
- RPC test: unknown method → -32601 error
- RPC test: invalid JSON → -32700 error

### T2.8 CLI RPC Commands
- [ ] `chop call --to <addr> <sig> [args] -r <url>`
- [ ] `chop balance <addr> -r <url>`
- [ ] `chop nonce <addr> -r <url>`
- [ ] `chop code <addr> -r <url>`
- [ ] `chop storage <addr> <slot> -r <url>`
- [ ] `chop block-number -r <url>`
- [ ] `chop chain-id -r <url>`

**Validation**:
- E2E test: start chop node → `chop balance` → correct value
- E2E test: start chop node → deploy contract → `chop call` → correct return

### T2.9 `chop node` Command
- [ ] `chop node` starts HTTP server, prints banner with accounts
- [ ] `chop node --port <n>` binds to specified port
- [ ] `chop node --chain-id <n>` sets chain ID
- [ ] `chop node --accounts <n>` creates N funded accounts
- [ ] Ctrl+C graceful shutdown

**Validation**:
- E2E test: `chop node` starts, responds to `eth_chainId`
- E2E test: `chop node --chain-id 42` → `eth_chainId` returns 42
- E2E test: `chop node --accounts 5` → `eth_accounts` returns 5 addresses

### T2.10 Phase 2 Gate
- [ ] All T2.1-T2.9 tasks complete
- [ ] `bun run test` all passing
- [ ] `bun run test:coverage` ≥ 80% on `src/evm/`, `src/state/`, `src/blockchain/`, `src/node/`
- [ ] RPC compatibility tests pass for implemented methods

---

## Phase 3: Full Devnet (Anvil Compatibility)

### T3.1 Transaction Processing
- [ ] `sendTransactionHandler` with nonce, gas, balance validation
- [ ] Transaction pool (pending, queued)
- [ ] Intrinsic gas calculation
- [ ] EIP-1559 fee calculation
- [ ] Transaction receipt generation

**Validation**:
- RPC test: `eth_sendTransaction` → returns tx hash
- RPC test: `eth_getTransactionReceipt` → has status, gasUsed, logs
- RPC test: insufficient balance → error
- RPC test: nonce too low → error

### T3.2 Mining
- [ ] Auto-mine mode (mine after each tx)
- [ ] Manual mine (`anvil_mine`, `evm_mine`)
- [ ] Interval mining (`evm_setIntervalMining`)
- [ ] Block building (header, tx ordering, gas accumulation)
- [ ] Block finalization (state root, receipt root)

**Validation**:
- RPC test: auto-mine → send tx → block number increments
- RPC test: manual mine → send tx → block number unchanged → mine → increments
- RPC test: `anvil_mine` with block count → correct number of blocks
- RPC test: block has correct tx count and gas used

### T3.3 Snapshot / Revert
- [ ] `evm_snapshot` returns snapshot ID
- [ ] `evm_revert` restores to snapshot
- [ ] Multiple snapshot levels
- [ ] Revert invalidates later snapshots

**Validation**:
- RPC test: set balance → snapshot → change balance → revert → original balance
- RPC test: nested snapshots (3 deep) with partial reverts

### T3.4 Account Management
- [ ] `anvil_setBalance`
- [ ] `anvil_setCode`
- [ ] `anvil_setNonce`
- [ ] `anvil_setStorageAt`
- [ ] `anvil_impersonateAccount` / `anvil_stopImpersonatingAccount`
- [ ] `anvil_autoImpersonateAccount`

**Validation**:
- RPC test per method: set → get → matches
- RPC test: impersonate → send tx as impersonated address → succeeds
- RPC test: stop impersonation → send tx → fails

### T3.5 Fork Mode
- [ ] `HttpTransport` with retry, timeout, batch
- [ ] `ForkConfigFromRpc` resolves chain ID + block number
- [ ] Lazy state loading (account fetched on first access)
- [ ] Fork cache (don't re-fetch)
- [ ] Local modifications overlay fork
- [ ] `chop node --fork-url <url>` works
- [ ] `chop node --fork-url <url> --fork-block-number <n>` pins block

**Validation**:
- Integration test: fork mainnet → read USDC balance → matches actual
- Integration test: fork → set balance → read → new balance
- Integration test: fork → read storage → matches actual
- Integration test: fork → call contract → correct return

### T3.6 Remaining eth_* Methods
- [ ] eth_getBlockByNumber, eth_getBlockByHash
- [ ] eth_getTransactionByHash
- [ ] eth_getTransactionReceipt
- [ ] eth_getLogs
- [ ] eth_gasPrice, eth_maxPriorityFeePerGas
- [ ] eth_estimateGas
- [ ] eth_feeHistory
- [ ] eth_accounts, eth_sign
- [ ] eth_getProof
- [ ] eth_newFilter, eth_getFilterChanges, eth_uninstallFilter
- [ ] eth_newBlockFilter, eth_newPendingTransactionFilter
- [ ] eth_sendRawTransaction
- [ ] net_version, net_listening, net_peerCount
- [ ] web3_clientVersion, web3_sha3
- [ ] eth_getBlockTransactionCountByHash/Number
- [ ] eth_getTransactionByBlockHashAndIndex/NumberAndIndex

**Validation**:
- RPC test per method with known inputs and expected outputs

### T3.7 Remaining anvil_* / evm_* Methods
- [ ] anvil_dumpState, anvil_loadState
- [ ] anvil_reset
- [ ] anvil_setMinGasPrice, anvil_setNextBlockBaseFeePerGas
- [ ] anvil_setCoinbase, anvil_setBlockGasLimit
- [ ] anvil_setBlockTimestampInterval, anvil_removeBlockTimestampInterval
- [ ] anvil_setChainId, anvil_setRpcUrl
- [ ] anvil_dropTransaction, anvil_dropAllTransactions
- [ ] anvil_enableTraces, anvil_nodeInfo
- [ ] evm_increaseTime, evm_setNextBlockTimestamp
- [ ] evm_setAutomine

**Validation**:
- RPC test per method

### T3.8 Debug Methods
- [ ] debug_traceTransaction
- [ ] debug_traceCall
- [ ] debug_traceBlockByNumber
- [ ] debug_traceBlockByHash

**Validation**:
- RPC test: trace simple transfer → has expected trace entries
- RPC test: trace reverted call → trace shows revert point

### T3.9 Remaining CLI Commands
- [ ] `chop block <number|tag> -r <url>`
- [ ] `chop tx <hash> -r <url>`
- [ ] `chop receipt <hash> -r <url>`
- [ ] `chop logs --address <addr> --topic <topic> -r <url>`
- [ ] `chop gas-price -r <url>`
- [ ] `chop base-fee -r <url>`
- [ ] `chop send --to <addr> <sig> [args] --private-key <key> -r <url>`
- [ ] `chop estimate --to <addr> <sig> [args] -r <url>`
- [ ] `chop resolve-name <name> -r <url>`
- [ ] `chop lookup-address <addr> -r <url>`
- [ ] `chop namehash <name>`
- [ ] `chop rpc <method> [params] -r <url>`
- [ ] `chop find-block <timestamp> -r <url>`

**Validation**:
- E2E test per command

### T3.10 Compatibility Aliases
- [ ] All `anvil_*` methods available as `hardhat_*`
- [ ] All `anvil_*` methods available as `ganache_*`

**Validation**:
- RPC test: `hardhat_setBalance` → same as `anvil_setBalance`

### T3.11 Phase 3 Gate
- [ ] All T3.1-T3.10 tasks complete
- [ ] Full RPC compatibility test suite passes
- [ ] `bun run test:coverage` ≥ 80% overall
- [ ] Fork mode works against mainnet/testnet RPCs

---

## Phase 4: TUI

### T4.1 TUI Framework Setup
- [ ] OpenTUI initializes with Dracula theme
- [ ] App component with tab bar and status bar
- [ ] Tab switching via number keys
- [ ] Quit via `q` or `Ctrl+C`
- [ ] Help overlay via `?`

**Validation**:
- TUI test: launch → tab bar visible with 8 tabs
- TUI test: press `2` → Call History active
- TUI test: press `?` → help overlay visible
- TUI test: press `q` → exits

### T4.2 Dashboard View
- [ ] 2x2 grid: Chain Info, Recent Blocks, Recent Transactions, Accounts
- [ ] Auto-updates when blocks are mined

**Validation**:
- TUI test: dashboard shows chain ID, block number
- TUI test: mine block → dashboard updates

### T4.3 Call History View
- [ ] Scrollable table of calls
- [ ] Detail pane on Enter (calldata, return data, logs, gas)
- [ ] Filter via `/`

**Validation**:
- TUI test: make call → appears in history
- TUI test: select call → detail shows calldata

### T4.4 Contracts View
- [ ] Contract list with addresses and code sizes
- [ ] Disassembly view
- [ ] Selector list with names
- [ ] Storage browser

**Validation**:
- TUI test: deploy contract → appears in list
- TUI test: select → disassembly visible
- TUI test: press `d` → toggles view

### T4.5 Accounts View
- [ ] Account table with balance, nonce, type
- [ ] Fund account via `f` (devnet only)
- [ ] Impersonate via `i` (devnet only)

**Validation**:
- TUI test: 10 test accounts visible
- TUI test: press `f` → fund prompt → balance updates

### T4.6 Blocks View
- [ ] Block table with number, hash, timestamp, tx count, gas
- [ ] Mine via `m` (devnet only)
- [ ] Block detail on Enter

**Validation**:
- TUI test: press `m` → new block appears
- TUI test: select block → detail shows header fields

### T4.7 Transactions View
- [ ] Transaction table with hash, from, to, value, status
- [ ] Detail on Enter (decoded calldata, logs, receipt)
- [ ] Filter via `/`

**Validation**:
- TUI test: send tx → appears in list
- TUI test: select → decoded calldata visible

### T4.8 Settings View
- [ ] Displays all node settings
- [ ] Editable settings (mining mode, gas limit)

**Validation**:
- TUI test: shows chain ID, mining mode
- TUI test: change mining mode → takes effect

### T4.9 State Inspector View
- [ ] Tree browser for accounts → storage
- [ ] Expand/collapse with Enter or h/l
- [ ] Hex/decimal toggle with `x`
- [ ] Edit values with `e` (devnet only)
- [ ] Search with `/`

**Validation**:
- TUI test: expand account → shows balance, nonce, storage
- TUI test: press `x` → values toggle format
- TUI test: press `e` → edit prompt → value updates

### T4.10 Phase 4 Gate
- [ ] All T4.1-T4.9 tasks complete
- [ ] TUI E2E tests pass
- [ ] VHS golden file tests pass
- [ ] All 8 views render correctly

---

## Phase 5: MCP + AI Integration

### T5.1 MCP Server Setup
- [ ] `bin/chop-mcp.ts` entry point
- [ ] stdio transport
- [ ] Server info (name, version, capabilities)

**Validation**:
- MCP test: initialize → returns server info
- MCP test: list tools → returns tool list

### T5.2 MCP Tools
- [ ] All ABI tools (encode, decode, calldata)
- [ ] All address tools (checksum, compute, create2)
- [ ] All crypto tools (keccak, sig)
- [ ] All conversion tools (from-wei, to-wei, to-hex, to-dec)
- [ ] All contract tools (call, storage, balance)
- [ ] All chain tools (block, tx, receipt)
- [ ] All bytecode tools (disassemble, 4byte)
- [ ] All devnet tools (node_start, mine, set_balance, snapshot, revert)

**Validation**:
- MCP test per tool: invoke with valid input → correct output
- MCP test per tool: invoke with invalid input → isError: true

### T5.3 MCP Resources
- [ ] Resource templates registered
- [ ] `chop://account/{address}/balance` works
- [ ] `chop://account/{address}/storage/{slot}` works
- [ ] `chop://block/{numberOrTag}` works
- [ ] `chop://tx/{hash}` works
- [ ] `chop://node/status` works
- [ ] `chop://node/accounts` works

**Validation**:
- MCP test: list resource templates → all present
- MCP test: read each resource → correct content

### T5.4 MCP Prompts
- [ ] `analyze-contract` prompt
- [ ] `debug-tx` prompt
- [ ] `inspect-storage` prompt
- [ ] `setup-test-env` prompt

**Validation**:
- MCP test: list prompts → all present
- MCP test: get prompt → returns messages

### T5.5 Skill + Agent Files
- [ ] `SKILL.md` at project root
- [ ] `AGENTS.md` at project root
- [ ] `.mcp.json` at project root

**Validation**:
- Files exist with correct content
- SKILL.md has frontmatter with triggers
- .mcp.json has valid server config

### T5.6 Phase 5 Gate
- [ ] All T5.1-T5.5 tasks complete
- [ ] MCP protocol tests pass
- [ ] Claude Code can discover and use chop tools

---

## Phase 6: Polish

### T6.1 VHS Demos
- [ ] `demos/theme.tape` with Dracula settings
- [ ] `demos/cli-overview.tape`
- [ ] `demos/cli-abi-encoding.tape`
- [ ] `demos/cli-conversions.tape`
- [ ] `demos/tui-navigation.tape`
- [ ] Generated GIFs committed

**Validation**:
- All tape files run without errors
- GIFs render correctly

### T6.2 Golden File Tests
- [ ] `tests/golden/cli-help.tape` + `.txt`
- [ ] `tests/golden/cli-abi-encode.tape` + `.txt`
- [ ] `scripts/test-golden.sh` works
- [ ] `scripts/update-golden.sh` works

**Validation**:
- `bun run test:golden` passes

### T6.3 Documentation
- [ ] README.md with installation, quick start, demo GIFs
- [ ] CLAUDE.md with project context
- [ ] All `--help` text is accurate and complete

### T6.4 Performance Benchmarks
- [ ] CLI startup < 100ms
- [ ] ABI encode/decode < 10ms
- [ ] Keccak hash < 1ms
- [ ] Local eth_call < 50ms
- [ ] npm package size < 5MB

**Validation**:
- Benchmark tests with threshold assertions

### T6.5 npm Publishing
- [ ] `package.json` has correct metadata
- [ ] `files` field includes only needed files
- [ ] `bin` field points to correct entry points
- [ ] `prepublishOnly` runs build
- [ ] `npm pack` produces valid tarball

**Validation**:
- `npm pack --dry-run` lists expected files
- Tarball installs and runs correctly

### T6.6 Phase 6 Gate (v0.1.0 Release)
- [ ] All T6.1-T6.5 tasks complete
- [ ] Full test suite passes (`bun run test && bun run test:e2e && bun run test:golden`)
- [ ] `bun run lint && bun run typecheck` clean
- [ ] Performance benchmarks pass
- [ ] README is accurate and complete
- [ ] `npm publish` succeeds

---

## Dependency Graph

```
T1.1 → T1.2 → T1.3, T1.4, T1.5, T1.6, T1.7 (parallel) → T1.8
                                                              │
T2.1, T2.2, T2.3 (parallel) → T2.4 → T2.5 → T2.6 → T2.7 → T2.8, T2.9 → T2.10
                                                                            │
T3.1 → T3.2 → T3.3, T3.4 → T3.5 → T3.6, T3.7, T3.8, T3.9 (parallel) → T3.10 → T3.11
                                                                                     │
T4.1 → T4.2 → T4.3-T4.9 (parallel) → T4.10
                                         │
T5.1 → T5.2, T5.3, T5.4 (parallel) → T5.5 → T5.6
                                                │
T6.1, T6.2, T6.3, T6.4, T6.5 (parallel) → T6.6
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | T1.1–T1.8 | CLI pure commands (no RPC/EVM) |
| 2 | T2.1–T2.10 | EVM + state + local devnet core |
| 3 | T3.1–T3.11 | Full Anvil compatibility + fork mode |
| 4 | T4.1–T4.10 | TUI with 8 views |
| 5 | T5.1–T5.6 | MCP server + AI integration |
| 6 | T6.1–T6.6 | Polish, demos, benchmarks, release |

**Total: 55 tasks across 6 phases.**
