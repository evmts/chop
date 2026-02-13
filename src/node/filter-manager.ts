// Filter manager — manages JSON-RPC filters for eth_newFilter, eth_newBlockFilter,
// eth_newPendingTransactionFilter, eth_getFilterChanges, eth_uninstallFilter.
// Follows the same plain factory pattern as impersonation-manager.ts.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Type of JSON-RPC filter. */
export type FilterType = "log" | "block" | "pendingTransaction"

/** Criteria for log filters (eth_newFilter). */
export interface LogFilterCriteria {
	readonly fromBlock?: bigint
	readonly toBlock?: bigint
	readonly address?: string | readonly string[]
	readonly topics?: readonly (string | readonly string[] | null)[]
}

/** A registered JSON-RPC filter. */
export interface Filter {
	readonly id: string
	readonly type: FilterType
	readonly criteria?: LogFilterCriteria
	/** Block number when this filter was last polled. */
	lastPolledBlock: bigint
}

/** Shape of the FilterManager API. */
export interface FilterManagerApi {
	/** Create a new log filter. Returns the hex filter ID. */
	readonly newFilter: (criteria: LogFilterCriteria, currentBlock: bigint) => string
	/** Create a new block filter. Returns the hex filter ID. */
	readonly newBlockFilter: (currentBlock: bigint) => string
	/** Create a new pending transaction filter. Returns the hex filter ID. */
	readonly newPendingTransactionFilter: (currentBlock: bigint) => string
	/** Get a filter by ID. Returns undefined if not found. */
	readonly getFilter: (id: string) => Filter | undefined
	/** Remove a filter by ID. Returns true if it existed. */
	readonly removeFilter: (id: string) => boolean
	/** Update the last polled block for a filter. */
	readonly updateLastPolled: (id: string, blockNumber: bigint) => void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a FilterManager.
 *
 * Tracks a mutable map of filters with monotonic counter for IDs.
 * Each filter ID is a hex string (e.g. "0x1", "0x2").
 */
export const makeFilterManager = (): FilterManagerApi => {
	const filters = new Map<string, Filter>()
	let nextId = 1

	const allocateId = (): string => {
		const id = `0x${nextId.toString(16)}`
		nextId++
		return id
	}

	return {
		newFilter: (criteria, currentBlock) => {
			const id = allocateId()
			filters.set(id, { id, type: "log", criteria, lastPolledBlock: currentBlock })
			return id
		},

		newBlockFilter: (currentBlock) => {
			const id = allocateId()
			filters.set(id, { id, type: "block", lastPolledBlock: currentBlock })
			return id
		},

		newPendingTransactionFilter: (currentBlock) => {
			const id = allocateId()
			filters.set(id, { id, type: "pendingTransaction", lastPolledBlock: currentBlock })
			return id
		},

		getFilter: (id) => filters.get(id),

		removeFilter: (id) => filters.delete(id),

		updateLastPolled: (id, blockNumber) => {
			const filter = filters.get(id)
			if (filter) {
				filter.lastPolledBlock = blockNumber
			}
		},
	} satisfies FilterManagerApi
}
