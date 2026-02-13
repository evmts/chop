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
})
