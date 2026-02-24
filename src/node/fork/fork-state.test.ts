import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import type { Account } from "../../state/account.js"
import { JournalLive } from "../../state/journal.js"
import { WorldStateService } from "../../state/world-state.js"
import { ForkWorldStateLive, ForkWorldStateTest } from "./fork-state.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

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

// Build a mock transport that responds to specific accounts
const mockTransportFor = (accounts: Record<string, { balance: bigint; nonce: bigint; code?: string }>) => {
	const transport: HttpTransportApi = {
		request: (method, params) => {
			const addr = (params as string[])[0]?.toLowerCase() ?? ""
			const acct = accounts[addr]

			if (method === "eth_getStorageAt") {
				// Return 0x0 for storage by default
				return Effect.succeed("0x0") as Effect.Effect<unknown, never>
			}
			if (method === "eth_getBalance") {
				return Effect.succeed(acct ? `0x${acct.balance.toString(16)}` : "0x0") as Effect.Effect<unknown, never>
			}
			if (method === "eth_getTransactionCount") {
				return Effect.succeed(acct ? `0x${acct.nonce.toString(16)}` : "0x0") as Effect.Effect<unknown, never>
			}
			if (method === "eth_getCode") {
				return Effect.succeed(acct?.code ?? "0x") as Effect.Effect<unknown, never>
			}
			return Effect.succeed("0x0") as Effect.Effect<unknown, never>
		},
		batchRequest: (calls) => {
			const results = calls.map((c) => {
				const addr = (c.params as string[])[0]?.toLowerCase()
				const acct = addr ? accounts[addr] : undefined

				if (c.method === "eth_getBalance") {
					return acct ? `0x${acct.balance.toString(16)}` : "0x0"
				}
				if (c.method === "eth_getTransactionCount") {
					return acct ? `0x${acct.nonce.toString(16)}` : "0x0"
				}
				if (c.method === "eth_getCode") {
					return acct?.code ?? "0x"
				}
				return "0x0"
			})
			return Effect.succeed(results) as Effect.Effect<readonly unknown[], never>
		},
	}
	return transport
}

const TestLayer = (accounts: Record<string, { balance: bigint; nonce: bigint; code?: string }> = {}) => {
	const transport = mockTransportFor(accounts)
	return ForkWorldStateLive({ blockNumber: 100n }).pipe(
		Layer.provide(JournalLive()),
		Layer.provide(Layer.succeed(HttpTransportService, transport)),
	)
}

// ---------------------------------------------------------------------------
// Lazy loading from remote
// ---------------------------------------------------------------------------

describe("ForkWorldState — lazy loading", () => {
	it.effect("getAccount fetches from remote on first access", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const account = yield* ws.getAccount(addr1)
			expect(account.balance).toBe(100n)
			expect(account.nonce).toBe(5n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 5n },
				}),
			),
		),
	)

	it.effect("getAccount returns EMPTY_ACCOUNT-like for unknown address", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const account = yield* ws.getAccount(addr1)
			// Unknown addresses return 0 balance/nonce from remote
			expect(account.balance).toBe(0n)
			expect(account.nonce).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("getAccount caches after first fetch (no re-fetch)", () => {
		let fetchCount = 0
		const transport: HttpTransportApi = {
			request: () => Effect.succeed("0x0") as Effect.Effect<unknown, never>,
			batchRequest: () => {
				fetchCount++
				return Effect.succeed(["0x64", "0x1", "0x"]) as Effect.Effect<readonly unknown[], never>
			},
		}

		return Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.getAccount(addr1)
			yield* ws.getAccount(addr1)
			yield* ws.getAccount(addr1)
			expect(fetchCount).toBe(1) // Only fetched once
		}).pipe(
			Effect.provide(
				ForkWorldStateLive({ blockNumber: 100n }).pipe(
					Layer.provide(JournalLive()),
					Layer.provide(Layer.succeed(HttpTransportService, transport)),
				),
			),
		)
	})
})

// ---------------------------------------------------------------------------
// Local modifications overlay
// ---------------------------------------------------------------------------

describe("ForkWorldState — local overlay", () => {
	it.effect("setAccount overrides remote data", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Remote has 100n balance
			const remoteBefore = yield* ws.getAccount(addr1)
			expect(remoteBefore.balance).toBe(100n)

			// Set locally to 999n
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			const afterSet = yield* ws.getAccount(addr1)
			expect(afterSet.balance).toBe(999n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 0n },
				}),
			),
		),
	)

	it.effect("setStorage stores locally", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Ensure account exists
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 42n)
			const value = yield* ws.getStorage(addr1, slot1)
			expect(value).toBe(42n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("local storage overrides remote storage", () => {
		const transport: HttpTransportApi = {
			request: (method) => {
				if (method === "eth_getStorageAt") {
					return Effect.succeed("0x64") as Effect.Effect<unknown, never> // 100 in hex
				}
				return Effect.succeed("0x0") as Effect.Effect<unknown, never>
			},
			batchRequest: () => Effect.succeed(["0x0", "0x0", "0x"]) as Effect.Effect<readonly unknown[], never>,
		}

		return Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Remote storage returns 100
			const remoteBefore = yield* ws.getStorage(addr1, slot1)
			expect(remoteBefore).toBe(100n)

			// Set locally
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 999n)
			const afterSet = yield* ws.getStorage(addr1, slot1)
			expect(afterSet).toBe(999n)
		}).pipe(
			Effect.provide(
				ForkWorldStateLive({ blockNumber: 100n }).pipe(
					Layer.provide(JournalLive()),
					Layer.provide(Layer.succeed(HttpTransportService, transport)),
				),
			),
		)
	})

	it.effect("deleteAccount makes it return empty", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Remote has data
			const remoteBefore = yield* ws.getAccount(addr1)
			expect(remoteBefore.balance).toBe(100n)

			// Delete locally
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.deleteAccount(addr1)
			const afterDelete = yield* ws.getAccount(addr1)
			expect(afterDelete.balance).toBe(0n)
			expect(afterDelete.nonce).toBe(0n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 1n },
				}),
			),
		),
	)
})

// ---------------------------------------------------------------------------
// Snapshot / Restore
// ---------------------------------------------------------------------------

describe("ForkWorldState — snapshot/restore", () => {
	it.effect("snapshot → set → restore → original remote value", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Remote has 100n
			const before = yield* ws.getAccount(addr1)
			expect(before.balance).toBe(100n)

			// Snapshot
			const snap = yield* ws.snapshot()

			// Set locally
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(999n)

			// Restore
			yield* ws.restore(snap)

			// Should go back to remote cached value (not re-fetch)
			const after = yield* ws.getAccount(addr1)
			// After restore, local overlay is removed, so it falls back to cached remote
			expect(after.balance).toBe(100n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 0n },
				}),
			),
		),
	)

	it.effect("snapshot → setStorage → restore → original remote storage", () => {
		const transport: HttpTransportApi = {
			request: (method) => {
				if (method === "eth_getStorageAt") {
					return Effect.succeed("0x64") as Effect.Effect<unknown, never>
				}
				return Effect.succeed("0x0") as Effect.Effect<unknown, never>
			},
			batchRequest: () => Effect.succeed(["0x0", "0x0", "0x"]) as Effect.Effect<readonly unknown[], never>,
		}

		return Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Remote storage is 100
			const before = yield* ws.getStorage(addr1, slot1)
			expect(before).toBe(100n)

			const snap = yield* ws.snapshot()

			// Set locally
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 999n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(999n)

			// Restore
			yield* ws.restore(snap)

			// Back to remote cached value
			const after = yield* ws.getStorage(addr1, slot1)
			expect(after).toBe(100n)
		}).pipe(
			Effect.provide(
				ForkWorldStateLive({ blockNumber: 100n }).pipe(
					Layer.provide(JournalLive()),
					Layer.provide(Layer.succeed(HttpTransportService, transport)),
				),
			),
		)
	})
})

// ---------------------------------------------------------------------------
// ForkWorldStateTest helper
// ---------------------------------------------------------------------------

describe("ForkWorldStateTest", () => {
	it.effect("works with simple mock responses", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const account = yield* ws.getAccount(addr1)
			// Default mock returns "0x0" for everything
			expect(account.balance).toBe(0n)
		}).pipe(Effect.provide(ForkWorldStateTest({ blockNumber: 100n }))),
	)

	it.effect("uses method-specific mock responses for request()", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// The account fetch uses batchRequest, so test storage which uses request()
			yield* ws.setAccount(addr1, makeAccount())
			const value = yield* ws.getStorage(addr1, slot1)
			// Our mock returns 0x100 for eth_getStorageAt
			expect(value).toBe(256n)
		}).pipe(
			Effect.provide(
				ForkWorldStateTest(
					{ blockNumber: 100n },
					{
						eth_getStorageAt: "0x100",
						eth_getBalance: "0x64",
						eth_getTransactionCount: "0x1",
						eth_getCode: "0x",
					},
				),
			),
		),
	)

	it.effect("uses key-specific mock responses with params", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const account = yield* ws.getAccount(addr1)
			// batchRequest resolves method-level mocks for balance/nonce/code
			expect(account.balance).toBe(500n)
			expect(account.nonce).toBe(3n)
		}).pipe(
			Effect.provide(
				ForkWorldStateTest(
					{ blockNumber: 100n },
					{
						eth_getBalance: "0x1f4", // 500
						eth_getTransactionCount: "0x3",
						eth_getCode: "0x",
					},
				),
			),
		),
	)
})

// ---------------------------------------------------------------------------
// Snapshot / Restore with delete + re-set
// ---------------------------------------------------------------------------

describe("ForkWorldState — snapshot/restore with delete and re-set", () => {
	it.effect("set account -> snapshot -> delete -> restore -> account is back", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set account locally
			yield* ws.setAccount(addr1, makeAccount({ balance: 500n, nonce: 3n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(500n)

			// Snapshot
			const snap = yield* ws.snapshot()

			// Delete account
			yield* ws.deleteAccount(addr1)
			const afterDelete = yield* ws.getAccount(addr1)
			expect(afterDelete.balance).toBe(0n)
			expect(afterDelete.nonce).toBe(0n)

			// Restore -> account should be back
			yield* ws.restore(snap)
			const restored = yield* ws.getAccount(addr1)
			expect(restored.balance).toBe(500n)
			expect(restored.nonce).toBe(3n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("delete account -> snapshot -> set account -> restore -> should be deleted again", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set then delete to get into deleted state
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.deleteAccount(addr1)
			const afterDelete = yield* ws.getAccount(addr1)
			expect(afterDelete.balance).toBe(0n)

			// Snapshot while deleted
			const snap = yield* ws.snapshot()

			// Re-set the account
			yield* ws.setAccount(addr1, makeAccount({ balance: 777n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(777n)

			// Restore -> should be deleted again
			yield* ws.restore(snap)
			const restored = yield* ws.getAccount(addr1)
			expect(restored.balance).toBe(0n)
			expect(restored.nonce).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("delete remote-only account -> snapshot -> set -> restore -> cache falls through to remote", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Remote has data for addr1
			const remoteBefore = yield* ws.getAccount(addr1)
			expect(remoteBefore.balance).toBe(200n)

			// Delete it (it exists only in remote/cache)
			yield* ws.deleteAccount(addr1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Snapshot while deleted
			const snap = yield* ws.snapshot()

			// Re-set
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(999n)

			// Restore -> revert clears both localAccounts and localDeleted
			// (because the account entry had previousValue=null, meaning "Create"),
			// so it falls through to the remote cache which has 200n.
			yield* ws.restore(snap)
			const afterRestore = yield* ws.getAccount(addr1)
			expect(afterRestore.balance).toBe(200n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 200n, nonce: 1n },
				}),
			),
		),
	)

	it.effect("snapshot -> set storage -> delete account -> restore -> account back but storage lost", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set account and storage
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 42n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(42n)

			// Snapshot
			const snap = yield* ws.snapshot()

			// Delete account (destructively clears localStorage for this address)
			yield* ws.deleteAccount(addr1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Restore -> account is back (via journal revert) but localStorage
			// was destructively cleared by deleteAccount and not restored by
			// revertAccountEntry, so storage falls through to remote (0n).
			yield* ws.restore(snap)
			expect((yield* ws.getAccount(addr1)).balance).toBe(100n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)
})

// ---------------------------------------------------------------------------
// Storage operations with missing accounts
// ---------------------------------------------------------------------------

describe("ForkWorldState — setStorage on deleted/missing accounts", () => {
	it.effect("setStorage on a locally deleted account fails with MissingAccountError", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set then delete
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.deleteAccount(addr1)

			// setStorage should fail
			const result = yield* ws.setStorage(addr1, slot1, 42n).pipe(
				Effect.matchEffect({
					onFailure: (e) => Effect.succeed(e),
					onSuccess: () => Effect.succeed(null),
				}),
			)
			expect(result).not.toBeNull()
			expect(result?._tag).toBe("MissingAccountError")
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("setStorage on a non-existent locally-deleted account (was only remote)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Fetch from remote first so it's cached
			const remote = yield* ws.getAccount(addr1)
			expect(remote.balance).toBe(0n)

			// Delete (even though it's "empty", delete marks it)
			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.deleteAccount(addr1)

			// setStorage should fail
			const result = yield* ws.setStorage(addr1, slot1, 99n).pipe(
				Effect.matchEffect({
					onFailure: (e) => Effect.succeed(e),
					onSuccess: () => Effect.succeed(null),
				}),
			)
			expect(result).not.toBeNull()
			expect(result?._tag).toBe("MissingAccountError")
		}).pipe(Effect.provide(TestLayer())),
	)
})

// ---------------------------------------------------------------------------
// Multiple snapshot/restore cycles (nested)
// ---------------------------------------------------------------------------

describe("ForkWorldState — nested snapshot/restore cycles", () => {
	it.effect("snapshot -> set -> snapshot -> set -> restore inner -> verify -> restore outer -> verify", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set initial account
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 10n)

			// Outer snapshot
			const outerSnap = yield* ws.snapshot()

			// Change account
			yield* ws.setAccount(addr1, makeAccount({ balance: 200n }))
			yield* ws.setStorage(addr1, slot1, 20n)
			expect((yield* ws.getAccount(addr1)).balance).toBe(200n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(20n)

			// Inner snapshot
			const innerSnap = yield* ws.snapshot()

			// More changes
			yield* ws.setAccount(addr1, makeAccount({ balance: 300n }))
			yield* ws.setStorage(addr1, slot1, 30n)
			expect((yield* ws.getAccount(addr1)).balance).toBe(300n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(30n)

			// Restore inner -> back to 200n state
			yield* ws.restore(innerSnap)
			expect((yield* ws.getAccount(addr1)).balance).toBe(200n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(20n)

			// Restore outer -> back to 100n state
			yield* ws.restore(outerSnap)
			expect((yield* ws.getAccount(addr1)).balance).toBe(100n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(10n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("nested snapshots with delete in the middle", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))

			// Outer snapshot
			const outerSnap = yield* ws.snapshot()

			// Delete
			yield* ws.deleteAccount(addr1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Inner snapshot (while deleted)
			const innerSnap = yield* ws.snapshot()

			// Re-create account
			yield* ws.setAccount(addr1, makeAccount({ balance: 999n }))
			expect((yield* ws.getAccount(addr1)).balance).toBe(999n)

			// Restore inner -> should be deleted again
			yield* ws.restore(innerSnap)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Restore outer -> should be back to 100n
			yield* ws.restore(outerSnap)
			expect((yield* ws.getAccount(addr1)).balance).toBe(100n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("snapshot -> set storage on new slot -> restore -> storage slot gone", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const slot2 = "0x0000000000000000000000000000000000000000000000000000000000000002"

			yield* ws.setAccount(addr1, makeAccount())

			const snap = yield* ws.snapshot()

			// Set a new storage slot
			yield* ws.setStorage(addr1, slot2, 77n)
			expect(yield* ws.getStorage(addr1, slot2)).toBe(77n)

			// Restore -> slot should be gone (back to remote, which is 0)
			yield* ws.restore(snap)
			const value = yield* ws.getStorage(addr1, slot2)
			expect(value).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("snapshot -> update existing storage -> restore -> old value back", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			yield* ws.setAccount(addr1, makeAccount())
			yield* ws.setStorage(addr1, slot1, 50n)

			const snap = yield* ws.snapshot()

			// Update storage
			yield* ws.setStorage(addr1, slot1, 99n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(99n)

			// Restore -> old value
			yield* ws.restore(snap)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(50n)
		}).pipe(Effect.provide(TestLayer())),
	)
})

// ---------------------------------------------------------------------------
// deleteAccount edge cases
// ---------------------------------------------------------------------------

describe("ForkWorldState — deleteAccount edge cases", () => {
	it.effect("delete an account that was never set locally (only exists in remote)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Remote has this account
			const remote = yield* ws.getAccount(addr1)
			expect(remote.balance).toBe(100n)

			// Delete (only in remote/cache, never set locally)
			yield* ws.deleteAccount(addr1)
			const afterDelete = yield* ws.getAccount(addr1)
			expect(afterDelete.balance).toBe(0n)
			expect(afterDelete.nonce).toBe(0n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 5n },
				}),
			),
		),
	)

	it.effect("delete twice in a row is idempotent", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Set, then delete twice
			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.deleteAccount(addr1)
			yield* ws.deleteAccount(addr1) // second delete should be fine

			const after = yield* ws.getAccount(addr1)
			expect(after.balance).toBe(0n)
			expect(after.nonce).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("delete remote account -> snapshot -> restore -> remote data back", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// Remote data
			const remote = yield* ws.getAccount(addr1)
			expect(remote.balance).toBe(100n)

			const snap = yield* ws.snapshot()

			// Delete
			yield* ws.deleteAccount(addr1)
			expect((yield* ws.getAccount(addr1)).balance).toBe(0n)

			// Restore -> remote data should be accessible again
			yield* ws.restore(snap)
			const restored = yield* ws.getAccount(addr1)
			expect(restored.balance).toBe(100n)
		}).pipe(
			Effect.provide(
				TestLayer({
					[addr1]: { balance: 100n, nonce: 5n },
				}),
			),
		),
	)

	it.effect("delete removes local storage too", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			yield* ws.setAccount(addr1, makeAccount({ balance: 100n }))
			yield* ws.setStorage(addr1, slot1, 42n)
			expect(yield* ws.getStorage(addr1, slot1)).toBe(42n)

			yield* ws.deleteAccount(addr1)

			// Storage should return 0 for deleted account
			const storageAfter = yield* ws.getStorage(addr1, slot1)
			expect(storageAfter).toBe(0n)
		}).pipe(Effect.provide(TestLayer())),
	)
})
