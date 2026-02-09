# TEVM Monorepo Reference Architecture

Research document analyzing the tevm-monorepo as reference architecture for the chop project.

**Source:** `/Users/williamcory/tevm-monorepo/`
**Date:** 2026-02-09

---

## 1. Monorepo Layout

TEVM uses a pnpm workspace monorepo managed by Nx for task orchestration. The workspace layout:

```
tevm-monorepo/
  packages/          # Core runtime packages (~40 packages)
  bundler-packages/  # Build tool integrations (vite, webpack, esbuild, etc.)
  extensions/        # Optional extensions (viem, ethers, test-node)
  configs/           # Shared configs (tsup, tsconfig, vitest)
  cli/               # CLI tool (React/Ink-based via Pastel)
  tevm/              # Umbrella package - re-exports everything
  examples/          # Example apps
  lsp/               # Language server protocol
  docs/              # Documentation site
  scripts/           # Build/CI scripts
  test/              # Shared test utilities
```

**Key file:** `/Users/williamcory/tevm-monorepo/pnpm-workspace.yaml`

### Workspace Configuration
```yaml
packages:
  - bundler-packages/*
  - configs/*
  - cli
  - docs/*
  - examples/*
  - extensions/*
  - lsp/*
  - packages/*
  - scripts
  - tevm
  - test/*
```

### Build Orchestration
Nx handles task dependencies with caching. Key targets:
- `build:dist` - Compile JS via tsup
- `build:types` - Generate `.d.ts` files via tsup + tsc
- `test:run` / `test:coverage` - Vitest
- `lint:check` - Biome
- `lint:package` - publint + attw (are-the-types-wrong)

**Key file:** `/Users/williamcory/tevm-monorepo/nx.json`

---

## 2. Package Dependency Architecture

The architecture follows a strict layered dependency graph:

```
                    memory-client (viem client + all actions)
                           |
             +-------------+-------------+
             |             |             |
         decorators     actions       server
             |             |             |
             +------+------+------+------+
                    |
                   node  (TevmNode - core orchestrator)
                    |
     +---------+---+---+---------+---------+
     |         |       |         |         |
    vm      txpool  receipt   blockchain  state
     |         |    manager      |         |
     +---------+-------+---------+---------+
                    |
                   evm  (EVM execution engine)
                    |
     +------+------+------+------+------+------+
     |      |      |      |      |      |      |
   block   tx   common  precomp  trie   rlp  address
                   |
            +------+------+
            |             |
          logger        errors
                          |
                        utils
```

### Package Categories

| Category | Packages | Description |
|----------|----------|-------------|
| **Foundation** | errors, utils, logger, rlp | Pure utilities, no state |
| **Primitives** | address, tx, block, trie, common | Data types and encoding |
| **Core EVM** | state, evm, blockchain, vm | Stateful EVM components |
| **Transaction** | txpool, receipt-manager | Transaction lifecycle |
| **Node** | node, precompiles, predeploys | Orchestration layer |
| **Client** | memory-client, http-client, decorators, server | API surface |
| **Effect** | *-effect packages | Effect.ts wrapper layer |

---

## 3. TevmNode - The Core Orchestrator

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/node/src/TevmNode.ts` (type definition)
- `/Users/williamcory/tevm-monorepo/packages/node/src/createTevmNode.js` (implementation)

### Architecture Pattern
`TevmNode` is the central object that owns all EVM subsystems. It is created synchronously but initializes asynchronously via a promise chain:

```javascript
export const createTevmNode = (options = {}) => {
  // 1. Resolve chain ID (from fork, common, or default)
  const chainIdPromise = (async () => { ... })()

  // 2. Resolve block tag (for fork mode)
  const blockTagPromise = (async () => { ... })()

  // 3. Create common (chain config)
  const chainCommonPromise = chainIdPromise.then(...)

  // 4. Create blockchain
  const blockchainPromise = Promise.all([chainCommonPromise, blockTagPromise]).then(...)

  // 5. Create state manager (depends on blockchain for state root)
  const stateManagerPromise = blockchainPromise.then(...)

  // 6. Create EVM (depends on common, state, blockchain)
  const evmPromise = Promise.all([chainCommonPromise, stateManagerPromise, blockchainPromise]).then(...)

  // 7. Create VM (depends on EVM, common)
  const vmPromise = Promise.all([evmPromise, chainCommonPromise]).then(...)

  // 8. Create TxPool and ReceiptsManager (depend on VM)
  const txPoolPromise = vmPromise.then(...)
  const receiptManagerPromise = vmPromise.then(...)

  // Return node object immediately; operations await readyPromise
  return baseClient
}
```

### TevmNode Interface
The node exposes:
- `getVm()` / `getTxPool()` / `getReceiptsManager()` - Async access to subsystems
- `mode: 'fork' | 'normal'` - Operating mode
- `miningConfig` - Auto/manual/interval mining
- `extend()` - Plugin system (like viem's extend pattern)
- `deepCopy()` - Full state cloning for test isolation
- `ready()` - Wait for initialization
- Status management: `INITIALIZING`, `READY`, `SYNCING`, `MINING`, `STOPPED`
- Impersonation: `get/setImpersonatedAccount`, `get/setAutoImpersonate`
- Block parameters: `nextBlockTimestamp`, `nextBlockGasLimit`, `nextBlockBaseFeePerGas`
- Snapshots: `addSnapshot`, `getSnapshot`, `deleteSnapshotsFrom`
- Filters: `setFilter`, `getFilters`, `removeFilter`
- EIP-1193 event emitter: `on`, `removeListener`, `emit`

### Key Pattern: Extend
```javascript
const extend = (client) => (extension) => {
  Object.assign(client, extension(client))
  return client
}
```

This enables composition via decorators (same pattern as viem):
```javascript
const node = createTevmNode()
  .extend(requestEip1193())
  .extend(tevmSend())
```

---

## 4. Actions / Procedures Pattern

This is one of the most important patterns to learn from. TEVM separates:
- **Handlers** - High-level business logic operating on TevmNode
- **Procedures** - JSON-RPC serialization/deserialization wrapper around handlers

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/actions/src/Call/callHandler.js`
- `/Users/williamcory/tevm-monorepo/packages/actions/src/Call/callProcedure.js`
- `/Users/williamcory/tevm-monorepo/packages/actions/src/createHandlers.js`
- `/Users/williamcory/tevm-monorepo/packages/actions/src/requestProcedure.js`

### Handler Pattern
```javascript
// Handler: Takes TevmNode, returns async function taking typed params
export const callHandler = (client, { throwOnFail = true } = {}) =>
  async (params) => {
    // 1. Validate params
    const validationErrors = validateCallParams(params)
    if (validationErrors.length > 0) {
      return maybeThrowOnFail(throwOnFail, { errors: validationErrors, ... })
    }

    // 2. Prepare EVM input
    const callHandlerRes = await callHandlerOpts(client, params)

    // 3. Clone VM for block context
    const vm = await cloneVmWithBlockTag(client, block)

    // 4. Apply state overrides
    await handleStateOverrides(client, params.stateOverrideSet)

    // 5. Execute the call
    const executedCall = await executeCall(client, evmInput, params)

    // 6. Handle transaction creation if needed
    const txResult = await handleTransactionCreation(client, params, executedCall)

    // 7. Return result
    return maybeThrowOnFail(throwOnFail, { ...callHandlerResult(...) })
  }
```

### Procedure Pattern (JSON-RPC wrapper)
```javascript
// Procedure: Converts JSON-RPC request to handler params, handler result to JSON-RPC response
export const callProcedure = (client) => async (request) => {
  const { errors = [], ...result } = await callHandler(client)({
    throwOnFail: false,
    // Map JSON-RPC params to handler params (hex -> bigint, etc.)
    ...(request.params[0].gas ? { gas: hexToBigInt(request.params[0].gas) } : {}),
    ...(request.params[0].to ? { to: request.params[0].to } : {}),
    // ... more param mapping
  })

  if (errors.length > 0) {
    return { jsonrpc: '2.0', error: { code, message, data }, method: 'tevm_call' }
  }

  return {
    jsonrpc: '2.0',
    result: {
      executionGasUsed: numberToHex(result.executionGasUsed),
      rawData: result.rawData,
      // ... more result mapping (bigint -> hex)
    },
    method: 'tevm_call',
  }
}
```

### Request Router
The `createHandlers` function maps JSON-RPC method names to procedure functions:

```javascript
export const createHandlers = (client) => {
  const tevmHandlers = {
    tevm_call: callProcedure(client),
    tevm_getAccount: getAccountProcedure(client),
    tevm_setAccount: setAccountProcedure(client),
    tevm_dumpState: dumpStateProcedure(client),
    tevm_loadState: loadStateProcedure(client),
    tevm_miner: mineProcedure(client),
  }
  const ethHandlers = {
    eth_blockNumber: blockNumberProcedure(client),
    eth_chainId: chainIdProcedure(client),
    eth_call: ethCallProcedure(client),
    // ... 30+ eth methods
  }
  const anvilHandlers = { /* 30+ anvil_ methods */ }
  const debugHandlers = { /* 15+ debug_ methods */ }
  const evmHandlers = { /* evm_snapshot, evm_revert, etc. */ }

  // Also creates ganache_, hardhat_, tevm_ aliases for anvil methods
  return { ...tevmHandlers, ...ethHandlers, ...anvilHandlers, ...debugHandlers, ...evmHandlers }
}
```

The `requestProcedure` dispatches incoming requests:
```javascript
export const requestProcedure = (client) => {
  const handlers = createHandlers(client)
  return async (request) => {
    await client.ready()
    if (!(request.method in handlers)) {
      return { error: { code: MethodNotFoundError.code, message } }
    }
    return handlers[request.method](request)
  }
}
```

### Action File Organization
Each action is in its own directory with a consistent structure:
```
actions/src/Call/
  CallHandlerType.ts        # TypeScript type for the handler
  CallJsonRpcProcedure.ts   # TypeScript type for the procedure
  CallJsonRpcRequest.ts     # JSON-RPC request type
  CallJsonRpcResponse.ts    # JSON-RPC response type
  CallParams.ts             # Handler param types
  CallResult.ts             # Handler result types
  TevmCallError.ts          # Error types
  callHandler.js            # Handler implementation
  callHandler.spec.ts       # Handler tests
  callProcedure.js          # JSON-RPC procedure implementation
  callProcedure.spec.ts     # Procedure tests
  executeCall.js            # Internal helper
  validateCallParams.js     # Param validation
  zCallParams.js            # Zod schema (optional)
  index.ts                  # Re-exports
```

---

## 5. MemoryClient - The User-Facing API

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/memory-client/src/createMemoryClient.js`
- `/Users/williamcory/tevm-monorepo/packages/memory-client/src/createTevmTransport.js`

### Architecture
MemoryClient wraps a viem Client with a custom TEVM transport:

```javascript
export const createMemoryClient = (options) => {
  const baseClient = createClient({
    transport: createTevmTransport({ ...options }),
    type: 'tevm',
    chain: common,
  })

  // Layer on action APIs via viem's extend pattern
  return baseClient
    .extend(tevmViemActions())   // TEVM-specific actions
    .extend(publicActions)        // Standard eth read actions
    .extend(walletActions)        // Transaction signing
    .extend(testActions({ mode: 'anvil' }))  // Anvil-compatible test actions
}
```

### TevmTransport
The transport is the bridge between viem's client and TevmNode:

```javascript
export const createTevmTransport = (options = {}) => {
  const tevmMap = new Map()  // Cache nodes by chain ID

  return ({ chain }) => {
    const tevm = tevmMap.get(id) ??
      createTevmNode(options)
        .extend(requestEip1193())    // Add EIP-1193 request method
        .extend(tevmSend())          // Add JSON-RPC send method

    return createTransport(
      { request: tevm.request, type: 'tevm', name: 'Tevm transport' },
      { tevm }  // Expose TevmNode via transport.tevm
    )
  }
}
```

### Decorator Pattern (tevmActions / tevmViemActions)
Actions are applied as decorators that wrap TevmNode handlers:

```javascript
// Each action is a separate decorator for tree-shaking
const getAccountAction = () => (client) => ({
  getAccount: getAccountHandler(client),
})

const callAction = () => (client) => ({
  call: callHandler(client),
})

// Combined decorator applies all
export const tevmActions = () => (client) => {
  return client
    .extend(getAccountAction())
    .extend(callAction())
    .extend(contractAction())
    .extend(mineAction())
    // ... etc
}
```

---

## 6. State Management

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/state/src/createBaseState.js`
- `/Users/williamcory/tevm-monorepo/packages/state/src/createStateManager.js`
- `/Users/williamcory/tevm-monorepo/packages/state/src/actions/` (all state operations)

### BaseState Architecture
State uses a two-layer architecture:
1. **BaseState** - Core data structure with caches and state roots
2. **StateManager** - High-level API decorating BaseState with operations

```javascript
// BaseState is the raw data
const state = {
  getCurrentStateRoot: () => currentStateRoot,
  setCurrentStateRoot: (root) => { ... },
  stateRoots: new Map(),         // StateRoot -> TevmState mapping
  caches: {
    contracts: new ContractCache(new StorageCache({ size: 100_000, type: CacheType.LRU })),
    accounts: new AccountCache({ size: 100_000, type: CacheType.LRU }),
    storage: new StorageCache({ size: 100_000, type: CacheType.LRU }),
  },
  forkCache: { ... },           // Separate cache for forked state
  ready: () => genesisPromise,
}
```

### StateManager Composition Pattern
StateManager is built by decorating BaseState with individual action functions:

```javascript
export const createStateManager = (options) => {
  return decorate(createBaseState(options))
}

const decorate = (state) => ({
  _baseState: state,
  ready: state.ready,
  deepCopy: async () => decorate(await deepCopy(state)()),
  shallowCopy: () => decorate(shallowCopy(state)()),
  getAccount: getAccount(state),
  putAccount: putAccount(state),
  getCode: getContractCode(state),
  putCode: putContractCode(state),
  getStorage: getContractStorage(state),
  putStorage: putContractStorage(state),
  checkpoint: checkpoint(state),
  commit: commit(state),
  revert: revert(state),
  getStateRoot: getStateRoot(state),
  setStateRoot: setStateRoot(state),
  dumpCanonicalGenesis: () => dumpCanonicalGenesis(state)(),
  // ... more operations
})
```

Each state action is a curried function: `action(baseState) => (...args) => result`

This pattern enables:
- Tree-shaking (unused actions are eliminated)
- Testing individual operations in isolation
- Clear separation of data and behavior

### State Roots and Snapshots
State roots are managed as a Map of hex string to full state:
```javascript
stateRoots: new Map([[stateRootHex, genesisState]])
```

Snapshots store `{ stateRoot, state }` pairs keyed by hex ID ("0x1", "0x2", etc.).

---

## 7. Fork Mode Implementation

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/state/src/actions/getAccountFromProvider.js`
- `/Users/williamcory/tevm-monorepo/packages/state/src/actions/getForkClient.js`
- `/Users/williamcory/tevm-monorepo/packages/state/src/actions/getForkBlockTag.js`

### Fork Architecture
When fork mode is enabled:

1. **Transport Resolution**: Fork transport (EIP-1193 provider) is extracted from options
2. **Block Tag Pinning**: If `latest` or unspecified, the actual block number is fetched and pinned
3. **State Manager**: Gets fork config with transport and pinned block tag
4. **Blockchain**: Gets fork config for fetching historical blocks
5. **Lazy Loading**: State is fetched on-demand from the fork provider

### Lazy State Fetching
When an account is not in local cache, it is fetched from the fork provider:

```javascript
export const getAccountFromProvider = (baseState) => async (address) => {
  const client = getForkClient(baseState)
  const blockTag = getForkBlockTag(baseState)

  // Use eth_getProof to get account data at the pinned block
  const accountData = await client.getProof({
    address: address.toString(),
    storageKeys: [],
    ...blockTag,
  })

  return fromAccountData({
    balance: BigInt(accountData.balance),
    nonce: BigInt(accountData.nonce),
    codeHash: toBytes(accountData.codeHash),
    storageRoot: toBytes(accountData.storageHash),
  })
}
```

The two-cache system (`caches` and `forkCache`) ensures:
- Local modifications are tracked separately
- Fork cache can be invalidated without losing local changes
- State root transitions are clean

---

## 8. JSON-RPC Server

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/server/src/createServer.js`
- `/Users/williamcory/tevm-monorepo/packages/server/src/createHttpHandler.js`
- `/Users/williamcory/tevm-monorepo/packages/server/src/adapters/`

### Server Architecture
The server is a thin HTTP layer over the JSON-RPC procedure handler:

```javascript
export const createServer = (client, serverOptions = {}) => {
  return httpCreateServer(serverOptions, createHttpHandler(client))
}
```

The HTTP handler:
1. Reads the request body
2. Parses JSON (handling errors)
3. Routes to bulk handler (for arrays) or single handler
4. For single requests: `client.transport.tevm.extend(tevmSend()).send(request)`
5. Formats response with proper content type

### Adapter Pattern
Server provides adapters for different frameworks:
- `createHttpHandler` - Node.js `http` module
- `createExpressMiddleware` - Express middleware
- `createNextApiHandler` - Next.js API routes

---

## 9. Mining Implementation

**Key file:** `/Users/williamcory/tevm-monorepo/packages/actions/src/Mine/mineHandler.js`

### Mining Flow
```javascript
export const mineHandler = (client) => async (params) => {
  // 1. Status check (READY -> MINING)
  client.status = 'MINING'

  // 2. Get txpool and deep-copy VM
  const pool = await client.getTxPool()
  const originalVm = await client.getVm()
  const vm = await originalVm.deepCopy()

  // 3. For each block to mine:
  for (let count = 0; count < blockCount; count++) {
    const parentBlock = await vm.blockchain.getCanonicalHeadBlock()

    // 4. Build block with timestamp/gas/basefee overrides
    const blockBuilder = await vm.buildBlock({ parentBlock, headerData: { timestamp, gasLimit, baseFeePerGas } })

    // 5. Add transactions from pool (ordered by price and nonce)
    const orderedTx = await pool.txsByPriceAndNonce({ baseFee })
    for (const tx of orderedTx) {
      const txResult = await blockBuilder.addTransaction(tx)
      receipts.push(txResult.receipt)
    }

    // 6. Finalize block
    await vm.stateManager.checkpoint()
    await vm.stateManager.commit(true)  // createNewStateRoot
    const block = await blockBuilder.build()

    // 7. Save receipts and put block
    await receiptsManager.saveReceipts(block, receipts)
    await vm.blockchain.putBlock(block)
  }

  // 8. Copy state back to original VM
  originalVm.blockchain = vm.blockchain
  await originalVm.stateManager.setStateRoot(...)

  // 9. Emit events and restore status
  await emitEvents(client, newBlocks, newReceipts, params)
  client.status = 'READY'
}
```

### Mining Modes
- **auto**: Mine after every transaction (`miningConfig: { type: 'auto' }`)
- **manual**: Only mine when explicitly called
- **interval**: Mine on a timer (not fully implemented in the handler)

---

## 10. Effect.ts Integration

TEVM has **13 parallel `-effect` packages** providing Effect.ts wrappers, plus a comprehensive migration RFC.

**Effect packages:**
```
packages/
  actions-effect/      # Action handlers as Effect services
  blockchain-effect/   # BlockchainService with Effect layers
  common-effect/       # CommonService (chain config)
  decorators-effect/   # Client decorators in Effect
  effect/              # Shared Effect utilities
  errors-effect/       # Data.TaggedError base classes
  evm-effect/          # EvmService wrapping EVM execution
  logger-effect/       # LoggerService
  memory-client-effect/ # MemoryClient in Effect
  node-effect/         # TevmNodeService orchestrator
  state-effect/        # StateManagerService
  transport-effect/    # TransportService, ForkConfigService, HttpTransport
  vm-effect/           # VmService wrapping VM operations
```

**Key reference:**
- `/Users/williamcory/tevm-monorepo/TEVM_EFFECT_MIGRATION_RFC.md` (25,762 lines -- comprehensive)

### 10.1 Effect Pattern: Service + Live Layer

Each Effect-wrapped operation follows the pattern:

**1. Service Tag (Context.Tag)**
```typescript
import { Context } from 'effect'

export class ForkConfigService extends Context.Tag("ForkConfigService")<
  ForkConfigService,
  ForkConfigShape
>() {}

interface ForkConfigShape {
  readonly chainId: bigint
  readonly blockTag: bigint
}
```

**2. Live Implementation (Layer.effect)**
```typescript
import { Effect, Layer } from 'effect'

export const GetAccountLive = Layer.effect(
  GetAccountService,
  Effect.gen(function* () {
    const stateManager = yield* StateManagerService  // Dependency injection

    return {
      getAccount: (params) => Effect.gen(function* () {
        const address = yield* validateAddress(params.address)
        yield* validateBlockTag(params.blockTag)

        const ethjsAccount = yield* stateManager.getAccount(address).pipe(
          Effect.mapError((e) => new InternalError({ message: `Failed to get account: ${e.message}` }))
        )

        return { address, nonce, balance, deployedBytecode, ... }
      }),
    }
  }),
)
```

**3. Static Layer (Layer.succeed)**
```typescript
export const ForkConfigStatic = (config: ForkConfigShape): Layer.Layer<ForkConfigService> =>
  Layer.succeed(ForkConfigService, config)
```

**4. Scoped Layer (Layer.scoped + acquireRelease)**
```typescript
export const HttpTransport = (config: {
  url: string
  timeout?: Duration.DurationInput
  retrySchedule?: Schedule.Schedule<unknown, ForkError>
  headers?: Record<string, string>
  batch?: { wait: Duration.DurationInput; maxSize: number }
}): Layer.Layer<TransportService> =>
  Layer.scoped(TransportService,
    Effect.gen(function* () {
      const client = yield* Effect.acquireRelease(
        Effect.sync(() => createHttpClient(config)),
        (client) => Effect.sync(() => client.close())
      )
      return {
        request: (method, params) =>
          client.request(method, params).pipe(
            Effect.retry(config.retrySchedule ?? defaultRetrySchedule),
            Effect.timeout(config.timeout ?? "30 seconds"),
            Effect.mapError(e => new ForkError({ method, cause: e }))
          )
      }
    })
  )
```

**5. Promise Bridge (Effect.tryPromise)**
```typescript
export const StateManagerLocal = (options = {}) =>
  Layer.effect(
    StateManagerService,
    Effect.gen(function* () {
      yield* CommonService  // Requires CommonService

      const stateManager = createStateManager({ ... })
      yield* Effect.tryPromise({ try: () => stateManager.ready(), catch: ... })

      return {
        getAccount: (address) => Effect.tryPromise({
          try: () => sm.getAccount(toEthjsAddress(address)),
          catch: (error) => new AccountNotFoundError({ ... }),
        }),
        // ... all state operations wrapped in Effect.tryPromise
      }
    }),
  )
```

### 10.2 Error Types (Data.TaggedError)

```typescript
import { Data } from 'effect'

export class TevmError extends Data.TaggedError("TevmError")<{
  readonly message: string
  readonly code: number
  readonly cause?: unknown
  readonly docsPath?: string
}> {}

export class InsufficientBalanceError extends Data.TaggedError("InsufficientBalanceError")<{
  readonly address: Address
  readonly required: bigint
  readonly available: bigint
}> {
  readonly code = -32000
}

export class ForkError extends Data.TaggedError("ForkError")<{
  readonly method: string
  readonly cause: unknown
}> {}
```

**Error handling patterns:**
```typescript
// Catch specific error by tag
program.pipe(
  Effect.catchTag("InsufficientBalanceError", (e) =>
    Effect.succeed({ funded: false, needed: e.required - e.available })
  )
)

// Catch multiple error types
program.pipe(
  Effect.catchTags({
    InsufficientBalanceError: (e) => Effect.succeed("needs funds"),
    NonceTooLowError: (e) => Effect.succeed("retry with higher nonce"),
    RevertError: (e) => Effect.succeed(`reverted: ${e.reason}`)
  })
)
```

**EVM error mapping** (`packages/evm-effect/src/mapEvmError.ts`):
- Pattern-matches EVM execution error strings ("out of gas", "revert", "invalid opcode", "stack overflow")
- Maps to appropriate TaggedError type
- Preserves original error as `cause`
- Falls back to `TevmError` for unknown errors

### 10.3 Fork Chain in Effect

The fork architecture composes three foundation services into a full execution environment:

```
ForkConfigService → TransportService → CommonService
        │                 │                  │
        └─────────┬───────┘                  │
                  │                          │
         BlockchainService ◄────────────────┘
                  │
         StateManagerService
                  │
              EvmService
                  │
               VmService
```

**ForkConfigFromRpc** -- resolves fork config dynamically from RPC:
```typescript
export const ForkConfigFromRpc: Layer.Layer<ForkConfigService, ForkError, TransportService> =
  Layer.effect(ForkConfigService,
    Effect.gen(function* () {
      const transport = yield* TransportService
      const [chainIdHex, blockNumberHex] = yield* Effect.all([
        transport.request<string>("eth_chainId"),
        transport.request<string>("eth_blockNumber")
      ])
      return {
        chainId: BigInt(chainIdHex),
        blockTag: BigInt(blockNumberHex)
      }
    })
  )
```

**Fork vs Local base layers:**
```typescript
const ForkBaseLive = (options: ForkOptions) =>
  HttpTransport({
    url: options.url,
    timeout: options.timeout,
    headers: options.headers,
    batch: options.batch
  }).pipe(
    Layer.provideMerge(
      options.blockTag !== undefined
        ? ForkConfigStatic({ chainId: options.chainId ?? 1n, blockTag: options.blockTag })
        : ForkConfigFromRpc
    )
  )

const LocalBaseLive = (options: TevmNodeOptions) =>
  TransportNoop.pipe(
    Layer.provideMerge(ForkConfigStatic({
      chainId: BigInt(options.common?.id ?? 900),
      blockTag: 0n
    })),
    Layer.provideMerge(CommonFromConfig({
      chainId: options.common?.id,
      hardfork: options.hardfork ?? "prague",
      eips: options.eips
    }))
  )
```

### 10.4 Full Layer Composition

The RFC defines a complete layer composition pattern for TevmNode:

```typescript
// EVM stack: all core execution services
const EvmStackLive: Layer.Layer<
  VmService | EvmService | StateManagerService | BlockchainService | TxPoolService | ReceiptManagerService,
  never,
  CommonService | TransportService | ForkConfigService
> = Layer.empty.pipe(
  Layer.provideMerge(BlockchainLive),
  Layer.provideMerge(StateManagerLive),
  Layer.provideMerge(EvmLive),
  Layer.provideMerge(VmLive),
  Layer.provideMerge(TxPoolLive),
  Layer.provideMerge(ReceiptManagerLive)
)

// Node state services using Ref for mutable state
const NodeStateLive: Layer.Layer<
  ImpersonationService | BlockParamsService | SnapshotService | FilterService | MiningService,
  never,
  StateManagerService | VmService | TxPoolService
> = Layer.mergeAll(
  ImpersonationLive,
  BlockParamsLive
).pipe(
  Layer.provideMerge(SnapshotLive),
  Layer.provideMerge(FilterLive),
  Layer.provideMerge(MiningLive)
)

// TevmNode orchestrator
const TevmNodeLive: Layer.Layer<TevmNodeService, never, /* all dependencies */> =
  Layer.effect(TevmNodeService,
    Effect.gen(function* () {
      const vm = yield* VmService
      const txPool = yield* TxPoolService
      const stateManager = yield* StateManagerService
      const blockchain = yield* BlockchainService
      const common = yield* CommonService
      const logger = yield* LoggerService

      const statusRef = yield* Ref.make<NodeStatus>("INITIALIZING")

      // Wait for all services to be ready
      yield* Effect.all([blockchain.ready, stateManager.ready, vm.ready])
      yield* Ref.set(statusRef, "READY")

      return { /* TevmNode interface */ }
    })
  )
```

**User code:** Single provide at composition root:
```typescript
const program = Effect.gen(function* () {
  const node = yield* TevmNodeService
  yield* node.ready
  const vm = yield* node.vm
  const result = yield* vm.runTx({ tx: myTx })
  return result
}).pipe(
  Effect.provide(TevmNode.Live({
    fork: { url: "https://mainnet.optimism.io" }
  }))
)
```

### 10.5 Service Catalog

**Foundation services:**
| Service | Tag | Description |
|---------|-----|-------------|
| LoggerService | `"LoggerService"` | Structured logging |
| TransportService | `"TransportService"` | HTTP/IPC transport |
| ForkConfigService | `"ForkConfigService"` | Chain ID + block tag |

**Core EVM services:**
| Service | Tag | Description |
|---------|-----|-------------|
| CommonService | `"CommonService"` | Chain configuration |
| BlockchainService | `"BlockchainService"` | Block storage/retrieval |
| StateManagerService | `"StateManagerService"` | Account/storage state |
| EvmService | `"EvmService"` | EVM execution |
| VmService | `"VmService"` | VM orchestration (runTx, runBlock) |

**Node state services (using Ref):**
| Service | Tag | Description |
|---------|-----|-------------|
| ImpersonationService | `"ImpersonationService"` | Account impersonation |
| BlockParamsService | `"BlockParamsService"` | Next block parameters |
| SnapshotService | `"SnapshotService"` | Snapshot/revert |
| FilterService | `"FilterService"` | eth_newFilter tracking |
| MiningService | `"MiningService"` | Block mining control |

**Orchestration:**
| Service | Tag | Description |
|---------|-----|-------------|
| TevmNodeService | `"TevmNodeService"` | Top-level orchestrator |

### 10.6 Migration Strategy (Four Phases)

The RFC outlines a bottom-up migration approach:

| Phase | Duration | Scope | Key Deliverables |
|-------|----------|-------|-----------------|
| 1. Foundation | 2-3 weeks | errors, utils, logger, rlp | TaggedError types, interop helpers |
| 2. Core | 3-4 weeks | common, state, blockchain, evm, vm | All service interfaces, Live/Test layers |
| 3. Node & Actions | 3-4 weeks | node, txpool, actions, procedures | TevmNode.Live, Effect-based handlers |
| 4. Client | 2-3 weeks | memory-client, decorators, server | Full Effect API surface |

### 10.7 Key Insight for Chop

TEVM is migrating TO Effect from Promises. Chop can start WITH Effect from the beginning, avoiding the dual-layer approach. Key learnings:
- The Service/Live/Test layer pattern is well-suited for EVM operations
- `Effect.tryPromise` is the bridge for wrapping WASM bindings
- `Data.TaggedError` provides typed error channels with `catchTag` recovery
- Layer composition via `Layer.provideMerge` chains handle complex DI graphs
- `Layer.scoped` + `Effect.acquireRelease` for resource lifecycle (HTTP clients, WASM instances)
- `Ref.make` for mutable state within Effect (status, filters, impersonation)
- `Layer.mergeAll` for combining independent services at the same level

---

## 11. Error Handling

**Key files:**
- `/Users/williamcory/tevm-monorepo/packages/errors/src/ethereum/BaseError.js`
- `/Users/williamcory/tevm-monorepo/packages/errors/src/ethereum/` (30+ error types)
- `/Users/williamcory/tevm-monorepo/packages/errors-effect/src/TevmError.js`

### Legacy Pattern (Promise-based)
```javascript
export class BaseError extends Error {
  constructor(shortMessage, args, _tag, code = 0) {
    // _tag for pattern matching, code for JSON-RPC
    this._tag = _tag
    this.code = code
    this.shortMessage = shortMessage
    this.details = /* extracted from cause chain */
    this.docsPath = args.docsPath
  }

  walk(fn) { /* traverse error chain */ }
}

// Specific error:
export class InsufficientFundsError extends BaseError {
  constructor(params) {
    super('Insufficient funds', params, 'InsufficientFundsError', -32000)
  }
}
```

### maybeThrowOnFail Pattern
A key utility throughout TEVM:
```javascript
const maybeThrowOnFail = (throwOnFail, result) => {
  if (throwOnFail && result.errors?.length > 0) {
    throw result.errors[0]
  }
  return result
}
```

This allows callers to choose between:
- Throwing mode (default for handler API)
- Return-errors mode (always used by JSON-RPC procedures)

---

## 12. Build System

### tsup Configuration
**Key file:** `/Users/williamcory/tevm-monorepo/configs/tsupconfig/src/createTsupOptions.js`

```javascript
export const createTsUpOptions = ({ entry, outDir, target, format }) => ({
  name,
  entry: entry ?? ['src/index.js'],
  outDir: outDir ?? 'dist',
  target: targets[target ?? 'js'],
  format: format ?? ['cjs', 'esm'],
  splitting: false,
  treeshake: true,
  sourcemap: true,
  clean: false,
  skipNodeModulesBundle: true,
})
```

Each package has a minimal tsup.config.js:
```javascript
import { createTsUpOptions } from '@tevm/tsupconfig'
export default createTsUpOptions({ entry: ['src/index.ts'] })
```

### Dual CJS/ESM Output
All packages output both:
- `.js` / `.d.ts` (ESM)
- `.cjs` / `.d.cts` (CJS)

Package.json exports map:
```json
{
  "exports": {
    ".": {
      "import": { "types": "./types/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

### Package Quality Checks
- `publint --strict` - Validates package.json correctness
- `attw` (are-the-types-wrong) - Validates type exports
- `depcheck` - Validates dependency declarations

---

## 13. Testing Setup

### Vitest Configuration
**Key file:** `/Users/williamcory/tevm-monorepo/vitest.projects.ts`

```typescript
export default [
  'packages/*/vitest.config.ts',
  'configs/*/vitest.config.ts',
  'bundler-packages/*/vitest.config.ts',
  'examples/*/vitest.config.ts',
]
```

Per-package vitest config:
```typescript
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: 'node',
    coverage: {
      include: ['src/**/*.js'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
    },
  },
})
```

### Test Patterns
- Tests co-located with source: `callHandler.spec.ts` next to `callHandler.js`
- Vitest with `@vitest/coverage-v8`
- Shared test utilities in `test/` workspace package
- `extensions/test-node` provides snapshot-based test helpers

---

## 14. CLI Implementation

**Key files:**
- `/Users/williamcory/tevm-monorepo/cli/src/cli.tsx` (entry point)
- `/Users/williamcory/tevm-monorepo/cli/src/commands/` (40+ commands)

### Architecture
The CLI uses **Pastel** (React/Ink-based CLI framework):

```tsx
import Pastel from 'pastel'

const app = new Pastel({
  name: 'tevm',
  version: '0.0.0',
  description: 'Tevm CLI tool',
  importMeta: import.meta,
})

await app.run()
```

### CLI Structure
```
cli/src/
  cli.tsx              # Entry point (Pastel app)
  commands/            # One file per command
    call.tsx           # tevm call
    contract.tsx       # tevm contract
    serve.tsx          # tevm serve (JSON-RPC server)
    mine.tsx           # tevm mine
    getAccount.tsx     # tevm getAccount
    setAccount.tsx     # tevm setAccount
    deploy.tsx         # tevm deploy
    compile.tsx        # tevm compile
    generate.tsx       # tevm generate
    tsc.tsx            # tevm tsc (TypeScript compiler)
    ...
  components/          # Shared React/Ink UI components
  hooks/               # React hooks for state
  state/               # State management
  stores/              # Data stores
  utils/               # Utilities
```

Each command is a React component rendered with Ink.

---

## 15. Key Patterns for Chop

### 15.1 Handler/Procedure Separation
**Adopt this pattern.** Separate business logic (handler) from serialization (procedure). This enables:
- Tree-shaking: Users import only the handlers they need
- Testing: Test handlers without JSON-RPC overhead
- Reuse: Same handler serves multiple protocols (JSON-RPC, CLI, programmatic)

### 15.2 Curried Factory Pattern
```javascript
const handler = (node) => (params) => result
```
All actions take the node as the first argument and return a function. This enables:
- Partial application (bind node once, reuse handler)
- Composability (handlers can call other handlers)
- Testing (mock node easily)

### 15.3 Deep Copy for Isolation
TEVM uses `deepCopy()` extensively to create isolated execution environments:
- Mining clones VM before building blocks, then copies state back
- `callHandler` clones VM for non-latest block tags
- `pending` block tag creates a temporary client with pending txs mined

### 15.4 State Manager as Decorator Pattern
Instead of a monolithic class, state operations are individual functions that take BaseState:
```javascript
const getAccount = (baseState) => (address) => { ... }
const putAccount = (baseState) => (address, account) => { ... }
```
The StateManager is composed by applying all these functions.

### 15.5 Extend/Plugin System
Both TevmNode and viem Client use the same `extend()` pattern:
```javascript
const extended = base.extend((client) => ({
  newMethod: () => doSomethingWith(client)
}))
```

### 15.6 Effect Service Architecture
For Chop starting with Effect from day one:
```
Service Tag    -> Context.GenericTag (interface declaration)
Live Layer     -> Layer.effect (production implementation)
Test Layer     -> Layer.succeed (test mock)
Local Layer    -> Layer.effect (local mode, no network)
```

Compose via `Layer.provide`:
```javascript
const AppLayer = GetAccountLive.pipe(
  Layer.provide(StateManagerLocal),
  Layer.provide(CommonLocal)
)
```

### 15.7 Error Architecture
Two-tier error system:
1. **Typed errors** with `_tag` for pattern matching and `code` for JSON-RPC
2. **maybeThrowOnFail** pattern - callers choose throw vs return

For Effect: Use `Data.TaggedError` with typed error channels.

### 15.8 Fork Mode as Lazy Cache
Fork mode does not download full state. It:
1. Pins to a specific block number
2. Lazily fetches account/storage/code on first access
3. Caches fetched data in local LRU caches
4. Local modifications overlay the fork cache
5. Uses `eth_getProof` for account data (gets balance, nonce, codeHash, storageHash)

### 15.9 Umbrella Package Pattern
The `tevm` package re-exports all sub-packages via subpath exports:
```json
{
  "exports": {
    ".": "./index.js",
    "./actions": "./actions/index.js",
    "./node": "./node/index.js",
    "./state": "./state/index.js"
  }
}
```
Users can import from `tevm/actions` or `@tevm/actions` interchangeably.

---

## 16. Architecture Diagram for Chop Reference

```
USER API
  createMemoryClient() -> viem Client + TEVM extensions
       |
       v
TRANSPORT LAYER
  createTevmTransport() -> viem Transport wrapping TevmNode
       |
       v
NODE LAYER (TevmNode)
  createTevmNode() -> Core orchestrator
  - Owns: VM, TxPool, ReceiptsManager, Blockchain, StateManager
  - Manages: Filters, Snapshots, Impersonation, Mining Config
  - Supports: extend(), deepCopy(), ready()
       |
       v
ACTION LAYER
  callHandler(node) -> (params) -> result
  getAccountHandler(node) -> (params) -> result
  mineHandler(node) -> (params) -> result
  ... (each action is independent, tree-shakable)
       |
       v
PROCEDURE LAYER (JSON-RPC)
  callProcedure(node) -> (jsonRpcRequest) -> jsonRpcResponse
  requestProcedure(node) -> (request) -> response  [router]
       |
       v
SERVER LAYER
  createServer(client) -> http.Server
  createHttpHandler(client) -> (req, res) -> void
  createExpressMiddleware(client) -> express middleware
```

---

## 17. Key Reference Files Summary

| Concept | File Path |
|---------|-----------|
| Node type definition | `/Users/williamcory/tevm-monorepo/packages/node/src/TevmNode.ts` |
| Node implementation | `/Users/williamcory/tevm-monorepo/packages/node/src/createTevmNode.js` |
| Memory client | `/Users/williamcory/tevm-monorepo/packages/memory-client/src/createMemoryClient.js` |
| TEVM transport | `/Users/williamcory/tevm-monorepo/packages/memory-client/src/createTevmTransport.js` |
| Call handler | `/Users/williamcory/tevm-monorepo/packages/actions/src/Call/callHandler.js` |
| Call procedure | `/Users/williamcory/tevm-monorepo/packages/actions/src/Call/callProcedure.js` |
| Request router | `/Users/williamcory/tevm-monorepo/packages/actions/src/createHandlers.js` |
| Request dispatcher | `/Users/williamcory/tevm-monorepo/packages/actions/src/requestProcedure.js` |
| State manager | `/Users/williamcory/tevm-monorepo/packages/state/src/createStateManager.js` |
| Base state | `/Users/williamcory/tevm-monorepo/packages/state/src/createBaseState.js` |
| Fork state fetch | `/Users/williamcory/tevm-monorepo/packages/state/src/actions/getAccountFromProvider.js` |
| EVM creation | `/Users/williamcory/tevm-monorepo/packages/evm/src/createEvm.js` |
| Mine handler | `/Users/williamcory/tevm-monorepo/packages/actions/src/Mine/mineHandler.js` |
| Server creation | `/Users/williamcory/tevm-monorepo/packages/server/src/createServer.js` |
| HTTP handler | `/Users/williamcory/tevm-monorepo/packages/server/src/createHttpHandler.js` |
| Decorators | `/Users/williamcory/tevm-monorepo/packages/decorators/src/actions/tevmActions.js` |
| GetAccount handler | `/Users/williamcory/tevm-monorepo/packages/actions/src/GetAccount/getAccountHandler.js` |
| Effect Service | `/Users/williamcory/tevm-monorepo/packages/state-effect/src/StateManagerService.js` |
| Effect Live Layer | `/Users/williamcory/tevm-monorepo/packages/state-effect/src/StateManagerLocal.js` |
| Effect Action Service | `/Users/williamcory/tevm-monorepo/packages/actions-effect/src/GetAccountService.js` |
| Effect Action Live | `/Users/williamcory/tevm-monorepo/packages/actions-effect/src/GetAccountLive.js` |
| Effect Error Base | `/Users/williamcory/tevm-monorepo/packages/errors-effect/src/TevmError.js` |
| Base Error | `/Users/williamcory/tevm-monorepo/packages/errors/src/ethereum/BaseError.js` |
| Effect RFC | `/Users/williamcory/tevm-monorepo/TEVM_EFFECT_MIGRATION_RFC.md` |
| Tsup shared config | `/Users/williamcory/tevm-monorepo/configs/tsupconfig/src/createTsupOptions.js` |
| Vitest projects | `/Users/williamcory/tevm-monorepo/vitest.projects.ts` |
| CLI entry | `/Users/williamcory/tevm-monorepo/cli/src/cli.tsx` |
| Nx config | `/Users/williamcory/tevm-monorepo/nx.json` |
| Workspace config | `/Users/williamcory/tevm-monorepo/pnpm-workspace.yaml` |
| Root package.json | `/Users/williamcory/tevm-monorepo/package.json` |

---

## 18. What Chop Should Adopt vs Diverge

### Adopt
1. **Handler/Procedure separation** - Core architectural pattern for all EVM operations
2. **Curried factory pattern** - `handler(node)(params)` enables composition and testing
3. **State as composition of functions** - Tree-shakable, testable state operations
4. **Extend/plugin system** - Composable client extensions
5. **Dual CJS/ESM** - tsup with `['cjs', 'esm']` format for broad compatibility
6. **Deep copy for isolation** - Essential for mining and block-specific queries
7. **Fork mode as lazy cache** - Pin block, lazy fetch, LRU cache overlay
8. **Error taxonomy** - Typed errors with tags and JSON-RPC codes
9. **Snapshot/revert** - State checkpointing for test isolation
10. **Package quality tooling** - publint, attw, depcheck

### Diverge (Start with Effect from day one)
1. **No Promise chains** - Use Effect Layers for dependency resolution instead of `createTevmNode`'s 10+ promise chain
2. **No mutable closures** - Use Effect `Ref` instead of 15+ closure-captured variables
3. **No maybeThrowOnFail** - Use typed error channels from the start
4. **No manual DI** - Use `Context.Tag` and `Layer` composition
5. **No deepCopy hacks** - Use Effect `Scope` and `Ref` for managed state
6. **Zig-based EVM** - Instead of ethereumjs, wrap Zig EVM with Effect
7. **Build system** - Zig build system for core, potentially bun/tsup for JS layer only
