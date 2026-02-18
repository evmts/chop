/**
 * Pure in-memory store for call history records.
 *
 * Tracks EVM calls: CALL, CREATE, STATICCALL, DELEGATECALL, CREATE2.
 * Provides filtering via case-insensitive substring matching across all fields.
 *
 * No Effect dependency — plain TypeScript class.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** EVM call type. */
export type CallType = "CALL" | "CREATE" | "STATICCALL" | "DELEGATECALL" | "CREATE2"

/** Log entry attached to a call record. */
export interface CallLog {
	readonly address: string
	readonly topics: readonly string[]
	readonly data: string
}

/** A single EVM call record. */
export interface CallRecord {
	/** Unique sequential identifier. */
	readonly id: number
	/** EVM call type. */
	readonly type: CallType
	/** Sender address (0x-prefixed). */
	readonly from: string
	/** Recipient address (0x-prefixed). */
	readonly to: string
	/** Value transferred in wei. */
	readonly value: bigint
	/** Actual gas consumed. */
	readonly gasUsed: bigint
	/** Gas limit set for the call. */
	readonly gasLimit: bigint
	/** Whether the call succeeded. */
	readonly success: boolean
	/** Calldata (0x-prefixed hex). */
	readonly calldata: string
	/** Return data (0x-prefixed hex). */
	readonly returnData: string
	/** Block number where the call occurred. */
	readonly blockNumber: bigint
	/** Unix timestamp of the block. */
	readonly timestamp: bigint
	/** Transaction hash (0x-prefixed). */
	readonly txHash: string
	/** Log entries emitted during execution. */
	readonly logs: readonly CallLog[]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * In-memory store for call history records.
 *
 * Designed for the TUI call history view — stores records and supports
 * filtering via case-insensitive substring matching.
 */
export class CallHistoryStore {
	private readonly records: CallRecord[] = []

	/** Get all stored records (insertion order). */
	getAll(): readonly CallRecord[] {
		return this.records
	}

	/** Get the number of stored records. */
	count(): number {
		return this.records.length
	}

	/** Add a single record. */
	add(record: CallRecord): void {
		this.records.push(record)
	}

	/** Add multiple records at once. */
	addAll(records: readonly CallRecord[]): void {
		for (const r of records) {
			this.records.push(r)
		}
	}

	/** Get a record by its ID, or undefined if not found. */
	getById(id: number): CallRecord | undefined {
		return this.records.find((r) => r.id === id)
	}

	/** Remove all records. */
	clear(): void {
		this.records.length = 0
	}

	/**
	 * Filter records by case-insensitive substring match across all fields.
	 *
	 * Matches against: type, from, to, txHash, and status text ("success"/"fail").
	 * Empty query returns all records.
	 */
	filter(query: string): readonly CallRecord[] {
		if (query === "") return this.records

		const q = query.toLowerCase()
		return this.records.filter((r) => {
			const searchable = [
				r.type,
				r.from,
				r.to,
				r.txHash,
				r.success ? "success" : "fail",
				r.calldata,
				r.blockNumber.toString(),
			]
			return searchable.some((field) => field.toLowerCase().includes(q))
		})
	}
}
