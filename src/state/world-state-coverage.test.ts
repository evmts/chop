import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { EMPTY_ACCOUNT } from "./account.js"
import { WorldStateService, WorldStateTest } from "./world-state.js"

// ---------------------------------------------------------------------------
// setAccount overwrite semantics
// ---------------------------------------------------------------------------

describe("WorldState — setAccount overwrite", () => {
	it.effect("second setAccount overwrites first", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x1111111111111111111111111111111111111111"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })
			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 200n })

			const account = yield* ws.getAccount(addr)
			expect(account.balance).toBe(200n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("overwrite is reverted by snapshot/restore", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x1111111111111111111111111111111111111111"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })
			const snap = yield* ws.snapshot()
			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 200n })

			yield* ws.restore(snap)
			const account = yield* ws.getAccount(addr)
			expect(account.balance).toBe(100n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// deleteAccount revert via snapshot
// ---------------------------------------------------------------------------

describe("WorldState — deleteAccount revert", () => {
	it.effect("snapshot then delete then restore brings account back", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x2222222222222222222222222222222222222222"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 500n })
			yield* ws.setStorage(addr, "0x01", 42n)

			const snap = yield* ws.snapshot()
			yield* ws.deleteAccount(addr)

			// Verify deleted
			const deleted = yield* ws.getAccount(addr)
			expect(deleted.balance).toBe(0n)
			expect(yield* ws.getStorage(addr, "0x01")).toBe(0n)

			// Restore
			yield* ws.restore(snap)
			const restored = yield* ws.getAccount(addr)
			expect(restored.balance).toBe(500n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// delete + re-create + revert
// ---------------------------------------------------------------------------

describe("WorldState — delete then re-create then revert", () => {
	it.effect("restoring undoes both deletion and re-creation", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x3333333333333333333333333333333333333333"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })
			const snap = yield* ws.snapshot()

			// Delete and re-create with different balance
			yield* ws.deleteAccount(addr)
			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 999n })

			// Restore to before delete
			yield* ws.restore(snap)
			const account = yield* ws.getAccount(addr)
			expect(account.balance).toBe(100n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Storage revert when previousValue was non-null (line 73 branch)
// ---------------------------------------------------------------------------

describe("WorldState — storage revert with existing value", () => {
	it.effect("restoring storage restores previous non-null value", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x4444444444444444444444444444444444444444"
			const slot = "0x0a"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })
			yield* ws.setStorage(addr, slot, 10n)

			const snap = yield* ws.snapshot()
			yield* ws.setStorage(addr, slot, 99n)

			yield* ws.restore(snap)
			const value = yield* ws.getStorage(addr, slot)
			expect(value).toBe(10n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("storage revert creates storage map if it was cleared", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x5555555555555555555555555555555555555555"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })
			yield* ws.setStorage(addr, "0x01", 42n)

			const snap = yield* ws.snapshot()

			// Overwrite storage (creates a journal entry with previousValue = 42n)
			yield* ws.setStorage(addr, "0x01", 99n)
			// Delete the account (clears storage map, journals account only)
			yield* ws.deleteAccount(addr)

			// Restore: reverts account deletion first (restores account but not storage map),
			// then reverts storage write — storage.get(addr) is undefined → line 73
			// creates a new Map and restores previousValue 42n
			yield* ws.restore(snap)
			const value = yield* ws.getStorage(addr, "0x01")
			expect(value).toBe(42n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Commit then restore interaction
// ---------------------------------------------------------------------------

describe("WorldState — commit then restore outer", () => {
	it.effect("committing inner then restoring outer undoes everything", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const addr = "0x6666666666666666666666666666666666666666"

			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 100n })

			const snapOuter = yield* ws.snapshot()
			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 200n })

			const snapInner = yield* ws.snapshot()
			yield* ws.setAccount(addr, { ...EMPTY_ACCOUNT, balance: 300n })

			// Commit inner — changes are kept
			yield* ws.commit(snapInner)
			const afterCommit = yield* ws.getAccount(addr)
			expect(afterCommit.balance).toBe(300n)

			// Restore outer — undoes everything including committed changes
			yield* ws.restore(snapOuter)
			const afterRestore = yield* ws.getAccount(addr)
			expect(afterRestore.balance).toBe(100n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})
