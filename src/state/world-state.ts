import { Context, Effect, Layer } from "effect"
import { bytesToHex, hexToBytes } from "../evm/conversions.js"
import { type Account, EMPTY_CODE_HASH, EMPTY_ACCOUNT } from "./account.js"
import { type InvalidSnapshotError, MissingAccountError } from "./errors.js"
import { type JournalEntry, JournalLive, JournalService } from "./journal.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Opaque snapshot handle — delegates to JournalSnapshot. */
export type WorldStateSnapshot = number

/** Serialized account for state dump/load. */
export interface SerializedAccount {
	readonly nonce: string // hex
	readonly balance: string // hex
	readonly code: string // hex
	readonly storage: Record<string, string> // slot → value (hex)
}

/** Serialized world state for anvil_dumpState / anvil_loadState. */
export type WorldStateDump = Record<string, SerializedAccount>

/** Shape of the WorldState service API. */
export interface WorldStateApi {
	/** Get account at address. Returns EMPTY_ACCOUNT for non-existent addresses. */
	readonly getAccount: (address: string) => Effect.Effect<Account>
	/** Set account at address. */
	readonly setAccount: (address: string, account: Account) => Effect.Effect<void>
	/** Delete account and its storage. */
	readonly deleteAccount: (address: string) => Effect.Effect<void>
	/** Get storage value at address + slot. Returns 0n for non-existent slots. */
	readonly getStorage: (address: string, slot: string) => Effect.Effect<bigint>
	/** Set storage value. Fails if account doesn't exist. */
	readonly setStorage: (address: string, slot: string, value: bigint) => Effect.Effect<void, MissingAccountError>
	/** Create a snapshot for later restore/commit. */
	readonly snapshot: () => Effect.Effect<WorldStateSnapshot>
	/** Restore state to snapshot, undoing all changes after the snapshot. */
	readonly restore: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
	/** Commit snapshot — keep changes but discard the snapshot marker. */
	readonly commit: (snapshot: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
	/** Dump all account and storage state as serializable JSON. */
	readonly dumpState: () => Effect.Effect<WorldStateDump>
	/** Load serialized state into the world state (merges with existing). */
	readonly loadState: (dump: WorldStateDump) => Effect.Effect<void>
	/** Clear all accounts and storage. */
	readonly clearState: () => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for WorldStateService. */
export class WorldStateService extends Context.Tag("WorldState")<WorldStateService, WorldStateApi>() {}

// ---------------------------------------------------------------------------
// Layer — depends on JournalService
// ---------------------------------------------------------------------------

/** Live layer that requires JournalService in its context. */
export const WorldStateLive: Layer.Layer<WorldStateService, never, JournalService> = Layer.effect(
	WorldStateService,
	Effect.gen(function* () {
		const journal = yield* JournalService

		const accounts = new Map<string, Account>()
		const storage = new Map<string, Map<string, bigint>>()

		const revertEntry = (entry: JournalEntry<string, unknown>): Effect.Effect<void> =>
			Effect.sync(() => {
				if (entry.key.startsWith("account:")) {
					const addr = entry.key.slice(8)
					if (entry.previousValue === null) {
						accounts.delete(addr)
						storage.delete(addr)
					} else {
						accounts.set(addr, entry.previousValue as Account)
					}
				} else if (entry.key.startsWith("storage:")) {
					// key format: "storage:<address>:<slot>"
					const rest = entry.key.slice(8)
					const colonIdx = rest.indexOf(":")
					const addr = rest.slice(0, colonIdx)
					const slot = rest.slice(colonIdx + 1)
					if (entry.previousValue === null) {
						const addrStorage = storage.get(addr)
						addrStorage?.delete(slot)
					} else {
						const addrStorage = storage.get(addr) ?? new Map<string, bigint>()
						addrStorage.set(slot, entry.previousValue as bigint)
						storage.set(addr, addrStorage)
					}
				}
			})

		return {
			getAccount: (address) => Effect.sync(() => accounts.get(address) ?? EMPTY_ACCOUNT),

			setAccount: (address, account) =>
				Effect.gen(function* () {
					const previous = accounts.get(address) ?? null
					yield* journal.append({
						key: `account:${address}`,
						previousValue: previous,
						tag: previous === null ? "Create" : "Update",
					})
					accounts.set(address, account)
				}),

			deleteAccount: (address) =>
				Effect.gen(function* () {
					const previous = accounts.get(address) ?? null
					if (previous !== null) {
						yield* journal.append({
							key: `account:${address}`,
							previousValue: previous,
							tag: "Delete",
						})
						accounts.delete(address)
						storage.delete(address)
					}
				}),

			getStorage: (address, slot) => Effect.sync(() => storage.get(address)?.get(slot) ?? 0n),

			setStorage: (address, slot, value) =>
				Effect.gen(function* () {
					if (!accounts.has(address)) {
						return yield* Effect.fail(new MissingAccountError({ address }))
					}
					const addrStorage = storage.get(address) ?? new Map<string, bigint>()
					const previous = addrStorage.get(slot) ?? null
					yield* journal.append({
						key: `storage:${address}:${slot}`,
						previousValue: previous,
						tag: previous === null ? "Create" : "Update",
					})
					addrStorage.set(slot, value)
					storage.set(address, addrStorage)
				}),

			snapshot: () => journal.snapshot(),

			restore: (snap) => journal.restore(snap, revertEntry),

			commit: (snap) => journal.commit(snap),

			dumpState: () =>
				Effect.sync(() => {
					const dump: WorldStateDump = {}
					for (const [address, account] of accounts) {
						const acctStorage: Record<string, string> = {}
						const addrStorage = storage.get(address)
						if (addrStorage) {
							for (const [slot, value] of addrStorage) {
								acctStorage[slot] = `0x${value.toString(16)}`
							}
						}
						dump[address] = {
							nonce: `0x${account.nonce.toString(16)}`,
							balance: `0x${account.balance.toString(16)}`,
							code: bytesToHex(account.code),
							storage: acctStorage,
						}
					}
					return dump
				}),

			loadState: (dump) =>
				Effect.sync(() => {
					for (const [address, serialized] of Object.entries(dump)) {
						const code = hexToBytes(serialized.code)
						const account: Account = {
							nonce: BigInt(serialized.nonce),
							balance: BigInt(serialized.balance),
							code,
							codeHash: code.length === 0 ? EMPTY_CODE_HASH : EMPTY_CODE_HASH,
						}
						accounts.set(address, account)
						if (serialized.storage && Object.keys(serialized.storage).length > 0) {
							const addrStorage = storage.get(address) ?? new Map<string, bigint>()
							for (const [slot, value] of Object.entries(serialized.storage)) {
								addrStorage.set(slot, BigInt(value))
							}
							storage.set(address, addrStorage)
						}
					}
				}),

			clearState: () =>
				Effect.sync(() => {
					accounts.clear()
					storage.clear()
				}),
		} satisfies WorldStateApi
	}),
)

// ---------------------------------------------------------------------------
// Test layer — self-contained with internal JournalService
// ---------------------------------------------------------------------------

/** Self-contained test layer (includes fresh JournalService). */
export const WorldStateTest: Layer.Layer<WorldStateService> = WorldStateLive.pipe(Layer.provide(JournalLive()))
