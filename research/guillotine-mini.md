# Guillotine-Mini: Comprehensive Research Document

## Table of Contents

1. [Overview](#overview)
2. [Architecture: Two EVMs, Two Philosophies](#architecture-two-evms-two-philosophies)
3. [Guillotine-Mini (Core EVM Engine)](#guillotine-mini-core-evm-engine)
4. [Guillotine (Full Optimized EVM)](#guillotine-full-optimized-evm)
5. [C FFI and WASM API Surface](#c-ffi-and-wasm-api-surface)
6. [Async Execution Protocol](#async-execution-protocol)
7. [TypeScript WASM Integration (Guillotine SDK)](#typescript-wasm-integration-guillotine-sdk)
8. [Client-TS: Effect TypeScript Execution Client](#client-ts-effect-typescript-execution-client)
9. [Hardfork Support](#hardfork-support)
10. [Gas Accounting](#gas-accounting)
11. [Tracing Support](#tracing-support)
12. [State Management](#state-management)
13. [Contract Deployment and Calls](#contract-deployment-and-calls)
14. [WASM Compilation](#wasm-compilation)
15. [Key Differences: Mini vs Full Guillotine](#key-differences-mini-vs-full-guillotine)
16. [Dependency Graph](#dependency-graph)
17. [Sources](#sources)

---

## Overview

The Guillotine ecosystem consists of two EVM implementations written in Zig, both created by the evmts/Tevm team:

- **Guillotine-Mini** (`/Users/williamcory/guillotine-mini/`) -- A minimal, spec-compliant EVM engine. Prioritizes correctness, clarity, and test coverage. It serves as the core execution engine for the full Guillotine client being built on top of it.

- **Guillotine** (`/Users/williamcory/chop/guillotine/`) -- An ultra-high-performance EVM with dispatch-based execution, opcode fusion, tailcall recursion, and a MinimalEvm sidecar for validation. It targets extreme throughput and competes with evmone and REVM for the fastest EVM.

Both are compiled to WASM for TypeScript consumption. The **client-ts** (`/Users/williamcory/guillotine-mini/client-ts/`) project builds an Effect-based TypeScript execution client layer on top of guillotine-mini -- handling state management, blockchain, transaction processing, and trie computation entirely in TypeScript with the Effect library.

---

## Architecture: Two EVMs, Two Philosophies

### Guillotine-Mini: Interpreter Model

```
Bytecode: [0x60, 0x01, 0x60, 0x02, 0x01, 0x00]
           PUSH1  1   PUSH1  2   ADD   STOP

Execution: frame.execute() -> while (pc < bytecode.len) {
    opcode = bytecode[pc]
    switch(opcode) { ... }   // Traditional switch-based interpreter
    pc++
}
```

**Key files:**
- `src/evm.zig` -- Orchestrator: state, storage, gas refunds, nested calls
- `src/frame.zig` -- Bytecode interpreter: stack, memory, PC, per-opcode logic
- `src/host.zig` -- Abstract state backend interface (vtable-based)
- `src/root_c.zig` -- C FFI / WASM export surface (configurable, with async protocol)

### Guillotine: Dispatch-Based Model

```
Bytecode: [0x60, 0x01, 0x60, 0x02, 0x01, 0x56, 0x5b, 0x00]

Dispatch Schedule (preprocessed):
[0] = first_block_gas { gas: 15 }     // Metadata for basic block
[1] = &push_handler                   // Function pointer
[2] = push_inline { value: 1 }        // Inline metadata
[3] = &push_handler
[4] = push_inline { value: 2 }
[5] = &add_handler
[6] = &jump_handler
[7] = &jumpdest_handler
[8] = jump_dest { gas: 3, min: 0 }
[9] = &stop_handler

Execution: cursor[0].opcode_handler(frame, cursor) -> tail calls next handler
```

No PC, no switch statement. Bytecode is analyzed once and converted to a dispatch schedule of function pointers. Handlers use `@tailCall` to jump directly to the next instruction, maximizing CPU branch prediction.

**Key files (in `/Users/williamcory/chop/guillotine/`):**
- `src/dispatch.zig` -- Builds optimized dispatch schedule from bytecode
- `src/frame.zig` -- Executes dispatch schedule (NOT bytecode directly)
- `src/handlers_*.zig` -- Per-category opcode handlers
- `src/tracer/tracer.zig` -- Differential testing against MinimalEvm sidecar

---

## Guillotine-Mini (Core EVM Engine)

### Module Structure

```
src/
  evm.zig               -- EVM orchestrator (state, storage, gas, nested calls)
  frame.zig             -- Bytecode interpreter (stack, memory, PC, opcodes)
  host.zig              -- Host interface (vtable for external state access)
  evm_config.zig        -- Comptime configuration (hardfork, overrides)
  root_c.zig            -- C FFI / WASM exported API (full async protocol)
  evm_c.zig             -- Simpler C FFI (legacy, no async)
  async_executor.zig    -- Async yield/resume for external data fetching
  storage.zig           -- Storage management with injector support
  storage_injector.zig  -- Lazy storage injection for async state loading
  access_list_manager.zig -- EIP-2929/2930 warm/cold tracking
  call_params.zig       -- CallParams struct (polymorphic with config)
  call_result.zig       -- CallResult struct (logs, traces, storage changes)
  opcode.zig            -- Opcode definitions and name lookup
  trace.zig             -- EIP-3155 trace generation
  errors.zig            -- Error types
  logger.zig            -- Logging infrastructure
  instructions/         -- Per-category instruction handlers
    handlers_arithmetic.zig
    handlers_bitwise.zig
    handlers_comparison.zig
    handlers_context.zig
    handlers_control_flow.zig
    handlers_keccak.zig
    handlers_log.zig
    handlers_memory.zig
    handlers_stack.zig
    handlers_storage.zig
    handlers_system.zig
    handlers_block.zig
    dispatcher.zig
```

### Core Type: `Evm`

The EVM is a comptime-generic struct parameterized by `EvmConfig`:

```zig
pub fn Evm(comptime config: EvmConfig) type {
    return struct {
        const Self = @This();
        pub const CallParams = call_params.CallParams(config);
        pub const CallResult = call_result.CallResult(config);

        frames: std.ArrayList(FrameType),
        storage: Storage,
        balances: std.AutoHashMap(primitives.Address, u256),
        nonces: std.AutoHashMap(primitives.Address, u64),
        code: std.AutoHashMap(primitives.Address, []const u8),
        access_list_manager: AccessListManager,
        gas_refund: u64,
        hardfork: Hardfork,
        block_context: BlockContext,
        arena: std.heap.ArenaAllocator,  // Transaction-scoped memory
        tracer: ?*trace.Tracer,
        logs: std.ArrayList(Log),
        // ...
    };
}
```

### Key Methods

| Method | Purpose |
|--------|---------|
| `Evm.init()` | Initialize EVM with allocator, host, hardfork, block context |
| `Evm.call(CallParams)` | Synchronous execution entry point |
| `Evm.callOrContinue(input)` | Async execution (yields for external data) |
| `Evm.inner_call()` | Handle nested CALL/STATICCALL/DELEGATECALL |
| `Evm.inner_create()` | Handle CREATE/CREATE2 |
| `Evm.get_storage()` / `set_storage()` | Persistent storage |
| `Evm.get_transient_storage()` / `set_transient_storage()` | EIP-1153 |
| `Evm.accessAddress()` / `accessStorageSlot()` | EIP-2929 warm/cold tracking |
| `Evm.setBytecode()` | Set code to execute |
| `Evm.setAccessList()` | Set EIP-2930 access list |
| `Evm.setBlobVersionedHashes()` | Set EIP-4844 blob hashes |
| `Evm.deinit()` | Free all resources |

### Host Interface

The host interface uses a vtable pattern for pluggable state backends:

```zig
pub const HostInterface = struct {
    ptr: *anyopaque,
    vtable: *const VTable,

    pub const VTable = struct {
        getBalance: *const fn (ptr: *anyopaque, address: Address) u256,
        setBalance: *const fn (ptr: *anyopaque, address: Address, balance: u256) void,
        getCode: *const fn (ptr: *anyopaque, address: Address) []const u8,
        setCode: *const fn (ptr: *anyopaque, address: Address, code: []const u8) void,
        getStorage: *const fn (ptr: *anyopaque, address: Address, slot: u256) u256,
        setStorage: *const fn (ptr: *anyopaque, address: Address, slot: u256, value: u256) void,
        getNonce: *const fn (ptr: *anyopaque, address: Address) u64,
        setNonce: *const fn (ptr: *anyopaque, address: Address, nonce: u64) void,
    };
};
```

Note: This host interface is for external state backends only. Nested calls (CALL, DELEGATECALL, etc.) are handled internally by `Evm.inner_call()`.

### Allocation Strategy

The EVM uses an **arena allocator** for transaction-scoped memory. All allocations during a transaction (frame stacks, storage maps, etc.) are freed at once when the transaction completes. This is efficient for the EVM's allocation pattern where all temporary data shares a single transaction lifetime.

---

## C FFI and WASM API Surface

Guillotine-mini exposes a comprehensive C API in `src/root_c.zig` for WASM consumption. All functions use the `export` keyword and communicate through raw byte pointers.

### Lifecycle Functions

```c
// Create/destroy EVM instance
EvmHandle* evm_create(const char* hardfork_name, size_t hardfork_len, uint8_t log_level);
void evm_destroy(EvmHandle* handle);
```

### Configuration Functions

```c
// Set bytecode to execute
bool evm_set_bytecode(EvmHandle* handle, const uint8_t* bytecode, size_t len);

// Set execution context (gas, caller, address, value, calldata)
bool evm_set_execution_context(EvmHandle* handle, int64_t gas,
    const uint8_t* caller, const uint8_t* address,
    const uint8_t* value, const uint8_t* calldata, size_t calldata_len);

// Set blockchain context (chain_id, block_number, timestamp, etc.)
void evm_set_blockchain_context(EvmHandle* handle,
    const uint8_t* chain_id, uint64_t block_number, uint64_t timestamp,
    const uint8_t* difficulty, const uint8_t* prevrandao,
    const uint8_t* coinbase, uint64_t gas_limit,
    const uint8_t* base_fee, const uint8_t* blob_base_fee);

// EIP-2930 access lists
bool evm_set_access_list_addresses(EvmHandle* handle, const uint8_t* addresses, size_t count);
bool evm_set_access_list_storage_keys(EvmHandle* handle,
    const uint8_t* addresses, const uint8_t* slots, size_t count);

// EIP-4844 blob hashes
bool evm_set_blob_hashes(EvmHandle* handle, const uint8_t* hashes, size_t count);
```

### Synchronous Execution

```c
bool evm_execute(EvmHandle* handle);             // Execute, return success
int64_t evm_get_gas_remaining(EvmHandle* handle); // Gas left after execution
int64_t evm_get_gas_used(EvmHandle* handle);       // Gas consumed
bool evm_is_success(EvmHandle* handle);            // Check success status
size_t evm_get_output_len(EvmHandle* handle);      // Output data length
size_t evm_get_output(EvmHandle* handle, uint8_t* buffer, size_t len); // Copy output
```

### State Management

```c
bool evm_set_storage(EvmHandle* h, const uint8_t* addr, const uint8_t* slot, const uint8_t* value);
bool evm_get_storage(EvmHandle* h, const uint8_t* addr, const uint8_t* slot, uint8_t* value_out);
bool evm_set_balance(EvmHandle* h, const uint8_t* addr, const uint8_t* balance);
bool evm_set_code(EvmHandle* h, const uint8_t* addr, const uint8_t* code, size_t len);
bool evm_set_nonce(EvmHandle* h, const uint8_t* addr, uint64_t nonce);
```

### Result Introspection

```c
size_t evm_get_log_count(EvmHandle* handle);
bool evm_get_log(EvmHandle* h, size_t index, uint8_t* address_out,
    size_t* topics_count, uint8_t* topics_out,
    size_t* data_len, uint8_t* data_out, size_t data_max_len);
uint64_t evm_get_gas_refund(EvmHandle* handle);
size_t evm_get_storage_change_count(EvmHandle* handle);
bool evm_get_storage_change(EvmHandle* h, size_t index,
    uint8_t* address_out, uint8_t* slot_out, uint8_t* value_out);
```

### JavaScript Callback Imports (WASM only)

When compiled to WASM, the module declares two extern callbacks that JavaScript can provide:

```zig
extern "env" fn js_opcode_callback(opcode: u8, frame_ptr: usize) c_int;
extern "env" fn js_precompile_callback(
    address_ptr: [*]const u8, input_ptr: [*]const u8, input_len: usize,
    gas_limit: u64, output_len: *usize, output_ptr: *[*]u8, gas_used: *u64
) c_int;
```

This enables JavaScript to intercept opcode execution and provide custom precompile implementations.

---

## Async Execution Protocol

Guillotine-mini implements an async execution protocol that allows the EVM to yield when it needs external data (storage, balances, code, nonces) and resume when that data is provided. This is critical for integrating with TypeScript where state may need to be fetched from a remote source.

### AsyncExecutor Types

```zig
pub const CallOrContinueInput = union(enum) {
    call: CallParams,                    // Start new execution
    continue_with_storage: struct {      // Provide storage value
        address: Address, slot: u256, value: u256,
    },
    continue_with_balance: struct {      // Provide balance
        address: Address, balance: u256,
    },
    continue_with_code: struct {         // Provide code
        address: Address, code: []const u8,
    },
    continue_with_nonce: struct {        // Provide nonce
        address: Address, nonce: u64,
    },
    continue_after_commit: void,         // Resume after state commit
};

pub const CallOrContinueOutput = union(enum) {
    result: CallResult,                  // Execution complete
    need_storage: struct {               // Need storage value
        address: Address, slot: u256,
    },
    need_balance: struct {               // Need balance
        address: Address,
    },
    need_code: struct {                  // Need code
        address: Address,
    },
    need_nonce: struct {                 // Need nonce
        address: Address,
    },
    ready_to_commit: struct {            // State changes ready to commit
        changes_json: []const u8,
    },
};
```

### FFI Functions for Async Protocol

```c
// Start async execution
bool evm_call_ffi(EvmHandle* handle, AsyncRequest* request_out);

// Continue with provided data
bool evm_continue_ffi(EvmHandle* handle,
    uint8_t continue_type,     // 1=storage, 2=balance, 3=code, 4=nonce, 5=after_commit
    const uint8_t* data_ptr,
    size_t data_len,
    AsyncRequest* request_out);

// Enable async storage injection
bool evm_enable_storage_injector(EvmHandle* handle);

// Get state changes JSON
size_t evm_get_state_changes(EvmHandle* handle, uint8_t* buffer, size_t buffer_len);
```

### AsyncRequest Structure

```zig
pub const AsyncRequest = extern struct {
    output_type: u8,       // 0=result, 1=need_storage, 2=need_balance, 5=ready_to_commit
    address: [20]u8,
    slot: [32]u8,          // Only for storage requests
    json_len: u32,
    json_data: [16384]u8,  // State changes JSON (inline)
};
```

### Usage Pattern (Pseudo-TypeScript)

```typescript
// Start execution
const request = evm_call_ffi(handle);

while (request.output_type !== 0) {  // 0 = result
  if (request.output_type === 1) {
    // Fetch storage from database
    const value = await db.getStorage(request.address, request.slot);
    evm_continue_ffi(handle, 1, packStorageResponse(request.address, request.slot, value), request);
  } else if (request.output_type === 2) {
    // Fetch balance from database
    const balance = await db.getBalance(request.address);
    evm_continue_ffi(handle, 2, packBalanceResponse(request.address, balance), request);
  } else if (request.output_type === 5) {
    // Commit state changes
    await db.commitChanges(request.json_data);
    evm_continue_ffi(handle, 5, empty, request);
  }
}

// request.output_type === 0: execution complete
```

---

## TypeScript WASM Integration (Guillotine SDK)

The full Guillotine project (`/Users/williamcory/chop/guillotine/sdks/typescript/`) provides a plain TypeScript SDK wrapping the WASM-compiled EVM. This is NOT Effect-based; it uses standard async/await.

### GuillotineEvm Class

```typescript
// Located: /Users/williamcory/chop/guillotine/sdks/typescript/src/evm/evm.ts

class GuillotineEvm {
  private wasm: GuillotineWasm;
  private memory: WasmMemory;
  private evmHandle: number;

  static async create(blockInfo?: BlockInfo, useTracing?: boolean): Promise<GuillotineEvm>;
  async call(params: ExecutionParams): Promise<ExecutionResult>;
  async setBalance(address: Address, balance: U256): Promise<void>;
  async setCode(address: Address, code: Bytes): Promise<void>;
  async setStorage(address: Address, key: U256, value: U256): Promise<void>;
  async getBalance(address: Address): Promise<U256>;
  async getCode(address: Address): Promise<Bytes>;
  async getStorage(address: Address, key: U256): Promise<U256>;
  async simulate(params: ExecutionParams): Promise<ExecutionResult>;
  close(): void;
}
```

### WASM Loader

```typescript
// Located: /Users/williamcory/chop/guillotine/sdks/typescript/src/wasm/loader.ts

interface GuillotineWasm {
  memory: WebAssembly.Memory;
  guillotine_init(): void;
  guillotine_cleanup(): void;
  guillotine_evm_create(block_info_ptr: number): number;
  guillotine_evm_destroy(handle: number): void;
  guillotine_set_balance(handle: number, address_ptr: number, balance_ptr: number): boolean;
  guillotine_set_code(handle: number, address_ptr: number, code_ptr: number, code_len: number): boolean;
  guillotine_set_storage(handle: number, address_ptr: number, key_ptr: number, value_ptr: number): boolean;
  guillotine_call(handle: number, params_ptr: number): number;
  guillotine_free_result(result: number): void;
  guillotine_get_last_error(): number;
  // ...tracing variants, get operations, etc.
}
```

The WASM module is loaded once as a singleton. Multiple `GuillotineEvm` instances share the same WASM module but maintain independent state through opaque handles.

---

## Client-TS: Effect TypeScript Execution Client

The `client-ts` directory (`/Users/williamcory/guillotine-mini/client-ts/`) is a comprehensive Ethereum execution client layer built entirely in TypeScript using the [Effect](https://effect.website/) library. It does NOT wrap WASM directly -- instead it provides the higher-level execution client infrastructure that would orchestrate a WASM EVM underneath.

### Dependencies

```json
{
  "dependencies": {
    "@tevm/voltaire": "file:../../voltaire",
    "effect": "^3.12.0",
    "voltaire-effect": "^0.2.27"
  },
  "devDependencies": {
    "@effect/vitest": "^0.18.1",
    "prettier": "^3.6.2",
    "typescript": "^5.9.3",
    "vitest": "^2.1.8"
  }
}
```

- **effect** -- The Effect library for typed, composable, error-tracked functional effects
- **voltaire-effect** -- Ethereum primitives (Address, Hash, Transaction, Block, etc.) wrapped in Effect-compatible schemas
- **@tevm/voltaire** -- Local Voltaire library providing additional Zig-backed primitives
- **@effect/vitest** -- First-class Effect integration for Vitest test runner
- **typescript** -- TypeScript 5.9+ with strict mode, ES2022 target

### Module Architecture

```
client-ts/
  db/                    -- Key-value database abstraction
    Db.ts               -- DbService (get, put, remove, batch, snapshot, metrics)
  trie/                  -- Merkle Patricia Trie
    Node.ts             -- TrieNode types (leaf, extension, branch)
    encoding.ts         -- Nibble encoding/decoding
    hash.ts             -- Trie hashing (keccak256-based)
    patricialize.ts     -- Trie construction from key-value maps
  state/                 -- World state management
    Account.ts          -- AccountState (nonce, balance, codeHash, storageRoot)
    Journal.ts          -- Change journal with snapshot/restore/commit
    State.ts            -- WorldState (accounts + storage + snapshots)
  evm/                   -- EVM integration layer
    ReleaseSpec.ts      -- Hardfork feature flags (EIP-2028, 2930, 3860, 7623, 7702)
    IntrinsicGasCalculator.ts  -- Transaction intrinsic gas computation
    TransactionProcessor.ts    -- Fee calculation (effective gas price, max fee checks)
    HostAdapter.ts      -- Bridge between WorldState and EVM host interface
  blockchain/            -- Block storage and chain management
    BlockStore.ts       -- Block storage (by hash, by number, canonical chain)
    BlockHeaderValidator.ts  -- Header validation (base fee, gas, timestamp, etc.)
    Blockchain.ts       -- Chain manager (genesis, fork choice, events)
  txpool/                -- Transaction pool
    TxPool.ts           -- Pending transaction tracking
```

### Effect Service Pattern

Every module follows the same Effect service pattern:

1. **Define a service interface** (e.g., `WorldStateService`)
2. **Create a Context.Tag** (e.g., `WorldState extends Context.Tag(...)`)
3. **Implement a `make*` Effect.gen** that constructs the service
4. **Export Layer constructors** (e.g., `WorldStateLive`, `WorldStateTest`)
5. **Export convenience functions** that access the service from context

Example:

```typescript
// Service interface
export interface WorldStateService {
  readonly getAccount: (address: Address.AddressType) => Effect.Effect<AccountStateType>;
  readonly setAccount: (address: Address.AddressType, account: AccountStateType | null) => Effect.Effect<void>;
  readonly getStorage: (address: Address.AddressType, slot: StorageSlotType) => Effect.Effect<StorageValueType>;
  readonly setStorage: (address: Address.AddressType, slot: StorageSlotType, value: StorageValueType) => Effect.Effect<void, MissingAccountError>;
  readonly takeSnapshot: () => Effect.Effect<WorldStateSnapshot>;
  readonly restoreSnapshot: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>;
  readonly commitSnapshot: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>;
  readonly clear: () => Effect.Effect<void>;
}

// Context tag
export class WorldState extends Context.Tag("WorldState")<WorldState, WorldStateService>() {}

// Layer constructors
export const WorldStateLive: Layer.Layer<WorldState, never, Journal> = Layer.effect(WorldState, makeWorldState);
export const WorldStateTest: Layer.Layer<WorldState> = WorldStateLive.pipe(Layer.provide(JournalTest()));

// Convenience functions
export const getAccount = (address: Address.AddressType) =>
  Effect.flatMap(WorldState, (state) => state.getAccount(address));
```

### Service Dependency Graph

```
TxPool (standalone)
  |
  v
Blockchain --> BlockStore (in-memory or persistent)
  |
  v
BlockHeaderValidator (standalone, validates headers against parents)
  |
  v
TransactionProcessor (standalone, fee calculations)
  |
  v
IntrinsicGasCalculator --> ReleaseSpec (hardfork feature flags)
  |
  v
HostAdapter --> WorldState --> Journal
  |                              |
  v                              v
[WASM EVM]                    In-memory maps with journaling
```

### Key Services in Detail

#### Db (Database Abstraction)

```typescript
interface DbService {
  readonly name: DbName;  // "storage" | "state" | "code" | "blocks" | "headers" | ...
  readonly get: (key: BytesType, flags?: ReadFlags) => Effect.Effect<Option<BytesType>, DbError>;
  readonly getAll: (ordered?: boolean) => Effect.Effect<ReadonlyArray<DbEntry>, DbError>;
  readonly getAllKeys: (ordered?: boolean) => Effect.Effect<ReadonlyArray<BytesType>, DbError>;
  readonly getAllValues: (ordered?: boolean) => Effect.Effect<ReadonlyArray<BytesType>, DbError>;
  readonly put: (key: BytesType, value: BytesType, flags?: WriteFlags) => Effect.Effect<void, DbError>;
  readonly merge: (key: BytesType, value: BytesType, flags?: WriteFlags) => Effect.Effect<void, DbError>;
  readonly remove: (key: BytesType) => Effect.Effect<void, DbError>;
  readonly has: (key: BytesType) => Effect.Effect<boolean, DbError>;
  readonly createSnapshot: () => Effect.Effect<DbSnapshot, DbError, Scope>;
  readonly writeBatch: (ops: ReadonlyArray<DbWriteOp>) => Effect.Effect<void, DbError>;
  readonly startWriteBatch: () => Effect.Effect<WriteBatch, DbError, Scope>;
  readonly flush: (onlyWal?: boolean) => Effect.Effect<void, DbError>;
  readonly clear: () => Effect.Effect<void, DbError>;
  readonly compact: () => Effect.Effect<void, DbError>;
  readonly gatherMetric: () => Effect.Effect<DbMetric, DbError>;
}
```

Supports 15 named database instances (storage, state, code, blocks, headers, blockNumbers, receipts, blockInfos, badBlocks, bloom, metadata, blobTransactions, discoveryNodes, discoveryV5Nodes, peers). This mirrors Nethermind's database architecture.

**Flag types:**
- `ReadFlags` -- Bitset (HintCacheMiss, HintReadAhead, HintReadAhead2, HintReadAhead3, SkipDuplicateRead)
- `WriteFlags` -- Bitset (LowPriority, DisableWAL, LowPriorityAndNoWAL)
- `DbWriteOp` -- Union type: `put | del | merge`

**Snapshot/batch types:**
- `DbSnapshot` -- Read-only view interface
- `WriteBatch` -- Scoped batch writer (acquired/released via `Scope`)

Currently implemented as in-memory `Map<string, BytesType>` with hex-encoded keys and proper snapshot support. The `merge` operation is explicitly unsupported in the memory backend. The interface is designed to swap in a persistent backend (LevelDB, RocksDB, etc.).

#### Journal (Change Tracking)

```typescript
interface JournalService<K, V> {
  readonly append: (entry: JournalEntry<K, V>) => Effect.Effect<number>;
  readonly takeSnapshot: () => Effect.Effect<JournalSnapshot>;
  readonly restore: (snapshot: JournalSnapshot, onRevert?: (entry) => Effect) => Effect.Effect<void>;
  readonly commit: (snapshot: JournalSnapshot, onCommit?: (entry) => Effect) => Effect.Effect<void>;
  readonly clear: () => Effect.Effect<void>;
  readonly entries: () => Effect.Effect<ReadonlyArray<JournalEntry<K, V>>>;
}
```

Change tags: `JustCache`, `Update`, `Create`, `Delete`, `Touch`

The journal enables snapshot/restore semantics required for EVM nested calls -- when a CALL reverts, all state changes since the snapshot must be undone.

#### WorldState (Ethereum State)

```typescript
interface WorldStateService {
  readonly getAccountOptional: (address) => Effect.Effect<AccountStateType | null>;
  readonly getAccount: (address) => Effect.Effect<AccountStateType>;  // Returns EMPTY_ACCOUNT if absent
  readonly setAccount: (address, account | null) => Effect.Effect<void>;
  readonly destroyAccount: (address) => Effect.Effect<void>;
  readonly markAccountCreated: (address) => Effect.Effect<void>;
  readonly wasAccountCreated: (address) => Effect.Effect<boolean>;
  readonly getStorage: (address, slot) => Effect.Effect<StorageValueType>;
  readonly setStorage: (address, slot, value) => Effect.Effect<void, MissingAccountError>;
  readonly takeSnapshot: () => Effect.Effect<WorldStateSnapshot>;
  readonly restoreSnapshot: (snapshot) => Effect.Effect<void>;
  readonly commitSnapshot: (snapshot) => Effect.Effect<void>;
  readonly clear: () => Effect.Effect<void>;
}
```

WorldState wraps a Journal and two in-memory maps (accounts and storage). Every mutation journals the previous value for potential rollback. Account creation is tracked per-snapshot frame for correct SELFDESTRUCT behavior.

#### HostAdapter (EVM <-> State Bridge)

```typescript
interface HostAdapterService {
  readonly getBalance: (address) => Effect.Effect<AccountStateType["balance"]>;
  readonly setBalance: (address, balance) => Effect.Effect<void>;
  readonly getNonce: (address) => Effect.Effect<AccountStateType["nonce"]>;
  readonly setNonce: (address, nonce) => Effect.Effect<void>;
  readonly getCode: (address) => Effect.Effect<RuntimeCode.RuntimeCodeType>;
  readonly setCode: (address, code) => Effect.Effect<void>;
  readonly getStorage: (address, slot) => Effect.Effect<StorageValueType>;
  readonly setStorage: (address, slot, value) => Effect.Effect<void, MissingAccountError>;
}
```

This bridges the WASM EVM's host callbacks to the TypeScript WorldState. When the EVM needs to read storage during execution, it yields via the async protocol, the TypeScript layer fulfills the request from WorldState, and execution resumes.

#### TransactionProcessor (Fee Calculations)

```typescript
interface TransactionProcessorService {
  readonly calculateEffectiveGasPrice: (tx, baseFeePerGas) => Effect.Effect<EffectiveGasPrice, TransactionFeeError>;
  readonly checkMaxGasFeeAndBalance: (tx, baseFeePerGas, blobGasPrice, senderBalance) => Effect.Effect<MaxGasFeeCheck, MaxGasFeeCheckError>;
}
```

Handles all transaction types:
- **Legacy** (type 0): gasPrice must >= baseFee
- **EIP-2930** (type 1): Same as legacy + access list support
- **EIP-1559** (type 2): maxFeePerGas, maxPriorityFeePerGas calculations
- **EIP-4844** (type 3): Blob gas calculations, maxFeePerBlobGas validation
- **EIP-7702** (type 4): Authorization list support

Error types are comprehensive and tagged:
- `InvalidTransactionError`, `InvalidBaseFeeError`, `PriorityFeeGreaterThanMaxFeeError`
- `InsufficientMaxFeePerGasError`, `GasPriceBelowBaseFeeError`
- `InsufficientSenderBalanceError`, `InsufficientMaxFeePerBlobGasError`
- `NoBlobDataError`, `InvalidBlobVersionedHashError`, `TransactionTypeContractCreationError`

#### IntrinsicGasCalculator

```typescript
interface IntrinsicGasCalculatorService {
  readonly calculateIntrinsicGas: (tx) => Effect.Effect<IntrinsicGas, IntrinsicGasError>;
}
```

Constants:
- `TX_BASE_COST = 21_000n`
- `TX_CREATE_COST = 32_000n`
- `TX_ACCESS_LIST_ADDRESS_COST = 2_400n`
- `TX_ACCESS_LIST_STORAGE_KEY_COST = 1_900n`
- `PER_EMPTY_ACCOUNT_COST = 25_000n` (EIP-7702 authorization list)
- `INIT_CODE_WORD_COST = 2n` (EIP-3860)
- `FLOOR_CALLDATA_COST = 10n` (EIP-7623)

Depends on `ReleaseSpec` for hardfork-aware feature flags.

#### ReleaseSpec (Hardfork Feature Flags)

```typescript
interface ReleaseSpecService {
  readonly hardfork: Hardfork.HardforkType;
  readonly isEip2028Enabled: boolean;  // Istanbul+: reduced calldata cost
  readonly isEip2930Enabled: boolean;  // Berlin+: access lists
  readonly isEip3860Enabled: boolean;  // Shanghai+: initcode size limits
  readonly isEip7623Enabled: boolean;  // Prague+: calldata floor gas
  readonly isEip7702Enabled: boolean;  // Prague+: authorization lists
}
```

#### Blockchain (Chain Manager)

```typescript
interface BlockchainService {
  readonly getBlockByHash: (hash) => Effect.Effect<Option<BlockType>, BlockchainError>;
  readonly getBlockByNumber: (number) => Effect.Effect<Option<BlockType>, BlockchainError>;
  readonly putBlock: (block) => Effect.Effect<void, BlockchainError>;
  readonly insertBlock: (block) => Effect.Effect<void, BlockchainError>;
  readonly suggestBlock: (block) => Effect.Effect<void, BlockchainError>;
  readonly setCanonicalHead: (hash) => Effect.Effect<void, BlockchainError>;
  readonly initializeGenesis: (genesis) => Effect.Effect<void, BlockchainError>;
  readonly getBestKnownNumber: () => Effect.Effect<Option<BlockNumber>, BlockchainError>;
  readonly getBestSuggestedBlock: () => Effect.Effect<Option<BlockType>, BlockchainError>;
  readonly getGenesis: () => Effect.Effect<Option<BlockType>, BlockchainError>;
  readonly getHead: () => Effect.Effect<Option<BlockType>, BlockchainError>;
  readonly getForkChoiceState: () => Effect.Effect<ForkChoiceState, BlockchainError>;
  readonly forkChoiceUpdated: (update) => Effect.Effect<void, BlockchainError>;
  readonly subscribe: () => Effect.Effect<Queue.Dequeue<BlockchainEvent>, never, Scope>;
}
```

**Error types (6):** `GenesisAlreadyInitializedError`, `GenesisNotInitializedError`, `InvalidGenesisBlockError`, `CanonicalChainInvalidError`, `GenesisMismatchError`, plus all `BlockStoreError` variants. Combined into `BlockchainError` union.

**Layer construction:** `BlockchainLive: Layer<Blockchain, never, BlockStore> = Layer.scoped(Blockchain, makeBlockchain)` -- uses `Layer.scoped` because it manages a `PubSub` resource.

Features:
- Block storage by hash and canonical number indexing
- Orphan block tracking and resolution
- Fork choice support (head, safe, finalized pointers)
- PubSub event system (GenesisInitialized, BlockSuggested, BestSuggestedBlock, CanonicalHeadUpdated, ForkChoiceUpdated)
- Canonical chain validation (walks back to genesis, verifies parent links)

#### BlockStore (Block Storage)

```typescript
interface BlockStoreService {
  readonly getBlock: (hash) => Effect.Effect<Option<Block>, BlockStoreError>;
  readonly getBlockByNumber: (number) => Effect.Effect<Option<Block>, BlockStoreError>;
  readonly getCanonicalHash: (number) => Effect.Effect<Option<BlockHash>, BlockStoreError>;
  readonly hasBlock: (hash) => Effect.Effect<boolean, BlockStoreError>;
  readonly isOrphan: (hash) => Effect.Effect<boolean, BlockStoreError>;
  readonly putBlock: (block) => Effect.Effect<void, BlockStoreError>;
  readonly setCanonicalHead: (hash) => Effect.Effect<void, BlockStoreError>;
  readonly getHeadBlockNumber: () => Effect.Effect<Option<BlockNumber>>;
  readonly blockCount: () => Effect.Effect<number>;
  readonly orphanCount: () => Effect.Effect<number>;
  readonly canonicalChainLength: () => Effect.Effect<number>;
}
```

**Error types (5):** `InvalidBlockError`, `InvalidBlockHashError`, `InvalidBlockNumberError`, `BlockNotFoundError`, `CannotSetOrphanAsHeadError`

In-memory implementation with `Map<BlockHashKey, Block>` storage, `Map<BlockNumberKey, BlockHash>` canonical index, and `Set<BlockHashKey>` orphan tracking. Orphans are automatically resolved when their parent is added.

#### BlockHeaderValidator

```typescript
interface BlockHeaderValidatorService {
  readonly validateHeader: (header, parent) => Effect.Effect<void, BlockHeaderValidatorError>;
}
```

**Error types (2):** `InvalidBlockHeaderError` (schema validation), `BlockHeaderValidationError` (consensus validation with field, expected, actual)

Validates block headers against parents:
- Block number continuity (parent.number + 1)
- Timestamp ordering (must be greater than parent)
- Gas limit adjustment bounds (within 1/1024 of parent, minimum 5000)
- Base fee calculation (EIP-1559 formula)
- Excess blob gas calculation (EIP-4844)
- Post-merge constraints (difficulty=0, nonce=0, empty ommers)
- Extra data size limit (32 bytes)
- Parent hash linkage

#### TxPool (Transaction Pool)

```typescript
interface TxPoolService {
  readonly getPendingCount: () => Effect.Effect<number>;
  readonly getPendingBlobCount: () => Effect.Effect<number>;
}
```

**Error types (1):** `InvalidTxPoolConfigError` (configuration validation failure)

Parameterized layer: `TxPoolLive(config: TxPoolConfig): Layer<TxPool, InvalidTxPoolConfigError>`

#### Trie (Merkle Patricia Trie)

A full MPT implementation for computing state roots:
- **Node types**: Leaf, Extension, Branch (16 children + value)
- **Encoding**: Hex-prefix nibble encoding per Ethereum spec
- **Hashing**: keccak256-based, with inline vs hash-reference threshold (32 bytes)
- **Patricialization**: Builds trie from flat key-value map

### Layer Composition Patterns

The client-ts codebase uses five distinct layer patterns:

| Pattern | Example | Description |
|---------|---------|-------------|
| **Simple Effect** | `Layer.effect(Service, make)` | TransactionProcessor, HostAdapter |
| **Dependent** | `Layer<A, never, B>` | HostAdapter depends on WorldState |
| **Scoped** | `Layer.scoped(Service, make)` | Blockchain (manages PubSub resource) |
| **Parameterized** | `fn(config) => Layer` | TxPool, ReleaseSpec |
| **Succeed** | `Layer.succeed(Service, value)` | Journal (pure in-memory) |

**Dependency graph:**
```
Blockchain → BlockStore
HostAdapter → WorldState → Journal
IntrinsicGasCalculator → ReleaseSpec
TransactionProcessor → (standalone)
TxPool → (standalone)
```

**Test layers:** Every `*Live` layer has a corresponding `*Test` layer that provides dependencies inline:
```typescript
WorldStateTest = WorldStateLive.pipe(Layer.provide(JournalTest()))
BlockchainTest = BlockchainLive.pipe(Layer.provide(BlockStoreMemoryTest))
```

### Error Type Summary

The client-ts codebase defines **32 `Data.TaggedError` classes** across all modules:

| Module | Count | Errors |
|--------|-------|--------|
| TransactionProcessor | 13 | InvalidTransactionError, InvalidBaseFeeError, InvalidGasPriceError, PriorityFeeGreaterThanMaxFeeError, InsufficientMaxFeePerGasError, GasPriceBelowBaseFeeError, UnsupportedTransactionTypeError, InvalidBalanceError, InsufficientSenderBalanceError, InsufficientMaxFeePerBlobGasError, NoBlobDataError, InvalidBlobVersionedHashError, TransactionTypeContractCreationError |
| Blockchain | 6 | GenesisAlreadyInitializedError, GenesisNotInitializedError, InvalidGenesisBlockError, CanonicalChainInvalidError, GenesisMismatchError, + BlockStoreError variants |
| BlockStore | 5 | InvalidBlockError, InvalidBlockHashError, InvalidBlockNumberError, BlockNotFoundError, CannotSetOrphanAsHeadError |
| IntrinsicGasCalculator | 3 | InvalidTransactionError, UnsupportedIntrinsicGasFeatureError, InvalidGasError |
| BlockHeaderValidator | 2 | InvalidBlockHeaderError, BlockHeaderValidationError |
| WorldState | 2 | UnknownSnapshotError, MissingAccountError |
| Journal | 1 | InvalidSnapshotError |
| Db | 1 | DbError |
| TxPool | 1 | InvalidTxPoolConfigError |

### Testing Patterns

Tests use `@effect/vitest` with a consistent helper pattern:

```typescript
// Helper wraps Effect.provide for concise test bodies
const provideWorldState = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(WorldStateTest));

it.effect("test name", () =>
  provideWorldState(
    Effect.gen(function* () {
      const state = yield* WorldState;
      // ... test assertions
    }),
  ),
);
```

Benchmark files (`.bench.ts`) exist alongside tests for performance-critical modules (state, blockchain, db, trie).

---

## Hardfork Support

### Guillotine-Mini Hardforks

Supported hardforks (from CLAUDE.md and source): Frontier, Homestead, Tangerine Whistle, Spurious Dragon, Byzantium, Constantinople, Istanbul, Berlin, London, Merge, Shanghai, Cancun, Prague, Osaka.

### EIP Implementation Status

| EIP | Feature | Hardfork | Status |
|-----|---------|----------|--------|
| EIP-2929 | State access gas costs | Berlin | OK |
| EIP-2930 | Access lists | Berlin | OK |
| EIP-1559 | Fee market (BASEFEE) | London | OK |
| EIP-3198 | BASEFEE opcode | London | OK |
| EIP-3529 | Reduced gas refunds | London | OK |
| EIP-3541 | Reject 0xEF code | London | OK |
| EIP-3651 | Warm coinbase | Shanghai | OK |
| EIP-3855 | PUSH0 instruction | Shanghai | OK |
| EIP-3860 | Limit init code size | Shanghai | OK |
| EIP-1153 | Transient storage (TLOAD/TSTORE) | Cancun | OK |
| EIP-4844 | Blob transactions (BLOBHASH/BLOBBASEFEE) | Cancun | OK |
| EIP-5656 | MCOPY instruction | Cancun | OK |
| EIP-6780 | SELFDESTRUCT only in same tx | Cancun | OK |
| EIP-7516 | BLOBBASEFEE opcode | Cancun | OK |

Test coverage: 100% of ethereum/tests GeneralStateTests passing.

---

## Gas Accounting

### Gas Constant Reference

| Operation | Constant Name | Value | Hardfork |
|-----------|---------------|-------|----------|
| Warm storage read | WarmStorageReadCost | 100 | Berlin+ |
| Cold SLOAD | ColdSloadCost | 2100 | Berlin+ |
| Cold account access | ColdAccountAccessCost | 2600 | Berlin+ |
| SSTORE set (0->nonzero) | SstoreSetGas | 20000 | All |
| SSTORE update (nonzero->nonzero) | SstoreResetGas | 5000 | All |
| SSTORE clear refund | SstoreClearRefund | 4800 | London+ |
| SSTORE stipend check | SstoreSentryGas | 2300 | All |
| Call value transfer | CallValueCost | 9000 | All |
| Call stipend | CallStipend | 2300 | All |

### Gas Metering Architecture

- **Base costs**: Per-opcode execution (ADD=3, MUL=5, SSTORE=dynamic)
- **Memory expansion**: Quadratic cost (`words^2 / 512 + 3 * words`)
- **Call stipend**: 2300 gas for value transfers
- **Warm/cold access**: EIP-2929 (Berlin+): warm=100, cold=2600
- **Gas refunds**: Capped at 1/2 (pre-London) or 1/5 (London+) of total gas used
- **Intrinsic gas**: 21000 base + calldata costs + access list costs + create costs

In Guillotine (full), gas is batched per basic block -- the dispatch schedule precomputes static gas for each basic block so it can be charged once rather than per-instruction.

---

## Tracing Support

Full EIP-3155 trace support is available:

```bash
zig build test-trace
```

Trace entries include: PC, opcode, gas remaining, stack contents, memory contents, storage changes. Traces can be compared against reference implementations (geth, execution-specs) to identify divergences.

In the full Guillotine, the tracer system runs a MinimalEvm sidecar alongside the optimized Frame, validating every instruction's state matches between the two implementations.

---

## State Management

### In the Zig EVM (guillotine-mini)

State is managed through hash maps on the EVM struct:

```zig
storage: Storage,                                    // Persistent storage
balances: std.AutoHashMap(primitives.Address, u256), // Account balances
nonces: std.AutoHashMap(primitives.Address, u64),    // Account nonces
code: std.AutoHashMap(primitives.Address, []const u8), // Contract code
access_list_manager: AccessListManager,              // Warm/cold tracking
```

The `Storage` module supports async injection via `StorageInjector` -- when a storage slot is accessed that hasn't been loaded, the EVM can yield to request it from the host.

### In client-ts (TypeScript)

State is managed through the WorldState service backed by a Journal:

```
WorldState
  accounts: Map<AccountKey, AccountStateType>   -- In-memory account map
  storage: Map<AccountKey, Map<SlotKey, StorageValueType>>  -- Nested storage maps
  journal: JournalService                        -- Change tracking for rollback
  snapshotStack: WorldStateSnapshot[]            -- Nested call snapshots
  createdAccountFrames: Set<AccountKey>[]        -- Per-frame created accounts
```

Every mutation is journaled so that `restoreSnapshot()` can undo changes when a nested call reverts.

---

## Contract Deployment and Calls

### CALL

```zig
const call_params = CallParams{ .call = .{
    .caller = ctx.caller,
    .to = ctx.address,
    .value = ctx.value,
    .input = ctx.calldata,
    .gas = @intCast(ctx.gas),
} };
const result = ctx.evm.call(call_params);
```

### CREATE / CREATE2

Handled internally by `Evm.inner_create()`. The EVM:
1. Computes the new address (keccak256 for CREATE, keccak256(0xFF ++ sender ++ salt ++ init_code_hash) for CREATE2)
2. Creates a new frame with the init code
3. Executes the init code
4. If successful, the return data becomes the deployed bytecode
5. Validates code doesn't start with 0xEF (EIP-3541, London+)
6. Validates code size (max 24576 bytes, Spurious Dragon+)
7. Charges gas for code storage

### Nested Calls

The call depth limit is 1024. The EVM maintains a frame stack. Each frame has its own stack, memory, PC, and gas counter. Storage changes are scoped through snapshot/restore semantics.

---

## WASM Compilation

### Build

```bash
# Guillotine-mini
zig build wasm
# Output: zig-out/bin/guillotine_mini.wasm (~193 KB optimized)

# Full Guillotine
zig build wasm
# Bundle sizes:
#   MinimalEvm: 56 KB (ReleaseSmall, no precompiles)
#   Guillotine EVM: 119 KB (ReleaseSmall, no precompiles)
#   Full Package: 1.1 MB (ReleaseFast, with precompiles)
```

### WASM Target Details

- Target: `wasm32-freestanding` or `wasm32-wasi`
- Optimization modes: `ReleaseSmall` (~119KB), `ReleaseFast` (~1.1MB with precompiles)
- WASI libc stub provided for linking
- JavaScript callback imports for custom opcodes and precompiles
- Memory: WASM linear memory with page allocator

---

## Key Differences: Mini vs Full Guillotine

| Aspect | Guillotine-Mini | Guillotine (Full) |
|--------|----------------|-------------------|
| **Execution model** | Traditional switch-based interpreter | Dispatch-based with tailcall recursion |
| **Bytecode handling** | Direct interpretation | Preprocessed dispatch schedule |
| **Gas batching** | Per-instruction | Per-basic-block |
| **Opcode fusion** | No | Yes (PUSH+MSTORE, PUSH4+EQ+PUSH+JUMPI, etc.) |
| **Validation** | ethereum/tests suite | MinimalEvm differential sidecar + specs |
| **Configuration** | Runtime hardfork selection via C API | Comptime config via `EvmConfig` |
| **async support** | Full async protocol (yield/resume) | Not in dispatch model (synchronous) |
| **Performance** | Good (correctness-first) | Extreme (competes with evmone/REVM) |
| **WASM size** | ~193 KB | 56 KB - 1.1 MB (configurable) |
| **Client-TS** | Yes (Effect-based execution client) | TypeScript SDK (plain async/await) |
| **Precompiles** | Via primitives dependency | Configurable via comptime, JS callbacks |
| **Test suite** | ethereum/tests GeneralStateTests | Unit + E2E + fuzz + differential + benchmark |

---

## Dependency Graph

```
                 +------------------+
                 |   primitives     |  (github.com/evmts/primitives)
                 |  Address, u256,  |
                 |  RLP, ABI, Gas,  |
                 |  Hardfork, Crypto|
                 +--------+---------+
                          |
              +-----------+-----------+
              |                       |
    +---------v---------+   +---------v---------+
    | guillotine-mini   |   |    guillotine     |
    | (core EVM engine) |   | (optimized EVM)   |
    | Switch interpreter|   | Dispatch-based    |
    +--------+----------+   +--------+----------+
             |                       |
    +--------v----------+   +--------v----------+
    |    root_c.zig     |   |   evm_c.zig       |
    | (C FFI + WASM)    |   | (C FFI + WASM)    |
    +--------+----------+   +--------+----------+
             |                       |
    +--------v----------+   +--------v----------+
    |    client-ts      |   |  sdks/typescript  |
    | (Effect-based     |   | (Plain TS SDK     |
    |  execution client)|   |  wrapping WASM)   |
    +-------------------+   +-------------------+
             |
    +--------v------------------+
    |  voltaire-effect          |
    |  (Effect primitives:      |
    |   Address, Hash, Block,   |
    |   Transaction, etc.)      |
    +---------------------------+
```

---

## Sources

- [guillotine-mini GitHub](https://github.com/evmts/guillotine-mini)
- [guillotine GitHub](https://github.com/evmts/guillotine)
- [evmts organization](https://github.com/evmts)
- [guillotine-rs crate](https://crates.io/crates/guillotine-rs)
- [Tevm documentation](https://tevm.mintlify.app/evm)
- Local source: `/Users/williamcory/guillotine-mini/` (EVM engine + client-ts)
- Local source: `/Users/williamcory/chop/guillotine/` (full optimized EVM + SDKs)
