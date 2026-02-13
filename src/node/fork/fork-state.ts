/**
 * ForkWorldStateLive — WorldStateService implementation for fork mode.
 *
 * Provides the same WorldStateService tag as the local-mode WorldStateLive,
 * but with a lazy-loading overlay:
 *
 * 1. Local modifications (journal-tracked) take priority.
 * 2. If not in local state, check the fork cache.
 * 3. If not in cache, fetch from the remote RPC and cache.
 *
 * This means handlers, procedures, and the RPC server require ZERO changes.
 */

import { Effect, Layer } from "effect"
import { type Account, EMPTY_ACCOUNT, EMPTY_CODE_HASH } from "../../state/account.js"
import { MissingAccountError } from "../../state/errors.js"
import { type JournalEntry, JournalLive, JournalService } from "../../state/journal.js"
import { type WorldStateApi, WorldStateService } from "../../state/world-state.js"
import { ForkDataError } from "./errors.js"
import { makeForkCache } from "./fork-cache.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a ForkWorldState. */
export interface ForkWorldStateOptions {
	/** Block number to query remote state at. */
	readonly blockNumber: bigint
}

// ---------------------------------------------------------------------------
// Internal — remote fetchers
// ---------------------------------------------------------------------------

const hexBlockNumber = (n: bigint): string => `0x${n.toString(16)}`

const fetchRemoteAccount = (
	transport: HttpTransportApi,
	address: string,
	blockTag: string,
): Effect.Effect<Account, ForkDataError> =>
	Effect.gen(function* () {
		// Batch: balance, nonce, code
		const results = yield* transport
			.batchRequest([
				{ method: "eth_getBalance", params: [address, blockTag] },
				{ method: "eth_getTransactionCount", params: [address, blockTag] },
				{ method: "eth_getCode", params: [address, blockTag] },
			])
			.pipe(
				Effect.catchTag("ForkRpcError", (e) =>
					Effect.fail(new ForkDataError({ message: `Failed to fetch account ${address}: ${e.message}` })),
				),
			)

		const balanceHex = results[0] as string
		const nonceHex = results[1] as string
		const codeHex = results[2] as string

		const balance = yield* Effect.try({
			try: () => BigInt(balanceHex),
			catch: (e) => new ForkDataError({ message: `Invalid balance hex: ${e}` }),
		})

		const nonce = yield* Effect.try({
			try: () => BigInt(nonceHex),
			catch: (e) => new ForkDataError({ message: `Invalid nonce hex: ${e}` }),
		})

		const code = yield* Effect.try({
			try: () => {
				const clean = codeHex.startsWith("0x") ? codeHex.slice(2) : codeHex
				if (clean.length === 0) return new Uint8Array(0)
				const bytes = new Uint8Array(clean.length / 2)
				for (let i = 0; i < bytes.length; i++) {
					bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
				}
				return bytes
			},
			catch: (e) => new ForkDataError({ message: `Invalid code hex: ${e}` }),
		})

		return {
			nonce,
			balance,
			codeHash: code.length > 0 ? new Uint8Array(32) : EMPTY_CODE_HASH,
			code,
		}
	})

const fetchRemoteStorage = (
	transport: HttpTransportApi,
	address: string,
	slot: string,
	blockTag: string,
): Effect.Effect<bigint, ForkDataError> =>
	Effect.gen(function* () {
		// Pad slot to 32 bytes hex
		const paddedSlot = slot.startsWith("0x") ? `0x${slot.slice(2).padStart(64, "0")}` : `0x${slot.padStart(64, "0")}`

		const result = yield* transport
			.request("eth_getStorageAt", [address, paddedSlot, blockTag])
			.pipe(
				Effect.catchTag("ForkRpcError", (e) =>
					Effect.fail(new ForkDataError({ message: `Failed to fetch storage ${address}:${slot}: ${e.message}` })),
				),
			)

		return yield* Effect.try({
			try: () => BigInt(result as string),
			catch: (e) => new ForkDataError({ message: `Invalid storage hex: ${e}` }),
		})
	})

// ---------------------------------------------------------------------------
// Layer — ForkWorldStateLive
// ---------------------------------------------------------------------------

/**
 * Fork-mode WorldStateService layer.
 *
 * Requires HttpTransportService in context for remote fetching.
 * Uses JournalService for local modifications (snapshot/restore).
 */
export const ForkWorldStateLive = (
	options: ForkWorldStateOptions,
): Layer.Layer<WorldStateService, never, HttpTransportService | JournalService> =>
	Layer.effect(
		WorldStateService,
		Effect.gen(function* () {
			const transport = yield* HttpTransportService
			const journal = yield* JournalService
			const cache = makeForkCache()
			const blockTag = hexBlockNumber(options.blockNumber)

			// Local state overlays
			const localAccounts = new Map<string, Account>()
			const localStorage = new Map<string, Map<string, bigint>>()
			// Track which addresses have been locally deleted
			const localDeleted = new Set<string>()

			// --- Lazy account resolution ---
			const resolveAccount = (address: string): Effect.Effect<Account> =>
				Effect.gen(function* () {
					// 1. Check local deletion
					if (localDeleted.has(address)) return EMPTY_ACCOUNT

					// 2. Check local overlay
					const local = localAccounts.get(address)
					if (local !== undefined) return local

					// 3. Check cache
					const cached = cache.getAccount(address)
					if (cached !== undefined) return cached

					// 4. Fetch from remote (die on transport errors — they're defects in this context)
					const remote = yield* fetchRemoteAccount(transport, address, blockTag).pipe(
						Effect.catchTag("ForkDataError", (e) => Effect.die(e)),
					)
					cache.setAccount(address, remote)
					return remote
				})

			// --- Lazy storage resolution ---
			const resolveStorage = (address: string, slot: string): Effect.Effect<bigint> =>
				Effect.gen(function* () {
					// 1. Check local deletion
					if (localDeleted.has(address)) return 0n

					// 2. Check local overlay
					const localAddr = localStorage.get(address)
					if (localAddr?.has(slot)) {
						return localAddr.get(slot) ?? 0n
					}

					// 3. Check cache
					if (cache.hasStorage(address, slot)) {
						return cache.getStorage(address, slot) ?? 0n
					}

					// 4. Fetch from remote
					const remote = yield* fetchRemoteStorage(transport, address, slot, blockTag).pipe(
						Effect.catchTag("ForkDataError", (e) => Effect.die(e)),
					)
					cache.setStorage(address, slot, remote)
					return remote
				})

			// --- Journal revert helpers (extracted to reduce cognitive complexity) ---
			const revertAccountEntry = (addr: string, entry: JournalEntry<string, unknown>): void => {
				if (entry.previousValue === null) {
					localAccounts.delete(addr)
					localStorage.delete(addr)
					localDeleted.delete(addr)
				} else if (entry.tag === "Delete") {
					localDeleted.delete(addr)
					if (entry.previousValue !== undefined) {
						localAccounts.set(addr, entry.previousValue as Account)
					}
				} else {
					localAccounts.set(addr, entry.previousValue as Account)
				}
			}

			const revertStorageEntry = (rest: string, entry: JournalEntry<string, unknown>): void => {
				const colonIdx = rest.indexOf(":")
				const addr = rest.slice(0, colonIdx)
				const slot = rest.slice(colonIdx + 1)
				if (entry.previousValue === null) {
					localStorage.get(addr)?.delete(slot)
				} else {
					const addrStorage = localStorage.get(addr) ?? new Map<string, bigint>()
					addrStorage.set(slot, entry.previousValue as bigint)
					localStorage.set(addr, addrStorage)
				}
			}

			const revertDeletedEntry = (addr: string, entry: JournalEntry<string, unknown>): void => {
				if (entry.previousValue === null) {
					localDeleted.delete(addr)
				} else {
					localDeleted.add(addr)
				}
			}

			const revertEntry = (entry: JournalEntry<string, unknown>): Effect.Effect<void> =>
				Effect.sync(() => {
					if (entry.key.startsWith("account:")) {
						revertAccountEntry(entry.key.slice(8), entry)
					} else if (entry.key.startsWith("storage:")) {
						revertStorageEntry(entry.key.slice(8), entry)
					} else if (entry.key.startsWith("deleted:")) {
						revertDeletedEntry(entry.key.slice(8), entry)
					}
				})

			return {
				getAccount: (address) => resolveAccount(address),

				setAccount: (address, account) =>
					Effect.gen(function* () {
						const previous = localAccounts.get(address) ?? null
						yield* journal.append({
							key: `account:${address}`,
							previousValue: previous,
							tag: previous === null ? "Create" : "Update",
						})
						// If it was deleted, record undeletion
						if (localDeleted.has(address)) {
							yield* journal.append({
								key: `deleted:${address}`,
								previousValue: true,
								tag: "Delete",
							})
							localDeleted.delete(address)
						}
						localAccounts.set(address, account)
					}),

				deleteAccount: (address) =>
					Effect.gen(function* () {
						const previous = localAccounts.get(address) ?? null
						if (previous !== null || cache.hasAccount(address) || !localDeleted.has(address)) {
							yield* journal.append({
								key: `account:${address}`,
								previousValue: previous,
								tag: "Delete",
							})
							// Track deletion in journal
							const wasPreviouslyDeleted = localDeleted.has(address)
							if (!wasPreviouslyDeleted) {
								yield* journal.append({
									key: `deleted:${address}`,
									previousValue: null,
									tag: "Create",
								})
							}
							localAccounts.delete(address)
							localStorage.delete(address)
							localDeleted.add(address)
						}
					}),

				getStorage: (address, slot) => resolveStorage(address, slot),

				setStorage: (address, slot, value) =>
					Effect.gen(function* () {
						// Check the account exists (locally or remotely)
						const account = yield* resolveAccount(address)
						if (
							account.nonce === 0n &&
							account.balance === 0n &&
							account.code.length === 0 &&
							localDeleted.has(address)
						) {
							return yield* Effect.fail(new MissingAccountError({ address }))
						}

						const addrStorage = localStorage.get(address) ?? new Map<string, bigint>()
						const previous = addrStorage.get(slot) ?? null
						yield* journal.append({
							key: `storage:${address}:${slot}`,
							previousValue: previous,
							tag: previous === null ? "Create" : "Update",
						})
						addrStorage.set(slot, value)
						localStorage.set(address, addrStorage)
					}),

				snapshot: () => journal.snapshot(),

				restore: (snap) => journal.restore(snap, revertEntry),

				commit: (snap) => journal.commit(snap),
			} satisfies WorldStateApi
		}),
	)

// ---------------------------------------------------------------------------
// Test layer — self-contained with mock transport
// ---------------------------------------------------------------------------

/**
 * Create a test layer for ForkWorldState with a mock transport.
 * Useful for unit tests that don't need a real RPC endpoint.
 */
export const ForkWorldStateTest = (
	options: ForkWorldStateOptions,
	mockResponses: Record<string, unknown> = {},
): Layer.Layer<WorldStateService> =>
	ForkWorldStateLive(options).pipe(
		Layer.provide(JournalLive()),
		Layer.provide(
			Layer.succeed(HttpTransportService, {
				request: (method, params) => {
					const key = `${method}:${JSON.stringify(params)}`
					const result = mockResponses[key] ?? mockResponses[method]
					if (result === undefined) {
						return Effect.succeed("0x0") as Effect.Effect<unknown, never>
					}
					return Effect.succeed(result) as Effect.Effect<unknown, never>
				},
				batchRequest: (calls) =>
					Effect.succeed(
						calls.map((c) => {
							const key = `${c.method}:${JSON.stringify(c.params)}`
							return mockResponses[key] ?? mockResponses[c.method] ?? "0x0"
						}),
					) as Effect.Effect<readonly unknown[], never>,
			}),
		),
	)
