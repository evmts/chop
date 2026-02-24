import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { Account } from "../../state/account.js"
import { WorldStateService } from "../../state/world-state.js"
import { ForkWorldStateTest } from "./fork-state.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const addr1 = "0x0000000000000000000000000000000000000001"
const slot1 = "0x0000000000000000000000000000000000000000000000000000000000000001"

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
	nonce: overrides.nonce ?? 1n,
	balance: overrides.balance ?? 1000n,
	codeHash: overrides.codeHash ?? new Uint8Array(32),
	code: overrides.code ?? new Uint8Array(0),
})

// ---------------------------------------------------------------------------
// clearState
// ---------------------------------------------------------------------------

describe("ForkWorldState — clearState", () => {
	it.effect("clearState removes all local accounts and storage", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set some accounts and storage
			yield* ws.setAccount(addr1, makeAccount({ balance: 500n }))
			yield* ws.setStorage(addr1, slot1, 42n)
			expect((yield* ws.getAccount(addr1)).balance).toBe(500n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(42n)

			// Clear state
			yield* ws.clearState()

			// After clear, should fall through to remote (which returns 0)
			const after = yield* ws.getAccount(addr1)
			expect(after.balance).toBe(0n)
			expect(after.nonce).toBe(0n)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)

	it.effect("clearState followed by set works correctly", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.clearState()

			// Set again after clear
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(999n)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)

	it.effect("clearState also clears deleted state", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set then delete
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.deleteAccount(addr1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Clear state (should reset deleted set too)
			yield* ws.clearState()

			// After clear, account should fall through to remote (0)
			const after = yield* ws.getAccount(addr1)
			expect(after.balance).toBe(0n)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)
})

// ---------------------------------------------------------------------------
// dumpState / loadState
// ---------------------------------------------------------------------------

describe("ForkWorldState — dumpState / loadState", () => {
	it.effect("dumpState captures current state", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			yield* ws.setAccount(addr1, makeAccount({ balance: 777n, nonce: 3n }))
			yield* ws.setStorage(addr1, slot1, 42n)

			const dump = yield* ws.dumpState()
			expect(dump).toBeDefined()
			expect(typeof dump).toBe("object")
			// WorldStateDump is Record<string, SerializedAccount> (flat map)
			expect(dump[addr1]).toBeDefined()
			expect(dump[addr1]?.balance).toBe("0x309")
			expect(dump[addr1]?.nonce).toBe("0x3")
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)

	it.effect("loadState restores dumped state", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set up some state
			yield* ws.setAccount(addr1, makeAccount({ balance: 777n, nonce: 3n }))
			yield* ws.setStorage(addr1, slot1, 42n)

			// Dump
			const dump = yield* ws.dumpState()

			// Clear
			yield* ws.clearState()
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Load
			yield* ws.loadState(dump)

			// Should be restored
			const restored = yield* ws.getAccount(addr1)
			expect(restored.balance).toBe(777n)
			expect(restored.nonce).toBe(3n)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)

	it.effect("dumpState with storage captures storage slots", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const slot2 = "0x0000000000000000000000000000000000000000000000000000000000000002"

			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 42n)
			yield* ws.setStorage(addr1, slot2, 99n)

			const dump = yield* ws.dumpState()
			expect(dump[addr1]?.storage).toBeDefined()
			expect(Object.keys(dump[addr1]?.storage!).length).toBe(2)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)
})

// ---------------------------------------------------------------------------
// ForkWorldStateTest — fallback path when no mock response matches
// ---------------------------------------------------------------------------

describe("ForkWorldStateTest — request fallback to 0x0", () => {
	it.effect("getStorage falls back to 0x0 when no mock response provided", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Ensure account exists
			yield* ws.setAccount(addr1, makeAccount())

			// getStorage calls request() — no eth_getStorageAt mock provided
			const value = yield* ws.getStorage(addr1, slot1)
			expect(value).toBe(0n) // falls back to "0x0"
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)
})
