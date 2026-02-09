# Chop: Engineering Document

How we build chop. Architecture, module breakdown, Effect service graph, build system, testing strategy, and implementation phases.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Breakdown](#3-module-breakdown)
4. [Effect Service Graph](#4-effect-service-graph)
5. [Error Architecture](#5-error-architecture)
6. [Build System](#6-build-system)
7. [Testing Strategy](#7-testing-strategy)
8. [Implementation Phases](#8-implementation-phases)
9. [Key Technical Decisions](#9-key-technical-decisions)

---

## 1. Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Language | TypeScript | 5.9+ | All application code |
| Runtime (CLI/MCP) | Node.js or Bun | 22+ / 1.2+ | CLI and MCP server execution |
| Runtime (TUI) | Bun | 1.2+ | Required for OpenTUI FFI |
| Effect system | Effect | 3.14+ | Typed errors, DI, resource management |
| CLI framework | @effect/cli | 0.52+ | Commands, args, options |
| Platform | @effect/platform | 0.76+ | HTTP client, filesystem, terminal |
| TUI framework | OpenTUI | 0.1+ | Terminal rendering via Zig FFI |
| UI layer | React (via OpenTUI) | 18+ | Component model for TUI views |
| Ethereum types | voltaire-effect | 0.3+ | Branded Uint8Array types, Schema |
| EVM engine | guillotine-mini WASM | - | EVM execution |
| MCP SDK | @modelcontextprotocol/sdk | 1.12+ | MCP server implementation |
| Test framework | Vitest + @effect/vitest | 2.2+ / 0.18+ | Unit and integration tests |
| Bundler | tsup | 8.4+ | ESM builds |
| Linter | Biome | 1.9+ | Lint + format |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Entry Points                                 │
│  bin/chop.ts (CLI+TUI)              bin/chop-mcp.ts (MCP Server)    │
└────────┬───────────┬──────────────────────────┬─────────────────────┘
         │           │                          │
         ▼           ▼                          ▼
┌─────────────┐ ┌──────────┐            ┌──────────────┐
│  CLI Layer  │ │TUI Layer │            │  MCP Layer   │
│ @effect/cli │ │ OpenTUI  │            │  MCP SDK     │
│ commands/   │ │ views/   │            │  tools/      │
│ formatters/ │ │ comps/   │            │  resources/  │
└──────┬──────┘ └────┬─────┘            └──────┬───────┘
       │             │                         │
       └──────┬──────┴─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Handler Layer                                    │
│  callHandler, getAccountHandler, mineHandler, ...                    │
│  (Business logic - takes Node, returns typed result)                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Procedure Layer                                   │
│  JSON-RPC serialization/deserialization                               │
│  Maps eth_call → callHandler, eth_getBalance → getBalanceHandler     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Node Layer (Services)                            │
│                                                                       │
│  ┌─────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐ │
│  │   VM    │ │ StateManager │ │ Blockchain  │ │    TxPool        │ │
│  │Service  │ │   Service    │ │  Service    │ │    Service       │ │
│  └────┬────┘ └──────┬───────┘ └──────┬──────┘ └────────┬─────────┘ │
│       │             │                │                  │           │
│  ┌────▼────┐ ┌──────▼───────┐ ┌─────▼──────┐                      │
│  │  EVM   │ │  WorldState  │ │ BlockStore │                       │
│  │Service │ │   Service    │ │  Service   │                       │
│  └────┬───┘ └──────┬───────┘ └────────────┘                       │
│       │            │                                                │
│  ┌────▼────────────▼────┐                                          │
│  │     HostAdapter      │  (bridges EVM ↔ State)                   │
│  └──────────────────────┘                                          │
│                                                                     │
│  ┌──────────────────────┐  ┌─────────────────┐                     │
│  │  TransportService    │  │ ForkConfigService│                     │
│  │  (HTTP client)       │  │ (chain+block)    │                     │
│  └──────────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Foundation Layer                                    │
│  voltaire-effect (Address, Hash, Block, Tx, branded types)           │
│  guillotine-mini WASM (EVM execution engine)                         │
│  @tevm/voltaire (Zig-backed crypto, precompiles)                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Breakdown

### 3.1 `src/shared/` — Foundation

| File | Purpose | Dependencies |
|------|---------|-------------|
| `types.ts` | Re-export branded types from voltaire-effect | voltaire-effect |
| `config.ts` | Runtime configuration schema | effect/Schema |
| `errors.ts` | Base error types (ChopError) | effect/Data |

### 3.2 `src/evm/` — EVM Integration

| File | Purpose | Effect Service |
|------|---------|---------------|
| `wasm.ts` | WASM module loading, lifecycle | `EvmWasmService` |
| `host-adapter.ts` | Bridge WASM EVM ↔ Effect state | `HostAdapterService` |
| `intrinsic-gas.ts` | Transaction gas calculation | `IntrinsicGasCalculatorService` |
| `tx-processor.ts` | Fee validation, balance checks | `TransactionProcessorService` |
| `release-spec.ts` | Hardfork feature flags | `ReleaseSpecService` |

### 3.3 `src/state/` — State Management

| File | Purpose | Effect Service |
|------|---------|---------------|
| `world-state.ts` | Account + storage maps with journal | `WorldStateService` |
| `journal.ts` | Generic change journal with snapshot/restore | `JournalService` |
| `account.ts` | Account type, EMPTY_ACCOUNT, helpers | (pure) |

### 3.4 `src/blockchain/` — Block Management

| File | Purpose | Effect Service |
|------|---------|---------------|
| `blockchain.ts` | Chain manager, fork choice, events | `BlockchainService` |
| `block-store.ts` | Block storage, canonical index, orphans | `BlockStoreService` |
| `header-validator.ts` | Block header consensus validation | `BlockHeaderValidatorService` |

### 3.5 `src/node/` — Node Orchestration

| File | Purpose | Effect Service |
|------|---------|---------------|
| `index.ts` | Layer composition root | `TevmNodeService` |
| `services/StateManagerService.ts` | State manager wrapper | `StateManagerService` |
| `services/BlockchainService.ts` | Blockchain wrapper | `BlockchainService` |
| `services/EvmService.ts` | EVM execution | `EvmService` |
| `services/VmService.ts` | VM orchestration (runTx, runBlock) | `VmService` |
| `services/TxPoolService.ts` | Transaction pool | `TxPoolService` |
| `services/MiningService.ts` | Mining control | `MiningService` |
| `services/TransportService.ts` | HTTP client for fork | `TransportService` |
| `layers/local.ts` | Local mode layer | - |
| `layers/fork.ts` | Fork mode layer + HttpTransport | - |
| `errors.ts` | Node-level error types | - |

### 3.6 `src/handlers/` — Business Logic

| File | Purpose |
|------|---------|
| `call.ts` | eth_call handler |
| `getAccount.ts` | Account query handler |
| `setAccount.ts` | Account mutation handler |
| `getBlock.ts` | Block query handler |
| `getTransaction.ts` | Tx query handler |
| `mine.ts` | Mining handler |
| `snapshot.ts` | Snapshot/revert handler |
| `sendTransaction.ts` | Tx submission handler |
| `getLogs.ts` | Log query handler |
| `estimateGas.ts` | Gas estimation handler |

### 3.7 `src/procedures/` — JSON-RPC Layer

| File | Purpose |
|------|---------|
| `eth.ts` | All eth_* method procedures |
| `anvil.ts` | All anvil_* method procedures |
| `evm.ts` | All evm_* method procedures |
| `debug.ts` | All debug_* method procedures |
| `router.ts` | Method name → procedure dispatch |

### 3.8 `src/cli/` — CLI Layer

| File | Purpose |
|------|---------|
| `index.ts` | Root command definition |
| `commands/abi.ts` | abi-encode, abi-decode, calldata, calldata-decode |
| `commands/address.ts` | to-check-sum-address, compute-address, create2 |
| `commands/convert.ts` | from-wei, to-wei, to-hex, to-dec, etc. |
| `commands/crypto.ts` | keccak, sig, sig-event |
| `commands/contract.ts` | call, storage, balance, nonce, code |
| `commands/chain.ts` | block, tx, receipt, chain-id, gas-price |
| `commands/bytecode.ts` | disassemble, 4byte, 4byte-event |
| `commands/node.ts` | node (start devnet) |
| `formatters/json.ts` | JSON output formatting |
| `formatters/human.ts` | Human-readable formatting |

### 3.9 `src/tui/` — TUI Layer

| File | Purpose |
|------|---------|
| `index.ts` | TUI entry point |
| `App.tsx` | Root component, tab router |
| `views/Dashboard.tsx` | Dashboard 2x2 grid |
| `views/CallHistory.tsx` | Call list + detail |
| `views/Contracts.tsx` | Contract list + disassembly |
| `views/Accounts.tsx` | Account table |
| `views/Blocks.tsx` | Block table |
| `views/Transactions.tsx` | Transaction table |
| `views/Settings.tsx` | Settings form |
| `views/StateInspector.tsx` | State tree browser |
| `components/Table.tsx` | Reusable table with selection |
| `components/Panel.tsx` | Bordered panel with title |
| `components/TabBar.tsx` | Tab navigation bar |
| `components/StatusBar.tsx` | Bottom status bar |
| `components/HelpOverlay.tsx` | Help modal |
| `theme.ts` | Dracula palette constants |

### 3.10 `src/mcp/` — MCP Server Layer

| File | Purpose |
|------|---------|
| `server.ts` | MCP server setup, tool/resource/prompt registration |
| `tools/abi.ts` | ABI encoding/decoding tools |
| `tools/address.ts` | Address utility tools |
| `tools/contract.ts` | Contract interaction tools |
| `tools/devnet.ts` | Local devnet tools |
| `resources.ts` | URI-addressable blockchain state |
| `prompts.ts` | Multi-step workflow prompts |

### 3.11 `src/rpc/` — RPC Server

| File | Purpose |
|------|---------|
| `server.ts` | HTTP server setup |
| `handler.ts` | Request parsing, routing, response formatting |

---

## 4. Effect Service Graph

### 4.1 Service Tags

```typescript
// Foundation
class ReleaseSpecService extends Context.Tag("ReleaseSpec")<ReleaseSpecService, ReleaseSpecShape>() {}
class JournalService extends Context.Tag("Journal")<JournalService, JournalShape>() {}

// State
class WorldStateService extends Context.Tag("WorldState")<WorldStateService, WorldStateShape>() {}
class BlockStoreService extends Context.Tag("BlockStore")<BlockStoreService, BlockStoreShape>() {}
class BlockchainService extends Context.Tag("Blockchain")<BlockchainService, BlockchainShape>() {}

// EVM
class EvmWasmService extends Context.Tag("EvmWasm")<EvmWasmService, EvmWasmShape>() {}
class HostAdapterService extends Context.Tag("HostAdapter")<HostAdapterService, HostAdapterShape>() {}
class EvmService extends Context.Tag("Evm")<EvmService, EvmShape>() {}

// Node
class TransportService extends Context.Tag("Transport")<TransportService, TransportShape>() {}
class ForkConfigService extends Context.Tag("ForkConfig")<ForkConfigService, ForkConfigShape>() {}
class VmService extends Context.Tag("Vm")<VmService, VmShape>() {}
class TxPoolService extends Context.Tag("TxPool")<TxPoolService, TxPoolShape>() {}
class MiningService extends Context.Tag("Mining")<MiningService, MiningShape>() {}
class TevmNodeService extends Context.Tag("TevmNode")<TevmNodeService, TevmNodeShape>() {}
```

### 4.2 Layer Dependency Graph

```
TevmNodeService
├── VmService
│   └── EvmService
│       ├── EvmWasmService (WASM lifecycle via acquireRelease)
│       ├── HostAdapterService
│       │   └── WorldStateService
│       │       └── JournalService
│       └── ReleaseSpecService
├── BlockchainService (scoped - PubSub)
│   └── BlockStoreService
├── TxPoolService
├── MiningService
│   ├── VmService
│   └── TxPoolService
├── TransportService
│   └── (HttpTransport for fork, Noop for local)
└── ForkConfigService
    └── (ForkConfigFromRpc or ForkConfigStatic)
```

### 4.3 Layer Composition Code

```typescript
// Local mode composition
const LocalLive = (options: NodeOptions): Layer.Layer<TevmNodeService> =>
  TevmNodeLive.pipe(
    Layer.provide(EvmStackLive),
    Layer.provide(NodeStateLive),
    Layer.provide(TransportNoop),
    Layer.provide(ForkConfigStatic({
      chainId: BigInt(options.chainId ?? 31337),
      blockTag: 0n,
    })),
    Layer.provide(ReleaseSpecLive(options.hardfork ?? "prague")),
    Layer.provide(EvmWasmLive),
    Layer.provide(JournalLive()),
  )

// Fork mode composition
const ForkLive = (options: ForkOptions): Layer.Layer<TevmNodeService> =>
  TevmNodeLive.pipe(
    Layer.provide(EvmStackLive),
    Layer.provide(NodeStateLive),
    Layer.provide(HttpTransportLive({ url: options.url })),
    Layer.provide(
      options.blockTag !== undefined
        ? ForkConfigStatic({ chainId: options.chainId ?? 1n, blockTag: options.blockTag })
        : ForkConfigFromRpcLive
    ),
    Layer.provide(ReleaseSpecLive(options.hardfork ?? "prague")),
    Layer.provide(EvmWasmLive),
    Layer.provide(JournalLive()),
  )
```

---

## 5. Error Architecture

### 5.1 Error Hierarchy

```
ChopError (base)
├── CliError
│   ├── InvalidArgumentError
│   ├── MissingArgumentError
│   └── InvalidFlagError
├── RpcError
│   ├── ConnectionError
│   ├── TimeoutError
│   └── MethodNotFoundError
├── EvmError
│   ├── ExecutionRevertError
│   ├── OutOfGasError
│   ├── InvalidOpcodeError
│   ├── StackOverflowError
│   └── StackUnderflowError
├── StateError
│   ├── AccountNotFoundError
│   ├── MissingAccountError
│   ├── InvalidSnapshotError
│   └── UnknownSnapshotError
├── BlockchainError
│   ├── BlockNotFoundError
│   ├── InvalidBlockError
│   ├── GenesisError
│   └── CanonicalChainError
├── TransactionError
│   ├── InvalidTransactionError
│   ├── InsufficientBalanceError
│   ├── NonceTooLowError
│   └── GasPriceError
├── WasmError
│   ├── WasmLoadError
│   └── WasmExecutionError
└── ForkError
    ├── ForkConnectionError
    └── ForkDataError
```

### 5.2 Error Pattern

All errors use `Data.TaggedError`:

```typescript
class ExecutionRevertError extends Data.TaggedError("ExecutionRevertError")<{
  readonly address: AddressType
  readonly selector: string
  readonly reason: string
  readonly data: Uint8Array
  readonly gasUsed: bigint
}> {}
```

### 5.3 Error Recovery

```typescript
// In handlers: catch and recover
const callHandler = (params: CallParams) =>
  executeCall(params).pipe(
    Effect.catchTag("ExecutionRevertError", (e) =>
      Effect.succeed({
        reverted: true,
        reason: e.reason,
        data: e.data,
        gasUsed: e.gasUsed,
      })
    )
  )

// In CLI: format for display
const formatError = (error: ChopError): string =>
  Match.value(error).pipe(
    Match.tag("ExecutionRevertError", (e) =>
      `Error: Transaction reverted\n  Reason: ${e.reason}\n  Gas Used: ${e.gasUsed}`
    ),
    Match.tag("ConnectionError", (e) =>
      `Error: Cannot connect to RPC\n  URL: ${e.url}\n  Cause: ${e.cause}`
    ),
    Match.orElse((e) => `Error: ${e.message}`)
  )
```

---

## 6. Build System

### 6.1 Development

```bash
bun install                    # Install all dependencies
bun run dev                    # Run CLI directly via Bun (no build)
bun run dev:mcp                # Run MCP server directly
```

### 6.2 Production Build

```bash
bun run build                  # tsup → dist/
```

tsup config (from `research/project-setup.md`):
- Format: ESM only
- Target: node22
- Splitting: enabled (shared chunks)
- Tree-shaking: enabled
- DTS: enabled (type declarations)
- External: bun:ffi, @opentui/*

### 6.3 WASM Build

```bash
bun run build:wasm             # Zig → wasm/guillotine_mini.wasm
```

WASM is committed to the repo (not built in CI). Updated only when Zig EVM source changes.

### 6.4 CI Pipeline

```
typecheck ──┐
lint ───────┤
test ───────┤──→ build ──→ e2e
            │
```

All gates must pass before merge to main.

---

## 7. Testing Strategy

### 7.1 Test Pyramid

| Level | Tool | Location | Coverage Target |
|-------|------|----------|----------------|
| Unit | Vitest + @effect/vitest | `src/**/*.test.ts` | 80%+ |
| Integration | Vitest | `test/integration/` | Key flows |
| E2E (CLI) | Vitest + child_process | `test/e2e/cli/` | All commands |
| E2E (TUI) | @microsoft/tui-test | `test/e2e/tui/` | All views |
| Visual | VHS golden files | `tests/golden/` | Key screens |
| RPC Compatibility | Vitest | `test/e2e/rpc/` | All methods |

### 7.2 Unit Test Pattern

```typescript
import { it, describe } from "@effect/vitest"
import { Effect } from "effect"

describe("WorldState", () => {
  it.effect("stores and retrieves accounts", () =>
    Effect.gen(function* () {
      const state = yield* WorldStateService
      yield* state.setAccount(testAddress, testAccount)
      const result = yield* state.getAccount(testAddress)
      expect(result.balance).toBe(testAccount.balance)
    }).pipe(Effect.provide(WorldStateTest))
  )
})
```

### 7.3 CLI E2E Test Pattern

```typescript
import { execSync } from "child_process"

describe("chop abi-encode", () => {
  it("encodes transfer calldata", () => {
    const result = execSync(
      'bun run bin/chop.ts abi-encode "transfer(address,uint256)" 0x1234...abcd 1000000000000000000'
    ).toString().trim()
    expect(result).toBe("0x000000000000000000000000...")
  })

  it("outputs JSON with --json flag", () => {
    const result = execSync(
      'bun run bin/chop.ts abi-encode "transfer(address,uint256)" 0x1234...abcd 1000000000000000000 --json'
    ).toString()
    expect(JSON.parse(result)).toHaveProperty("result")
  })
})
```

### 7.4 RPC Compatibility Test Pattern

```typescript
describe("JSON-RPC: eth_call", () => {
  let nodeUrl: string

  beforeAll(async () => {
    // Start chop node
    nodeUrl = await startChopNode({ port: 0 })
  })

  it("matches anvil output for simple call", async () => {
    const chopResult = await rpcCall(nodeUrl, "eth_call", [
      { to: contractAddr, data: calldata },
      "latest"
    ])

    // Compare with known-good result
    expect(chopResult.result).toBe(expectedResult)
  })
})
```

---

## 8. Implementation Phases

### Phase 1: Foundation (CLI pure commands)

**Goal**: `chop abi-encode`, `chop keccak`, `chop to-hex`, etc. work.

**Build**:
- Project scaffolding (package.json, tsconfig, vitest, tsup, biome)
- `src/shared/` types and errors
- `src/cli/` framework with @effect/cli
- Pure CLI commands (no RPC, no EVM):
  - ABI encoding/decoding
  - Address utilities
  - Data conversion
  - Cryptographic operations
  - Bytecode disassembly

**Test**: Unit tests for all pure commands. CLI E2E tests.

**Deliverable**: Working CLI for offline Ethereum operations.

### Phase 2: EVM + State (local devnet core)

**Goal**: `chop node` starts, handles `eth_call`, `eth_getBalance`.

**Build**:
- `src/evm/` WASM integration
- `src/state/` WorldState + Journal
- `src/blockchain/` BlockStore + Blockchain
- `src/node/` service composition (local mode)
- `src/handlers/` for basic operations
- `src/procedures/` for eth_call, eth_getBalance, eth_getCode, eth_getStorageAt
- `src/rpc/` HTTP server
- Basic CLI commands using RPC: `chop call`, `chop balance`, `chop storage`

**Test**: Unit tests for all services. Integration tests for handler → service flows. RPC compatibility tests.

**Deliverable**: Minimal local devnet with core eth_* methods.

### Phase 3: Full Devnet (Anvil compatibility)

**Goal**: Full anvil_* and evm_* compatibility.

**Build**:
- Transaction pool, mining (auto/manual/interval)
- Snapshot/revert
- Account impersonation
- All remaining eth_* methods
- All anvil_* methods
- All evm_* methods
- debug_traceTransaction, debug_traceCall
- Fork mode (HttpTransport + ForkConfig + lazy loading)
- `chop node --fork-url` works
- All remaining CLI commands (block, tx, receipt, chain-id, gas-price, send, logs)

**Test**: Full RPC compatibility test suite against known-good Anvil outputs. Fork mode integration tests.

**Deliverable**: Drop-in Anvil replacement.

### Phase 4: TUI

**Goal**: `chop` (no args) launches TUI.

**Build**:
- `src/tui/` all 8 views
- Theme, components, tab navigation
- Status bar with live chain info
- Keyboard shortcuts
- Integration with local devnet (start node internally)

**Test**: TUI E2E tests with @microsoft/tui-test. VHS golden file tests.

**Deliverable**: Full TUI explorer.

### Phase 5: MCP + AI Integration

**Goal**: `chop-mcp` works with Claude Code.

**Build**:
- `src/mcp/` server with all tools, resources, prompts
- SKILL.md, AGENTS.md
- `.mcp.json` configuration
- `bin/chop-mcp.ts` entry point

**Test**: MCP protocol compliance tests. Tool invocation tests.

**Deliverable**: AI agents can use chop programmatically.

### Phase 6: Polish

**Goal**: Production-ready release.

**Build**:
- VHS demo GIFs
- README with demos
- npm package publishing
- Performance optimization (startup time, WASM caching)
- Help text polish for all commands
- Error message improvements

**Test**: Full regression suite. Performance benchmarks. Golden file verification.

**Deliverable**: v0.1.0 release.

---

## 9. Key Technical Decisions

### 9.1 Effect from Day One

We use Effect.ts for all business logic from the start, not as a migration target. This means:
- All services use `Context.Tag` + `Layer`
- All errors use `Data.TaggedError`
- All async operations use `Effect`, never raw Promises
- DI is via Layer composition, never manual wiring
- State is via `Ref`, never mutable closures

### 9.2 WASM EVM, Not ethereumjs

We use guillotine-mini compiled to WASM instead of ethereumjs:
- 100% ethereum/tests pass rate
- Single WASM binary vs. dozens of npm packages
- Async execution protocol for state fetching
- TypeScript HostAdapter bridges Effect state to WASM

### 9.3 Handler/Procedure Separation

Following TEVM's pattern:
- **Handler**: `(node: TevmNode) => (params: Params) => Effect<Result, Error>`
- **Procedure**: wraps handler with JSON-RPC serialization

This enables: CLI calls handler directly, RPC calls procedure, MCP calls handler directly.

### 9.4 Single Composition Root

All Layer composition happens at the entry point:
- `bin/chop.ts`: provides `TevmNode.Local()` or `TevmNode.Fork()`
- `bin/chop-mcp.ts`: provides `TevmNode.Local()` + `McpServerLive`
- Tests: provide `*Test` layers per test

Never scattered `Effect.provide` calls in business logic.

### 9.5 ESM Only

No CJS output. Effect is ESM-only. All modern runtimes support ESM.

### 9.6 Bun for TUI, Node.js for Everything Else

TUI requires Bun (OpenTUI uses bun:ffi). CLI and MCP work on both. The entry point detects runtime and adjusts:
- TUI launch: assert Bun, error if Node.js
- CLI/MCP: use `@effect/platform-bun` or `@effect/platform-node` based on detection
