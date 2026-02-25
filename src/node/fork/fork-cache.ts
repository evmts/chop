/**
 * Fork cache — Map-based cache to avoid re-fetching remote data.
 *
 * Plain data structure, no Effect service. Tracks accounts, storage, and code.
 * Used by ForkWorldStateLive to avoid redundant RPC calls.
 */

import type { Account } from "../../state/account.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fork cache instance. */
export interface ForkCache {
	/** Check if an account has been fetched from remote. */
	readonly hasAccount: (address: string) => boolean
	/** Get a cached account (undefined if not fetched yet). */
	readonly getAccount: (address: string) => Account | undefined
	/** Store a remotely-fetched account in the cache. */
	readonly setAccount: (address: string, account: Account) => void
	/** Check if a storage slot has been fetched from remote. */
	readonly hasStorage: (address: string, slot: string) => boolean
	/** Get a cached storage value (undefined if not fetched yet). */
	readonly getStorage: (address: string, slot: string) => bigint | undefined
	/** Store a remotely-fetched storage value in the cache. */
	readonly setStorage: (address: string, slot: string, value: bigint) => void
	/** Number of cached accounts. */
	readonly accountCount: () => number
	/** Number of cached storage slots. */
	readonly storageCount: () => number
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a new fork cache. */
export const makeForkCache = (): ForkCache => {
	const accounts = new Map<string, Account>()
	const storage = new Map<string, Map<string, bigint>>()

	return {
		hasAccount: (address) => accounts.has(address),

		getAccount: (address) => accounts.get(address),

		setAccount: (address, account) => {
			accounts.set(address, account)
		},

		hasStorage: (address, slot) => {
			const addrStorage = storage.get(address)
			return addrStorage?.has(slot) ?? false
		},

		getStorage: (address, slot) => storage.get(address)?.get(slot),

		setStorage: (address, slot, value) => {
			const addrStorage = storage.get(address) ?? new Map<string, bigint>()
			addrStorage.set(slot, value)
			storage.set(address, addrStorage)
		},

		accountCount: () => accounts.size,

		storageCount: () => {
			let count = 0
			for (const addrStorage of storage.values()) {
				count += addrStorage.size
			}
			return count
		},
	}
}
