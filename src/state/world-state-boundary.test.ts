/**
 * Boundary condition tests for state/world-state.ts.
 *
 * Covers:
 * - deleteAccount on non-existent account (no-op)
 * - setStorage overwrite existing value
 * - getStorage on non-existent account (returns 0n)
 * - Snapshot/restore/commit with storage mutations
 * - Multiple snapshots and nested operations
 * - Max uint256 storage values
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { EMPTY_ACCOUNT } from "./account.js"
import { WorldStateService, WorldStateTest } from "./world-state.js"

const ADDR = "0x0000000000000000000000000000000000000042"
const ADDR2 = "0x0000000000000000000000000000000000000043"
const SLOT = "0x0000000000000000000000000000000000000000000000000000000000000001"
const SLOT2 = "0x0000000000000000000000000000000000000000000000000000000000000002"

// ---------------------------------------------------------------------------
// deleteAccount — boundary conditions
// ---------------------------------------------------------------------------

describe("WorldState — deleteAccount boundary", () => {
	it.effect("deleteAccount on non-existent account is a no-op", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Should not throw
			yield* ws.deleteAccount("0x0000000000000000000000000000000000000099")
			// Confirm account doesn't exist
			const acct = yield* ws.getAccount("0x0000000000000000000000000000000000000099")
			expect(acct.nonce).toBe(0n)
			expect(acct.balance).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("deleteAccount then getAccount returns empty", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { nonce: 5n, balance: 100n, codeHash: new Uint8Array(32), code: new Uint8Array(0) })
			yield* ws.deleteAccount(ADDR)
			const acct = yield* ws.getAccount(ADDR)
			expect(acct.nonce).toBe(0n)
			expect(acct.balance).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// setStorage — boundary conditions
// ---------------------------------------------------------------------------

describe("WorldState — setStorage boundary", () => {
	it.effect("setStorage overwrites existing value", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, 42n)
			yield* ws.setStorage(ADDR, SLOT, 99n)
			const val = yield* ws.getStorage(ADDR, SLOT)
			expect(val).toBe(99n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("setStorage with max uint256 value", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const maxU256 = 2n ** 256n - 1n
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, maxU256)
			const val = yield* ws.getStorage(ADDR, SLOT)
			expect(val).toBe(maxU256)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("setStorage with zero value", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, 42n)
			yield* ws.setStorage(ADDR, SLOT, 0n)
			const val = yield* ws.getStorage(ADDR, SLOT)
			expect(val).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("setStorage fails with MissingAccountError for non-existent account", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const result = yield* ws
				.setStorage("0x0000000000000000000000000000000000000099", SLOT, 1n)
				.pipe(Effect.catchTag("MissingAccountError", (e) => Effect.succeed(e._tag)))
			expect(result).toBe("MissingAccountError")
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("setStorage on different slots are independent", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, 1n)
			yield* ws.setStorage(ADDR, SLOT2, 2n)
			expect(yield* ws.getStorage(ADDR, SLOT)).toBe(1n)
			expect(yield* ws.getStorage(ADDR, SLOT2)).toBe(2n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// getStorage — boundary conditions
// ---------------------------------------------------------------------------

describe("WorldState — getStorage boundary", () => {
	it.effect("getStorage on non-existent account returns 0n", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const val = yield* ws.getStorage("0x0000000000000000000000000000000000000099", SLOT)
			expect(val).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("getStorage on unset slot returns 0n", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			const val = yield* ws.getStorage(ADDR, SLOT)
			expect(val).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Snapshot — complex scenarios
// ---------------------------------------------------------------------------

describe("WorldState — snapshot complex scenarios", () => {
	it.effect("snapshot → mutate storage → restore → storage reverted", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, 10n)

			const snap = yield* ws.snapshot()
			yield* ws.setStorage(ADDR, SLOT, 99n)
			expect(yield* ws.getStorage(ADDR, SLOT)).toBe(99n)

			yield* ws.restore(snap)
			expect(yield* ws.getStorage(ADDR, SLOT)).toBe(10n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("snapshot → add account → restore → account gone", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			const snap = yield* ws.snapshot()
			yield* ws.setAccount(ADDR, { nonce: 5n, balance: 100n, codeHash: new Uint8Array(32), code: new Uint8Array(0) })
			expect((yield* ws.getAccount(ADDR)).nonce).toBe(5n)

			yield* ws.restore(snap)
			const acct = yield* ws.getAccount(ADDR)
			expect(acct.nonce).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("snapshot → commit → changes persist", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })

			const snap = yield* ws.snapshot()
			yield* ws.setStorage(ADDR, SLOT, 42n)
			yield* ws.commit(snap)

			expect(yield* ws.getStorage(ADDR, SLOT)).toBe(42n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("invalid snapshot fails on restore", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const snap = yield* ws.snapshot()
			yield* ws.commit(snap)
			// Using committed snapshot for restore should fail
			const result = yield* ws.restore(snap).pipe(
				Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e._tag)),
			)
			expect(result).toBe("InvalidSnapshotError")
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("multiple accounts with storage — snapshot captures all", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR, { ...EMPTY_ACCOUNT })
			yield* ws.setAccount(ADDR2, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR, SLOT, 1n)
			yield* ws.setStorage(ADDR2, SLOT, 2n)

			const snap = yield* ws.snapshot()
			yield* ws.setStorage(ADDR, SLOT, 100n)
			yield* ws.setStorage(ADDR2, SLOT, 200n)

			yield* ws.restore(snap)
			expect(yield* ws.getStorage(ADDR, SLOT)).toBe(1n)
			expect(yield* ws.getStorage(ADDR2, SLOT)).toBe(2n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})
