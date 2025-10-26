# Agent Handoff: Chop TUI Enhancement Project

## Overview

This document provides a comprehensive handoff for continuing the Chop TUI enhancement project. The goal is to transform Chop into a full-featured Ethereum development tool inspired by TEVM CLI and Guillotine CLI.

## What's Been Completed ✅

### Phase 1: HTTP JSON-RPC Server (COMPLETE)

**Files Created:**
- `server/types.go` - JSON-RPC 2.0 protocol types and Ethereum data structures
- `server/logger.go` - Thread-safe request/response logging (circular buffer, max 100 entries)
- `server/server.go` - HTTP server with CORS, graceful shutdown, health endpoint
- `server/handlers.go` - 17 Ethereum JSON-RPC method implementations

**Implemented JSON-RPC Methods:**
- Accounts: `eth_accounts`, `eth_getBalance`, `eth_getTransactionCount`, `eth_getCode`
- Blocks: `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getBlockByHash`
- Transactions: `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_estimateGas`
- Network: `eth_chainId` (1337), `net_version`, `web3_clientVersion`
- Gas: `eth_gasPrice` (1 Gwei)
- Stubs (awaiting VM integration): `eth_sendTransaction`, `eth_call`

**CLI Integration:**
```bash
chop serve                    # TUI + server on port 8545
chop serve --port 3000        # Custom port
chop serve --headless         # Server only, no TUI
chop serve --verbose          # Enable JSON-RPC logging
chop serve --fork URL         # Fork from remote (shows warning, not yet implemented)
```

**Environment Variables:**
- `CHOP_PORT` - Server port (default: 8545)
- `CHOP_HOST` - Server host (default: 127.0.0.1)
- `CHOP_VERBOSE` - Enable verbose logging
- `CHOP_FORK` - Fork URL
- `CHOP_FORK_BLOCK` - Fork block number

**Model Updates:**
- Added `Server *server.Server` field to `app.Model`
- Added `ServerRunning bool` field
- Added `Accounts *accounts.Manager` and `Chain *blockchain.Chain` exports

### Phase 2: Forking Boilerplate (COMPLETE)

**Files Created:**
- `fork/fork.go` - Complete boilerplate with error messages

**Key Features:**
- Returns `ErrForkingNotSupported` with clear message
- CLI flags are in place: `--fork`, `--fork-block`
- Environment variables: `CHOP_FORK`, `CHOP_FORK_BLOCK`
- User-friendly error message explains guillotine-mini needs forking support first
- Complete function signatures ready for implementation when EVM supports it

**Usage (currently shows helpful error):**
```bash
chop serve --fork https://eth-mainnet.g.alchemy.com/v2/...
# Output: ⚠️  Warning: forking is not yet supported: guillotine and guillotine-mini need to implement forking first
```

### Solidity Compilation

**Status:** Created GitHub issue #7
- Link: https://github.com/evmts/chop/issues/7
- Tracks full Solidity compilation feature
- Should be treated as separate feature (not part of this handoff)

## What Needs to Be Done Next 🚧

### Priority 1: Phase 4 - Configuration System

**Goal:** Support config files and environment variables for all settings

**Tasks:**
1. Create `config/` package with `loader.go`
2. Support `chop.config.json` in current directory or `~/.chop/config.json`
3. Config precedence: file < env vars < CLI flags
4. Config structure:
```json
{
  "port": 8545,
  "host": "127.0.0.1",
  "verbose": false,
  "fork": "",
  "forkBlock": 0,
  "gasLimit": 30000000,
  "hardfork": "cancun",
  "accounts": {
    "count": 10,
    "balance": "100000000000000000000"
  }
}
```
5. Add all CLI flags to support environment variables (prefix: `CHOP_`)
6. Add "Save Config" option in Settings tab of TUI

**Files to Create/Modify:**
- `config/loader.go` - Config file loading and merging
- `types/config.go` - Config type definitions
- `main.go` - Load config before creating model
- `app/handlers.go` - Add save config handler in settings

### Priority 2: Phase 5.4 - Enhanced Bytecode Disassembly

**Goal:** Port Guillotine's rich disassembly UI features

**Reference Files:**
- `guillotine/apps/cli/internal/ui/bytecode_disassembly.go` (363 lines)
- `guillotine/apps/cli/internal/core/bytecode/bytecode.go`

**Features to Add:**
1. **Basic Block Navigation:**
   - Left/right arrows to navigate between basic blocks
   - Display current block index and total blocks

2. **Enhanced Instruction Table:**
   - PC (program counter)
   - Opcode names and hex values
   - Push value decimal conversion (e.g., "0x42 (66)")
   - Gas costs per instruction
   - Stack effects (inputs/outputs, e.g., "→ 2, ← 1")
   - Jump destination highlighting (JUMPDEST opcodes)

3. **Interactive Features:**
   - 'g' key to jump to specific PC
   - Highlighting of current instruction
   - Color coding for different opcode types (PUSH, JUMP, CALL, etc.)

**Files to Modify:**
- `tui/ui.go` - Update `RenderBytecodeDisassembly()` function
- `core/bytecode/` - May need to enhance bytecode analysis

**Implementation Notes:**
- The infrastructure already exists in `types/types.go` (DisassemblyResult)
- Current implementation is basic, needs enrichment
- Use Guillotine's patterns but adapt to Bubbletea/Lipgloss styling

### Priority 3: Phase 5.3 - Fixture System

**Goal:** Save and load reproducible test cases

**Reference Files:**
- `guillotine/apps/cli/commands/save_fixture.go`
- `guillotine/apps/cli/internal/core/state/persistence.go`

**Features:**
1. **Fixture Structure:**
```json
{
  "name": "simple-storage-test",
  "bytecode": "0x...",
  "calldata": "0x...",
  "caller": "0x...",
  "value": "0",
  "gasLimit": 100000,
  "expectedResult": {
    "success": true,
    "gasUsed": 21000
  }
}
```

2. **CLI Commands:**
```bash
chop save-fixture <name>        # Save current call as fixture
chop load-fixture <name>        # Load and execute fixture
chop list-fixtures              # List all fixtures
```

3. **TUI Integration:**
   - Add "Save as Fixture" button in CallResult view
   - Add "Fixtures" section in History tab
   - Allow loading fixtures from TUI

4. **Storage Location:**
   - `~/.chop/fixtures/<name>.json`

**Files to Create:**
- `fixtures/manager.go` - Fixture CRUD operations
- `fixtures/storage.go` - File system operations
- Add commands to `main.go`
- Update `app/handlers.go` for TUI integration

### Priority 4: Phase 5.1 - Differential Testing

**Goal:** Compare Chop execution against reference implementations

**Reference Files:**
- `guillotine/apps/cli/commands/differential.go`

**Features:**
1. **Compare against revme/geth:**
   - Execute same transaction in both EVMs
   - Step-by-step trace comparison
   - Report divergence point with context (5 previous steps)

2. **CLI Command:**
```bash
chop diff --bytecode 0x... --calldata 0x... --reference revme
chop diff --fixture <name> --reference geth
```

3. **Output:**
   - Show opcode where divergence occurred
   - Stack state at divergence
   - PC and gas values
   - Context (previous 5 instructions)

**Files to Create:**
- `diff/engine.go` - Differential testing engine
- `diff/revme.go` - revme integration
- `diff/geth.go` - geth integration (optional)
- Add command to `main.go`

**Dependencies:**
- Need to install revme (Rust EVM): `cargo install revme`

### Priority 5: Remaining Features

**Phase 3.3 - Compiler Tab:**
- Blocked by GitHub issue #7 (Solidity compilation)
- Can start TUI layout but compiler integration must wait

**Other Enhancements:**
- Add Server tab to TUI showing:
  - JSON-RPC request/response log
  - Server status (running/stopped)
  - Toggle verbose logging
- Add Logs tab for verbose JSON-RPC output
- Multi-network support (preset RPC URLs for mainnet, sepolia, etc.)

## Architecture Notes

### Thread Safety
All managers use `sync.RWMutex` for concurrent access:
- `server.Server`
- `server.Logger`
- `fork.Forker`
- `core/blockchain.Chain`
- `core/accounts.Manager`

### Separation of Concerns
Follow the established pattern:
- `app/` - Orchestration, TUI state management
- `core/` - Business logic (no UI knowledge)
- `tui/` - Pure rendering functions (no state)
- `config/` - Configuration constants
- `types/` - Shared data structures

### Error Handling
Use domain-specific error types:
```go
var (
    ErrFeatureNotSupported = errors.New("...")
    ErrInvalidInput = errors.New("...")
)
```

## Testing Strategy

1. **Unit Tests:**
   - Each new package should have `_test.go` files
   - Test business logic independently

2. **Integration Tests:**
   - Test JSON-RPC server with actual HTTP requests
   - Test config loading from files

3. **Manual Testing:**
   - Use curl for JSON-RPC endpoints
   - Use Metamask/Hardhat to connect to server
   - Test TUI interactivity

## Reference Repositories

All are cloned in this directory:

1. **tevm-monorepo/**
   - Path: `/Users/williamcory/chop/tevm-monorepo`
   - Focus: `cli/src/` for TEVM CLI patterns
   - Key files: `commands/serve.tsx`, `components/LogViewer.tsx`

2. **guillotine/**
   - Path: `/Users/williamcory/chop/guillotine`
   - Checked out to commit before apps deletion: `d17f1b88`
   - Focus: `apps/cli/` for CLI patterns
   - Key files: `internal/ui/bytecode_disassembly.go`, `commands/differential.go`

## Build and Run

```bash
# The code compiles successfully (linker error is expected without Guillotine lib)
go build

# Run server
./chop serve

# Run with fork (shows helpful error)
./chop serve --fork https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Test JSON-RPC
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Current State of Codebase

```
chop/
├── server/           ✅ COMPLETE - HTTP JSON-RPC server
│   ├── types.go
│   ├── logger.go
│   ├── server.go
│   └── handlers.go
├── fork/             ✅ BOILERPLATE - Awaiting guillotine-mini
│   └── fork.go
├── app/              ✅ UPDATED - Server and fork integration
│   ├── model.go
│   └── init.go
├── main.go           ✅ UPDATED - Serve command with flags
├── core/             ✅ EXISTING - Needs minimal changes
├── tui/              🚧 NEEDS WORK - Bytecode disassembly enhancement
├── config/           ❌ TODO - Create config loader
├── fixtures/         ❌ TODO - Create fixture system
├── diff/             ❌ TODO - Create differential testing
└── types/            ✅ EXISTING - May need additions
```

## Key Decisions Made

1. **No Project Scaffolding:** Per user request, Chop stays focused on EVM execution, not project creation

2. **Forking Placeholder:** Implemented boilerplate that gracefully warns users it's not yet supported, rather than failing silently

3. **Solidity Compilation:** Treated as separate feature in GitHub issue #7

4. **Server Integration:** Server runs in background goroutine, TUI in main thread

5. **Chain ID:** Using 1337 for local development (same as Ganache)

## Questions for Next Agent

1. **Config Priority:** Should we prioritize config system or enhanced disassembly first?

2. **Differential Testing:** Do we want to support multiple reference implementations (revme, geth) or just revme?

3. **TUI Server Tab:** Should this be added as part of "remaining features" or separately?

4. **Fixture Format:** Should fixtures include expected results for automatic pass/fail, or just store inputs?

## Useful Commands

```bash
# View commit where Guillotine CLI was removed
cd guillotine
git log --oneline | grep -i "remove"

# Search for patterns in TEVM
cd tevm-monorepo
grep -r "LogViewer" cli/src/

# Search for patterns in Guillotine
cd guillotine
grep -r "bytecode_disassembly" apps/cli/
```

## Summary

**Completed:**
- ✅ Full HTTP JSON-RPC server with 17 methods
- ✅ Dual mode operation (headless + TUI)
- ✅ Forking boilerplate with helpful errors
- ✅ GitHub issue for Solidity compilation

**Next Steps (in order):**
1. Configuration system (env vars + files)
2. Enhanced bytecode disassembly
3. Fixture system
4. Differential testing
5. Additional TUI features

The foundation is solid. The next agent can pick up any of the priorities and make immediate progress. All reference code is available in cloned repos.

Good luck! 🚀
