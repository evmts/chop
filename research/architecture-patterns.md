# Architecture Patterns: Cross-Cutting Effect.ts Reference

Consolidated patterns from guillotine-mini client-ts, TEVM monorepo, and voltaire-effect for the chop TypeScript migration.

---

## Table of Contents

1. [The Service Triple: Context.Tag + Layer + Data.TaggedError](#1-the-service-triple)
2. [Layer Composition Strategies](#2-layer-composition-strategies)
3. [Resource Lifecycle with acquireRelease](#3-resource-lifecycle-with-acquirerelease)
4. [Journal-Based State Management](#4-journal-based-state-management)
5. [Fork Architecture](#5-fork-architecture)
6. [Error Union Types and catchTag Recovery](#6-error-union-types-and-catchtag-recovery)
7. [Testing Patterns](#7-testing-patterns)
8. [Mutable State with Ref](#8-mutable-state-with-ref)
9. [Branded Types for Domain Safety](#9-branded-types-for-domain-safety)
10. [Application Composition Root](#10-application-composition-root)

---

## 1. The Service Triple

Every service in the Effect architecture follows a three-part pattern:

### 1.1 Interface + Context.Tag

Define what the service does and give it a unique identity:

```typescript
import { Context, Effect } from "effect"

// 1. Define the service interface
interface WorldStateService {
  readonly getAccount: (address: AddressType) => Effect.Effect<AccountStateType>
  readonly setAccount: (address: AddressType, account: AccountStateType | null) => Effect.Effect<void>
  readonly getStorage: (address: AddressType, slot: StorageSlotType) => Effect.Effect<StorageValueType>
  readonly setStorage: (address: AddressType, slot: StorageSlotType, value: StorageValueType) => Effect.Effect<void, MissingAccountError>
  readonly takeSnapshot: () => Effect.Effect<WorldStateSnapshot>
  readonly restoreSnapshot: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
  readonly commitSnapshot: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
  readonly clear: () => Effect.Effect<void>
}

// 2. Create the Context.Tag (identity for DI)
class WorldState extends Context.Tag("WorldState")<WorldState, WorldStateService>() {}
```

### 1.2 Layer (Implementation)

Provide the concrete implementation as a Layer:

```typescript
import { Layer } from "effect"

// Layer.effect -- most common, for services built from Effects
const WorldStateLive: Layer.Layer<WorldState, never, Journal> = Layer.effect(
  WorldState,
  Effect.gen(function* () {
    const journal = yield* Journal  // Dependency injection via yield*

    const accounts = new Map<string, AccountStateType>()
    const storage = new Map<string, Map<string, StorageValueType>>()

    return {
      getAccount: (address) => Effect.sync(() => accounts.get(toKey(address)) ?? EMPTY_ACCOUNT),
      setAccount: (address, account) => Effect.gen(function* () {
        yield* journal.append({ key: `account:${toKey(address)}`, value: accounts.get(toKey(address)) ?? null, tag: "Update" })
        if (account === null) accounts.delete(toKey(address))
        else accounts.set(toKey(address), account)
      }),
      // ... remaining methods
    }
  })
)
```

### 1.3 Data.TaggedError (Typed Errors)

Define errors with discriminant tags for pattern matching:

```typescript
import { Data } from "effect"

class MissingAccountError extends Data.TaggedError("MissingAccountError")<{
  readonly address: AddressType
}> {}

class InvalidSnapshotError extends Data.TaggedError("InvalidSnapshotError")<{
  readonly snapshotId: number
  readonly message: string
}> {}
```

### 1.4 Convenience Functions

Export helper functions that access the service from context:

```typescript
const getAccount = (address: AddressType) =>
  Effect.flatMap(WorldState, (state) => state.getAccount(address))

const setStorage = (address: AddressType, slot: StorageSlotType, value: StorageValueType) =>
  Effect.flatMap(WorldState, (state) => state.setStorage(address, slot, value))
```

---

## 2. Layer Composition Strategies

### 2.1 Layer.effect -- Standard Service Construction

Most services use this. The `Effect.gen` function can `yield*` other services for DI:

```typescript
const HostAdapterLive: Layer.Layer<HostAdapter, never, WorldState> = Layer.effect(
  HostAdapter,
  Effect.gen(function* () {
    const state = yield* WorldState  // Inject WorldState dependency
    return {
      getBalance: (address) => Effect.flatMap(state.getAccount(address), (a) => Effect.succeed(a.balance)),
      // ...
    }
  })
)
```

### 2.2 Layer.succeed -- Pure/Static Values

For services with no effectful construction:

```typescript
const ReleaseSpecPrague: Layer.Layer<ReleaseSpec> = Layer.succeed(ReleaseSpec, {
  hardfork: "prague",
  isEip2028Enabled: true,
  isEip2930Enabled: true,
  isEip3860Enabled: true,
  isEip7623Enabled: true,
  isEip7702Enabled: true,
})

const ForkConfigStatic = (config: ForkConfigShape): Layer.Layer<ForkConfigService> =>
  Layer.succeed(ForkConfigService, config)
```

### 2.3 Layer.scoped -- Resource-Managing Services

For services that own resources requiring cleanup:

```typescript
const BlockchainLive: Layer.Layer<Blockchain, never, BlockStore> = Layer.scoped(
  Blockchain,
  Effect.gen(function* () {
    const blockStore = yield* BlockStore
    const pubsub = yield* PubSub.unbounded<BlockchainEvent>()  // Managed by scope

    return {
      subscribe: () => pubsub.subscribe,
      putBlock: (block) => Effect.gen(function* () {
        yield* blockStore.putBlock(block)
        yield* pubsub.publish({ type: "BlockSuggested", block })
      }),
      // ...
    }
  })
)
```

### 2.4 Layer.provide -- Satisfying Dependencies

Connect a service layer to its dependency layer:

```typescript
// WorldStateLive requires Journal → provide JournalLive
const WorldStateProvided: Layer.Layer<WorldState> =
  WorldStateLive.pipe(Layer.provide(JournalLive()))
```

### 2.5 Layer.provideMerge -- Building Up Layer Stacks

Chains dependencies while merging provided services into the output:

```typescript
const ForkBaseLive = (options: ForkOptions) =>
  HttpTransport({ url: options.url }).pipe(
    Layer.provideMerge(
      options.blockTag !== undefined
        ? ForkConfigStatic({ chainId: options.chainId ?? 1n, blockTag: options.blockTag })
        : ForkConfigFromRpc
    )
  )
// Output: Layer providing TransportService + ForkConfigService
```

### 2.6 Layer.mergeAll -- Combining Independent Services

For services at the same level with no interdependencies:

```typescript
const NodeStateLive = Layer.mergeAll(
  ImpersonationLive,
  BlockParamsLive,
).pipe(
  Layer.provideMerge(SnapshotLive),
  Layer.provideMerge(FilterLive),
  Layer.provideMerge(MiningLive),
)
```

### 2.7 Building a Full Stack

From TEVM's EvmStackLive pattern:

```typescript
const EvmStackLive: Layer.Layer<
  VmService | EvmService | StateManagerService | BlockchainService | TxPoolService,
  never,
  CommonService | TransportService | ForkConfigService
> = Layer.empty.pipe(
  Layer.provideMerge(BlockchainLive),
  Layer.provideMerge(StateManagerLive),
  Layer.provideMerge(EvmLive),
  Layer.provideMerge(VmLive),
  Layer.provideMerge(TxPoolLive),
)
```

### 2.8 Parameterized Layers

For configurable services:

```typescript
const TxPoolLive = (config: TxPoolConfig): Layer.Layer<TxPool, InvalidTxPoolConfigError> =>
  Layer.effect(TxPool, makeTxPool(config))

const ReleaseSpecLive = (hardfork: HardforkType): Layer.Layer<ReleaseSpec> =>
  Layer.succeed(ReleaseSpec, makeReleaseSpec(hardfork))
```

---

## 3. Resource Lifecycle with acquireRelease

### 3.1 WASM Module Lifecycle

```typescript
const EvmWasmLive: Layer.Layer<EvmWasm> = Layer.scoped(
  EvmWasm,
  Effect.gen(function* () {
    const instance = yield* Effect.acquireRelease(
      // Acquire: load and instantiate WASM module
      Effect.tryPromise({
        try: async () => {
          const wasmBytes = await loadWasmBytes()
          const module = await WebAssembly.compile(wasmBytes)
          const instance = await WebAssembly.instantiate(module, imports)
          return instance
        },
        catch: (e) => new WasmLoadError({ cause: e }),
      }),
      // Release: cleanup WASM resources
      (instance) => Effect.sync(() => {
        instance.exports.cleanup()
      })
    )

    return {
      execute: (params) => Effect.sync(() => {
        // Use instance.exports.* to call WASM functions
      }),
    }
  })
)
```

### 3.2 HTTP Client Lifecycle

From TEVM's HttpTransport:

```typescript
const HttpTransport = (config: TransportConfig): Layer.Layer<TransportService> =>
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
          ),
      }
    })
  )
```

### 3.3 Subscription Lifecycle

```typescript
const subscribe = () =>
  Effect.acquireRelease(
    pubsub.subscribe,
    (queue) => Queue.shutdown(queue)
  )
```

---

## 4. Journal-Based State Management

### 4.1 The Journal Pattern

The journal enables snapshot/restore semantics for nested EVM calls:

```typescript
interface JournalService<K, V> {
  readonly append: (entry: JournalEntry<K, V>) => Effect.Effect<number>
  readonly takeSnapshot: () => Effect.Effect<JournalSnapshot>
  readonly restore: (snapshot: JournalSnapshot, onRevert?: (entry: JournalEntry<K, V>) => Effect.Effect<void>) => Effect.Effect<void, InvalidSnapshotError>
  readonly commit: (snapshot: JournalSnapshot) => Effect.Effect<void, InvalidSnapshotError>
  readonly clear: () => Effect.Effect<void>
  readonly entries: () => Effect.Effect<ReadonlyArray<JournalEntry<K, V>>>
}

// Change tracking tags
type ChangeTag = "JustCache" | "Update" | "Create" | "Delete" | "Touch"

interface JournalEntry<K, V> {
  readonly key: K
  readonly value: V | null  // null = key didn't exist before
  readonly tag: ChangeTag
}

// Snapshot is just a position marker
type JournalSnapshot = number
const EMPTY_SNAPSHOT = -1
```

### 4.2 WorldState Using Journal

WorldState wraps a journal with two maps (accounts, storage):

```typescript
const makeWorldState = Effect.gen(function* () {
  const journal = yield* Journal

  const accounts = new Map<AccountKey, AccountStateType>()
  const storage = new Map<AccountKey, Map<StorageKey, StorageValueType>>()
  const snapshotStack: WorldStateSnapshot[] = []
  const createdAccountFrames: Set<AccountKey>[] = []

  return {
    setStorage: (address, slot, value) =>
      Effect.gen(function* () {
        const account = accounts.get(toKey(address))
        if (!account) return yield* Effect.fail(new MissingAccountError({ address }))

        // Journal the previous value for potential rollback
        const storageMap = storage.get(toKey(address)) ?? new Map()
        const previous = storageMap.get(toSlotKey(slot)) ?? null
        yield* journal.append({
          key: `storage:${toKey(address)}:${toSlotKey(slot)}`,
          value: previous,
          tag: "Update",
        })

        storageMap.set(toSlotKey(slot), value)
        storage.set(toKey(address), storageMap)
      }),

    takeSnapshot: () =>
      Effect.gen(function* () {
        const snapshot = yield* journal.takeSnapshot()
        createdAccountFrames.push(new Set())
        snapshotStack.push(snapshot)
        return snapshot
      }),

    restoreSnapshot: (snapshot) =>
      journal.restore(snapshot, (entry) =>
        // Revert handler: undo the change by restoring previous value
        Effect.sync(() => {
          if (entry.key.startsWith("account:")) {
            const key = entry.key.slice(8)
            if (entry.value === null) accounts.delete(key)
            else accounts.set(key, entry.value as AccountStateType)
          }
          // ... similar for storage entries
        })
      ),
  }
})
```

### 4.3 Nested Call Semantics

```
CALL depth 0: takeSnapshot() → snapshot_0
  CALL depth 1: takeSnapshot() → snapshot_1
    SSTORE key=X value=42
    ← REVERT: restoreSnapshot(snapshot_1) undoes SSTORE
  CALL depth 1: takeSnapshot() → snapshot_2
    SSTORE key=Y value=99
    ← SUCCESS: commitSnapshot(snapshot_2)
← SUCCESS: commitSnapshot(snapshot_0)
```

---

## 5. Fork Architecture

### 5.1 Service Chain

The fork architecture layers three foundation services:

```
TransportService (HTTP client to remote RPC)
       │
       ▼
ForkConfigService (chainId + blockTag, resolved from RPC or static)
       │
       ▼
CommonService (chain params, hardfork config)
       │
       ├───────────────┐
       ▼               ▼
BlockchainService  StateManagerService
       │               │
       └───────┬───────┘
               ▼
          EvmService
               │
               ▼
           VmService
```

### 5.2 Fork vs Local Mode

```typescript
// Fork mode: fetch from remote RPC
const ForkBaseLive = (options: ForkOptions) =>
  HttpTransport({ url: options.url, batch: options.batch }).pipe(
    Layer.provideMerge(
      options.blockTag !== undefined
        ? ForkConfigStatic({ chainId: options.chainId ?? 1n, blockTag: options.blockTag })
        : ForkConfigFromRpc  // Dynamically fetch chainId + blockNumber
    )
  )

// Local mode: no network, genesis state
const LocalBaseLive = (options: TevmNodeOptions) =>
  TransportNoop.pipe(
    Layer.provideMerge(ForkConfigStatic({
      chainId: BigInt(options.common?.id ?? 900),
      blockTag: 0n,
    })),
    Layer.provideMerge(CommonFromConfig({
      chainId: options.common?.id,
      hardfork: options.hardfork ?? "prague",
    }))
  )
```

### 5.3 Lazy State Loading

Fork mode doesn't download full state. It lazily fetches on demand:

```typescript
const getAccountFromProvider = (transport: TransportService) => (address: Address) =>
  Effect.gen(function* () {
    const accountData = yield* transport.request("eth_getProof", [
      address, [], blockTag
    ]).pipe(
      Effect.mapError((e) => new ForkError({ method: "eth_getProof", cause: e }))
    )

    return {
      balance: BigInt(accountData.balance),
      nonce: BigInt(accountData.nonce),
      codeHash: fromHex(accountData.codeHash),
      storageRoot: fromHex(accountData.storageHash),
    }
  })
```

### 5.4 Two-Cache System

```
┌──────────────────────────────┐
│     Local Cache (writes)     │  ← User modifications
├──────────────────────────────┤
│     Fork Cache (reads)       │  ← Lazily fetched from RPC
├──────────────────────────────┤
│     Remote RPC               │  ← Source of truth at pinned block
└──────────────────────────────┘

Read path:  local cache → fork cache → fetch from RPC → cache
Write path: always to local cache
```

---

## 6. Error Union Types and catchTag Recovery

### 6.1 Defining Error Unions

Each service operation returns a specific error union:

```typescript
// Individual errors
class InvalidTransactionError extends Data.TaggedError("InvalidTransactionError")<{
  readonly reason: string
}> {}

class InsufficientBalanceError extends Data.TaggedError("InsufficientBalanceError")<{
  readonly address: AddressType
  readonly required: bigint
  readonly available: bigint
}> {}

class GasPriceBelowBaseFeeError extends Data.TaggedError("GasPriceBelowBaseFeeError")<{
  readonly gasPrice: bigint
  readonly baseFee: bigint
}> {}

// Error union type for a specific operation
type TransactionFeeError =
  | InvalidTransactionError
  | InvalidBaseFeeError
  | InvalidGasPriceError
  | PriorityFeeGreaterThanMaxFeeError
  | InsufficientMaxFeePerGasError
  | GasPriceBelowBaseFeeError
  | UnsupportedTransactionTypeError
```

### 6.2 catchTag for Typed Recovery

```typescript
const processTransaction = (tx: Transaction) =>
  calculateEffectiveGasPrice(tx, baseFee).pipe(
    Effect.catchTag("GasPriceBelowBaseFeeError", (e) =>
      // Type-safe: e.gasPrice and e.baseFee are typed
      Effect.fail(new TransactionRejectedError({
        reason: `Gas price ${e.gasPrice} below base fee ${e.baseFee}`,
      }))
    ),
    Effect.catchTag("InsufficientBalanceError", (e) =>
      // Can recover by suggesting user get more funds
      Effect.succeed({ status: "rejected", needed: e.required - e.available })
    )
  )
```

### 6.3 catchTags for Multiple Recovery

```typescript
const handleEvmResult = (result: Effect.Effect<ExecutionResult, EvmError>) =>
  result.pipe(
    Effect.catchTags({
      OutOfGasError: (e) => Effect.succeed({ reverted: true, reason: "out of gas" }),
      RevertError: (e) => Effect.succeed({ reverted: true, reason: decodeRevert(e.data) }),
      InvalidOpcodeError: (e) => Effect.succeed({ reverted: true, reason: `invalid opcode at PC=${e.pc}` }),
      StackOverflowError: () => Effect.succeed({ reverted: true, reason: "stack overflow" }),
    })
  )
```

### 6.4 mapError for Wrapping

```typescript
// Wrap lower-level errors into domain errors
const getBalance = (address: AddressType) =>
  stateManager.getAccount(address).pipe(
    Effect.map((account) => account.balance),
    Effect.mapError((e) => new BalanceFetchError({ address, cause: e }))
  )
```

---

## 7. Testing Patterns

### 7.1 Fresh Layers Per Test

Each test gets a fresh service instance to prevent test pollution:

```typescript
import { it } from "@effect/vitest"

// Helper creates a fresh layer for each test invocation
const provideWorldState = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(WorldStateTest))

describe("WorldState", () => {
  it.effect("should store and retrieve accounts", () =>
    provideWorldState(
      Effect.gen(function* () {
        const state = yield* WorldState
        yield* state.setAccount(address, account)
        const retrieved = yield* state.getAccount(address)
        expect(retrieved).toEqual(account)
      })
    )
  )
})
```

### 7.2 Test Layers with Inlined Dependencies

```typescript
// Test layer provides all dependencies inline
const WorldStateTest: Layer.Layer<WorldState> =
  WorldStateLive.pipe(Layer.provide(JournalLive()))

const BlockchainTest: Layer.Layer<Blockchain> =
  BlockchainLive.pipe(Layer.provide(BlockStoreMemoryTest))

const IntrinsicGasCalculatorTest: Layer.Layer<IntrinsicGasCalculator> =
  IntrinsicGasCalculatorLive.pipe(Layer.provide(ReleaseSpecPrague))
```

### 7.3 it.effect for Effect-Native Tests

```typescript
import { it } from "@effect/vitest"

describe("TransactionProcessor", () => {
  it.effect("calculates effective gas price for EIP-1559", () =>
    Effect.gen(function* () {
      const processor = yield* TransactionProcessor
      const result = yield* processor.calculateEffectiveGasPrice(tx1559, baseFee)
      expect(result.effectiveGasPrice).toBe(expectedPrice)
    }).pipe(Effect.provide(TransactionProcessorTest))
  )

  it.effect("fails for gas price below base fee", () =>
    Effect.gen(function* () {
      const processor = yield* TransactionProcessor
      const exit = yield* processor.calculateEffectiveGasPrice(badTx, baseFee).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(TransactionProcessorTest))
  )
})
```

### 7.4 it.scoped for Scoped Resources

```typescript
it.scoped("manages blockchain subscription lifecycle", () =>
  Effect.gen(function* () {
    const blockchain = yield* Blockchain
    const queue = yield* blockchain.subscribe()  // Scoped resource
    yield* blockchain.putBlock(testBlock)
    const event = yield* Queue.take(queue)
    expect(event.type).toBe("BlockSuggested")
  }).pipe(Effect.provide(BlockchainTest))
)
```

### 7.5 Test Utilities

```typescript
// Factory functions for test data
const makeBlock = (overrides: Partial<Block> = {}): Block =>
  Schema.decodeSync(BlockSchema)({
    number: 1n,
    hash: blockHashFromByte(1),
    parentHash: blockHashFromByte(0),
    timestamp: 1000n,
    gasLimit: 30_000_000n,
    gasUsed: 0n,
    ...overrides,
  })

const blockHashFromByte = (byte: number): BlockHash =>
  Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? byte : 0)) as BlockHash
```

---

## 8. Mutable State with Ref

For services that need mutable state within Effect:

```typescript
const TevmNodeLive = Layer.effect(TevmNodeService,
  Effect.gen(function* () {
    const statusRef = yield* Ref.make<NodeStatus>("INITIALIZING")
    const filtersRef = yield* Ref.make(new Map<string, Filter>())
    const impersonatedRef = yield* Ref.make<Set<Address>>(new Set())

    return {
      status: Ref.get(statusRef),
      setStatus: (status: NodeStatus) => Ref.set(statusRef, status),

      addFilter: (filter: Filter) =>
        Ref.update(filtersRef, (filters) => {
          const newFilters = new Map(filters)
          newFilters.set(filter.id, filter)
          return newFilters
        }),

      isImpersonated: (address: Address) =>
        Ref.get(impersonatedRef).pipe(
          Effect.map((set) => set.has(address))
        ),
    }
  })
)
```

---

## 9. Branded Types for Domain Safety

### 9.1 voltaire-effect Branded Types

All Ethereum primitives use branded `Uint8Array` types for compile-time safety:

```typescript
// Shared brand symbol
declare const brand: unique symbol

// 20-byte branded type
type AddressType = Uint8Array & { readonly [brand]: "Address" }

// 32-byte branded type
type HashType = Uint8Array & { readonly [brand]: "Hash" }

// At runtime: both are Uint8Array
// At compile time: incompatible -- prevents mixing Address and Hash
```

### 9.2 Effect Schema for Validation at Boundaries

```typescript
import { Schema } from "effect"

const AddressFromHex = Schema.transformOrFail(
  Schema.String,
  AddressSchema,
  {
    decode: (hex) => {
      if (!hex.startsWith("0x") || hex.length !== 42) {
        return Effect.fail(new ParseError({ message: `Invalid address: ${hex}` }))
      }
      return Effect.succeed(Hex.toBytes(hex) as AddressType)
    },
    encode: (address) => Effect.succeed(Hex.fromBytes(address)),
  }
)
```

---

## 10. Application Composition Root

### 10.1 Single Provide Pattern

All layer composition happens at the application entry point:

```typescript
// GOOD: Single Effect.provide at the top level
const program = Effect.gen(function* () {
  const node = yield* TevmNodeService
  yield* node.ready

  const vm = yield* node.vm
  const result = yield* vm.runTx({ tx: myTx })
  return result
}).pipe(
  Effect.provide(
    TevmNode.Live({ fork: { url: "https://mainnet.optimism.io" } })
  )
)

// BAD: Scattered provides
const badProgram = Effect.gen(function* () {
  const vm = yield* VmService
}).pipe(
  Effect.provide(VmLive),
  Effect.provide(EvmLive),      // Manual wiring = error prone
  Effect.provide(StateLive),    // Missing dependencies = runtime error
)
```

### 10.2 CLI Entry Point Composition

For chop's CLI, the composition root lives in the command handler:

```typescript
const callCommand = Command.make("call", { address, data, value, rpcUrl }, (args) =>
  Effect.gen(function* () {
    const node = yield* TevmNodeService
    yield* node.ready
    const result = yield* callHandler(node)({ to: args.address, data: args.data, value: args.value })
    yield* Console.log(formatCallResult(result))
  }).pipe(
    Effect.provide(
      args.rpcUrl
        ? TevmNode.Fork({ url: args.rpcUrl })
        : TevmNode.Local()
    )
  )
)
```

### 10.3 MCP Server Composition

For chop's MCP server, the composition root wraps the server lifecycle:

```typescript
const mcpServer = Effect.gen(function* () {
  const node = yield* TevmNodeService
  const server = yield* McpServerService

  yield* server.addTool("call", callToolSchema, (params) =>
    callHandler(node)(params).pipe(
      Effect.map(formatResult),
      Effect.catchAll((e) => Effect.succeed({ error: e.message }))
    )
  )

  yield* server.start()
}).pipe(
  Effect.provide(
    Layer.mergeAll(TevmNode.Live(options), McpServerLive(config))
  ),
  Effect.scoped
)
```

---

## Quick Reference: When to Use What

| Pattern | When to Use |
|---------|-------------|
| `Layer.effect` | Service needs effectful construction or DI |
| `Layer.succeed` | Service is a pure value or configuration |
| `Layer.scoped` | Service owns resources (PubSub, connections, WASM) |
| `Layer.provide` | Satisfying a dependency |
| `Layer.provideMerge` | Satisfying dependency AND exposing it to siblings |
| `Layer.mergeAll` | Combining independent services at same level |
| `Effect.acquireRelease` | Resource lifecycle (acquire in Effect, release in finalizer) |
| `Data.TaggedError` | Domain errors with pattern matching |
| `Effect.catchTag` | Recovering from a specific error type |
| `Ref.make` | Mutable state within Effect |
| `Effect.tryPromise` | Bridging Promise-based code into Effect |

---

## Sources

- guillotine-mini client-ts: `/Users/williamcory/guillotine-mini/client-ts/`
- TEVM monorepo: `/Users/williamcory/tevm-monorepo/`
- TEVM Effect Migration RFC: `/Users/williamcory/tevm-monorepo/TEVM_EFFECT_MIGRATION_RFC.md`
- voltaire-effect: `/Users/williamcory/voltaire/`
- Effect documentation: https://effect.website/docs
