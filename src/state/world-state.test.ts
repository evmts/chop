import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { type Account, EMPTY_ACCOUNT, accountEquals } from "./account.js"
import { InvalidSnapshotError, MissingAccountError } from "./errors.js"
import { WorldStateService, WorldStateTest } from "./world-state.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const addr1 = "0x0000000000000000000000000000000000000001"
const addr2 = "0x0000000000000000000000000000000000000002"
const slot1 = "0x0000000000000000000000000000000000000000000000000000000000000001"
const slot2 = "0x0000000000000000000000000000000000000000000000000000000000000002"

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
	nonce: overrides.nonce ?? 1n,
	balance: overrides.balance ?? 1000n,
	codeHash: overrides.codeHash ?? new Uint8Array(32),
	code: overrides.code ?? new Uint8Array(0),
})

// ---------------------------------------------------------------------------
// Acceptance test 1: set account → get account → matches
// ---------------------------------------------------------------------------

describe("WorldStateService — account CRUD", () => {
	it.effect("set account → get account → matches", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const account = makeAccount({ nonce: 5n, balance: 42n })
			yield* ws.setAccount(addr1, account)
			const retrieved = yield* ws.getAccount(addr1)
			expect(accountEquals(retrieved, account)).toBe(true)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("getAccount of non-existent address returns EMPTY_ACCOUNT", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const retrieved = yield* ws.getAccount(addr1)
			expect(accountEquals(retrieved, EMPTY_ACCOUNT)).toBe(true)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("deleteAccount removes account", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.deleteAccount(addr1)
			const retrieved = yield* ws.getAccount(addr1)
			expect(accountEquals(retrieved, EMPTY_ACCOUNT)).toBe(true)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("deleteAccount removes account storage too", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 42n)
			yield* ws.deleteAccount(addr1)
			// Storage for deleted account should be gone
			const value = yield* ws.getStorage(addr1, slot1)
			expect(value).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 2: set storage → get storage → matches
// ---------------------------------------------------------------------------

describe("WorldStateService — storage CRUD", () => {
	it.effect("set storage → get storage → matches", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 12345n)
			const value = yield* ws.getStorage(addr1, slot1)
			expect(value).toBe(12345n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("getStorage of non-existent slot returns 0n", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const value = yield* ws.getStorage(addr1, slot1)
			expect(value).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("setStorage on non-existent account fails with MissingAccountError", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const error = yield* ws.setStorage(addr1, slot1, 1n).pipe(
				Effect.flip,
				Effect.catchAll((e) => Effect.succeed(e)),
			)
			expect(error).toBeInstanceOf(MissingAccountError)
			expect((error as MissingAccountError).address).toBe(addr1)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("multiple storage slots for same account", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 100n)
			yield* ws.setStorage(addr1, slot2, 200n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(100n)
			expect(yield* ws.getStorage(addr1, slot2)).toBe(200n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("storage is isolated between accounts", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setAccount(addr2, makeAccount())
			yield* ws.setStorage(addr1, slot1, 111n)
			yield* ws.setStorage(addr2, slot1, 222n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(111n)
			expect(yield* ws.getStorage(addr2, slot1)).toBe(222n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 3: snapshot → modify → restore → original values
// ---------------------------------------------------------------------------

describe("WorldStateService — snapshot + restore", () => {
	it.effect("snapshot → modify → restore → original values", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Setup initial state
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 10n)

			// Snapshot
			const snap = yield* ws.snapshot()

			// Modify
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			yield* ws.setStorage(addr1, slot1, 999n)

			// Restore
			yield* ws.restore(snap)

			// Original values
			const account = yield* ws.getAccount(addr1)
			expect(account.balance).toBe(100n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(10n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("restore undoes account creation", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const snap = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount())

			yield* ws.restore(snap)
			const account = yield* ws.getAccount(addr1)
			expect(accountEquals(account, EMPTY_ACCOUNT)).toBe(true)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("restore undoes storage creation", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount())
			const snap = yield* ws.snapshot()
			yield* ws.setStorage(addr1, slot1, 42n)

			yield* ws.restore(snap)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("restore with invalid snapshot fails", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const result = yield* ws.restore(999).pipe(Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(InvalidSnapshotError)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 4: snapshot → modify → commit → modified values
// ---------------------------------------------------------------------------

describe("WorldStateService — snapshot + commit", () => {
	it.effect("snapshot → modify → commit → modified values persist", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 10n)

			const snap = yield* ws.snapshot()

			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			yield* ws.setStorage(addr1, slot1, 999n)

			yield* ws.commit(snap)

			// Modified values should persist
			const account = yield* ws.getAccount(addr1)
			expect(account.balance).toBe(999n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(999n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 5: nested snapshots (depth 3)
// ---------------------------------------------------------------------------

describe("WorldStateService — nested snapshots (depth 3)", () => {
	it.effect("snapshot 1 → set X → snapshot 2 → set Y → snapshot 3 → set Z → restore in order", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Initial state
			yield* ws.setAccount(addr1, makeAccount({ balance: 0n }))

			// Snapshot 1 → set X
			const snap1 = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 100n)

			// Snapshot 2 → set Y
			const snap2 = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount({ balance: 200n }))
			yield* ws.setStorage(addr1, slot1, 200n)

			// Snapshot 3 → set Z
			const snap3 = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount({ balance: 300n }))
			yield* ws.setStorage(addr1, slot1, 300n)

			// Verify current state is Z
			expect((yield* ws.getAccount(addr1)).balance).toBe(300n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(300n)

			// Restore snapshot 3 → Z reverted, Y still present
			yield* ws.restore(snap3)
			expect((yield* ws.getAccount(addr1)).balance).toBe(200n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(200n)

			// Restore snapshot 2 → Y reverted, X still present
			yield* ws.restore(snap2)
			expect((yield* ws.getAccount(addr1)).balance).toBe(100n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(100n)

			// Restore snapshot 1 → X reverted, back to original
			yield* ws.restore(snap1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("commit inner, then restore outer", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(addr1, makeAccount({ balance: 0n }))

			const snap1 = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))

			const snap2 = yield* ws.snapshot()
			yield* ws.setAccount(addr1, makeAccount({ balance: 200n }))

			// Commit snap2 — modifications kept
			yield* ws.commit(snap2)
			expect((yield* ws.getAccount(addr1)).balance).toBe(200n)

			// Restore snap1 — reverts everything after snap1
			yield* ws.restore(snap1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// WorldStateService — tag
// ---------------------------------------------------------------------------

describe("WorldStateService — tag", () => {
	it("has correct tag key", () => {
		expect(WorldStateService.key).toBe("WorldState")
	})
})
