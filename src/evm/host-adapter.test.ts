import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import { type Account, EMPTY_ACCOUNT, accountEquals } from "../state/account.js"
import { WorldStateService, WorldStateTest } from "../state/world-state.js"
import { bytesToBigint, bytesToHex, hexToBytes } from "./conversions.js"
import { HostAdapterLive, HostAdapterService, HostAdapterTest } from "./host-adapter.js"
import { EvmWasmService, EvmWasmTest } from "./wasm.js"

// ---------------------------------------------------------------------------
// Shared layers
// ---------------------------------------------------------------------------

/** Layer that exposes BOTH HostAdapterService AND WorldStateService. */
const HostAdapterWithWorldState = HostAdapterLive.pipe(Layer.provideMerge(WorldStateTest))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const addr1Bytes = hexToBytes("0x0000000000000000000000000000000000000001")
const addr2Bytes = hexToBytes("0x0000000000000000000000000000000000000002")
const slot1Bytes = hexToBytes("0x0000000000000000000000000000000000000000000000000000000000000001")
const slot2Bytes = hexToBytes("0x0000000000000000000000000000000000000000000000000000000000000002")

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
	nonce: overrides.nonce ?? 1n,
	balance: overrides.balance ?? 1000n,
	codeHash: overrides.codeHash ?? new Uint8Array(32),
	code: overrides.code ?? new Uint8Array(0),
})

// ---------------------------------------------------------------------------
// Unit tests — HostCallbacks
// ---------------------------------------------------------------------------

describe("HostAdapterService — hostCallbacks", () => {
	it.effect("onStorageRead reads from WorldState", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const ws = yield* WorldStateService

			// Set up account + storage via WorldState directly
			yield* ws.setAccount("0x0000000000000000000000000000000000000001", makeAccount())
			yield* ws.setStorage(
				"0x0000000000000000000000000000000000000001",
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				42n,
			)

			// Invoke callback with byte address/slot
			const result = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot1Bytes)

			// Should return 42n as 32-byte big-endian
			expect(bytesToBigint(result)).toBe(42n)
			expect(result.length).toBe(32)
		}).pipe(Effect.provide(HostAdapterWithWorldState)),
	)

	it.effect("onStorageRead returns zero for non-existent slot", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			const result = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot1Bytes)

			// Non-existent storage → 0n as 32 zero bytes
			expect(bytesToBigint(result)).toBe(0n)
			expect(result.every((b) => b === 0)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("onBalanceRead reads account balance", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const ws = yield* WorldStateService

			yield* ws.setAccount("0x0000000000000000000000000000000000000001", makeAccount({ balance: 5000n }))

			const result = yield* adapter.hostCallbacks.onBalanceRead?.(addr1Bytes)

			expect(bytesToBigint(result)).toBe(5000n)
			expect(result.length).toBe(32)
		}).pipe(Effect.provide(HostAdapterWithWorldState)),
	)

	it.effect("onBalanceRead returns zero for non-existent account", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			const result = yield* adapter.hostCallbacks.onBalanceRead?.(addr1Bytes)

			expect(bytesToBigint(result)).toBe(0n)
			expect(result.every((b) => b === 0)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})

// ---------------------------------------------------------------------------
// Unit tests — Byte-addressed state access
// ---------------------------------------------------------------------------

describe("HostAdapterService — byte-addressed state access", () => {
	it.effect("getAccount returns EMPTY_ACCOUNT for non-existent address", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const account = yield* adapter.getAccount(addr1Bytes)
			expect(accountEquals(account, EMPTY_ACCOUNT)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("setAccount + getAccount roundtrip", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const account = makeAccount({ nonce: 3n, balance: 999n })

			yield* adapter.setAccount(addr1Bytes, account)
			const retrieved = yield* adapter.getAccount(addr1Bytes)

			expect(accountEquals(retrieved, account)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("setStorage + getStorage roundtrip", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			// Must create account first
			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 0xdeadbeefn)

			const value = yield* adapter.getStorage(addr1Bytes, slot1Bytes)
			expect(value).toBe(0xdeadbeefn)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("setStorage fails for non-existent account", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			const result = yield* adapter.setStorage(addr1Bytes, slot1Bytes, 42n).pipe(Effect.flip)

			expect(result._tag).toBe("MissingAccountError")
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("deleteAccount removes account", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.deleteAccount(addr1Bytes)
			const retrieved = yield* adapter.getAccount(addr1Bytes)

			expect(accountEquals(retrieved, EMPTY_ACCOUNT)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("multiple accounts at different addresses", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const account1 = makeAccount({ nonce: 1n, balance: 100n })
			const account2 = makeAccount({ nonce: 2n, balance: 200n })

			yield* adapter.setAccount(addr1Bytes, account1)
			yield* adapter.setAccount(addr2Bytes, account2)

			const retrieved1 = yield* adapter.getAccount(addr1Bytes)
			const retrieved2 = yield* adapter.getAccount(addr2Bytes)

			expect(accountEquals(retrieved1, account1)).toBe(true)
			expect(accountEquals(retrieved2, account2)).toBe(true)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("storage at different slots for same address", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 111n)
			yield* adapter.setStorage(addr1Bytes, slot2Bytes, 222n)

			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(111n)
			expect(yield* adapter.getStorage(addr1Bytes, slot2Bytes)).toBe(222n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("getStorage returns 0n for non-existent slot", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const value = yield* adapter.getStorage(addr1Bytes, slot1Bytes)
			expect(value).toBe(0n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})

// ---------------------------------------------------------------------------
// Integration tests — simulated deployment flow
// ---------------------------------------------------------------------------

describe("HostAdapterService — deploy contract flow", () => {
	it.effect("deploy contract — storage is set and readable via callbacks", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			// Simulate contract deployment: create account with code
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52]) // PUSH1 0x42, PUSH1 0x00, MSTORE
			const contractAccount = makeAccount({
				nonce: 0n,
				balance: 0n,
				code: contractCode,
			})
			yield* adapter.setAccount(addr1Bytes, contractAccount)

			// Set initial storage (like constructor would)
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 0x42n)
			yield* adapter.setStorage(addr1Bytes, slot2Bytes, 0xffn)

			// Verify via getStorage (app-level)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(0x42n)
			expect(yield* adapter.getStorage(addr1Bytes, slot2Bytes)).toBe(0xffn)

			// Verify via hostCallbacks (WASM-level)
			const storageResult1 = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot1Bytes)
			expect(bytesToBigint(storageResult1)).toBe(0x42n)

			const storageResult2 = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot2Bytes)
			expect(bytesToBigint(storageResult2)).toBe(0xffn)

			// Verify balance callback
			const balanceResult = yield* adapter.hostCallbacks.onBalanceRead?.(addr1Bytes)
			expect(bytesToBigint(balanceResult)).toBe(0n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})

// ---------------------------------------------------------------------------
// Integration tests — EVM + HostAdapter (end-to-end SLOAD/BALANCE)
// ---------------------------------------------------------------------------

describe("HostAdapterService — EVM integration", () => {
	// Layer that provides EvmWasmService, HostAdapterService, AND WorldStateService
	const IntegrationLayer = Layer.mergeAll(EvmWasmTest, HostAdapterWithWorldState)

	it.effect("call contract — SLOAD reads storage correctly via callbacks", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const adapter = yield* HostAdapterService
			const ws = yield* WorldStateService

			// Set up contract account with storage value at slot 0x01
			const contractAddr = "0x0000000000000000000000000000000000000001"
			yield* ws.setAccount(contractAddr, makeAccount())
			yield* ws.setStorage(contractAddr, bytesToHex(slot1Bytes), 0x42n)

			// Bytecode: PUSH1 0x01 (slot), SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			// This loads storage[0x01] and returns it as a 32-byte word
			const bytecode = new Uint8Array([
				0x60,
				0x01, // PUSH1 0x01 (slot)
				0x54, // SLOAD
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const result = yield* evm.executeAsync({ bytecode, address: addr1Bytes }, adapter.hostCallbacks)

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)
			expect(bytesToBigint(result.output)).toBe(0x42n)
		}).pipe(Effect.provide(IntegrationLayer)),
	)

	it.effect("call contract — BALANCE reads account balance via callbacks", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const adapter = yield* HostAdapterService
			const ws = yield* WorldStateService

			// Set up account with balance
			yield* ws.setAccount("0x0000000000000000000000000000000000000001", makeAccount({ balance: 12345n }))

			// Bytecode: PUSH1 0x01 (address), BALANCE, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60,
				0x01, // PUSH1 0x01 (address as bigint)
				0x31, // BALANCE
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const result = yield* evm.executeAsync({ bytecode }, adapter.hostCallbacks)

			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(12345n)
		}).pipe(Effect.provide(IntegrationLayer)),
	)
})

// ---------------------------------------------------------------------------
// Integration tests — snapshot/restore semantics
// ---------------------------------------------------------------------------

describe("HostAdapterService — snapshot/restore", () => {
	it.effect("snapshot → modify → restore → original values", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			// Set initial state
			yield* adapter.setAccount(addr1Bytes, makeAccount({ balance: 100n }))
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 42n)

			// Snapshot
			const snap = yield* adapter.snapshot()

			// Modify
			yield* adapter.setAccount(addr1Bytes, makeAccount({ balance: 200n }))
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 99n)

			// Verify modification
			expect((yield* adapter.getAccount(addr1Bytes)).balance).toBe(200n)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(99n)

			// Restore
			yield* adapter.restore(snap)

			// Verify original values
			expect((yield* adapter.getAccount(addr1Bytes)).balance).toBe(100n)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(42n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("snapshot → modify → commit → modified values persist", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			yield* adapter.setAccount(addr1Bytes, makeAccount({ balance: 100n }))
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 42n)

			const snap = yield* adapter.snapshot()

			yield* adapter.setAccount(addr1Bytes, makeAccount({ balance: 200n }))
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 99n)

			// Commit — keep changes
			yield* adapter.commit(snap)

			expect((yield* adapter.getAccount(addr1Bytes)).balance).toBe(200n)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(99n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("nested calls with snapshot/restore via hostCallbacks", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			// Set up initial storage
			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 10n)

			// Snapshot (outer call)
			const snap = yield* adapter.snapshot()

			// Inner call modifies storage
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 20n)

			// Verify via callback (simulating WASM reading during inner call)
			const duringInner = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot1Bytes)
			expect(bytesToBigint(duringInner)).toBe(20n)

			// Restore (inner call reverted)
			yield* adapter.restore(snap)

			// Verify original via callback
			const afterRestore = yield* adapter.hostCallbacks.onStorageRead?.(addr1Bytes, slot1Bytes)
			expect(bytesToBigint(afterRestore)).toBe(10n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("deeply nested snapshots (depth 3)", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			// Level 0: initial state
			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 0n)

			// Level 1 snapshot
			const snap1 = yield* adapter.snapshot()
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 1n)

			// Level 2 snapshot
			const snap2 = yield* adapter.snapshot()
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 2n)

			// Level 3 snapshot
			const snap3 = yield* adapter.snapshot()
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 3n)

			// Verify current value
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(3n)

			// Restore level 3 → back to value 2
			yield* adapter.restore(snap3)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(2n)

			// Restore level 2 → back to value 1
			yield* adapter.restore(snap2)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(1n)

			// Restore level 1 → back to value 0
			yield* adapter.restore(snap1)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(0n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("snapshot/commit at middle level, restore outer still works", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService

			yield* adapter.setAccount(addr1Bytes, makeAccount())
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 0n)

			// Outer snapshot
			const snapOuter = yield* adapter.snapshot()
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 10n)

			// Inner snapshot
			const snapInner = yield* adapter.snapshot()
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 20n)

			// Commit inner — changes persist
			yield* adapter.commit(snapInner)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(20n)

			// Restore outer — reverts everything including committed inner
			yield* adapter.restore(snapOuter)
			expect(yield* adapter.getStorage(addr1Bytes, slot1Bytes)).toBe(0n)
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})

// ---------------------------------------------------------------------------
// Integration tests — address conversion correctness
// ---------------------------------------------------------------------------

describe("HostAdapterService — address conversions", () => {
	it.effect("byte addresses correctly round-trip through WorldState", () =>
		Effect.gen(function* () {
			const adapter = yield* HostAdapterService
			const ws = yield* WorldStateService

			// Set via adapter (byte address)
			const account = makeAccount({ nonce: 7n, balance: 500n })
			yield* adapter.setAccount(addr1Bytes, account)

			// Read via WorldState (string address) — should find it
			const wsAccount = yield* ws.getAccount(bytesToHex(addr1Bytes))
			expect(accountEquals(wsAccount, account)).toBe(true)

			// Set storage via adapter
			yield* adapter.setStorage(addr1Bytes, slot1Bytes, 777n)

			// Read via WorldState
			const wsStorage = yield* ws.getStorage(bytesToHex(addr1Bytes), bytesToHex(slot1Bytes))
			expect(wsStorage).toBe(777n)
		}).pipe(Effect.provide(HostAdapterWithWorldState)),
	)
})
