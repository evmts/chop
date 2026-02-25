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
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filter records by case-insensitive substring match across all fields.
 *
 * Matches against: type, from, to, txHash, status text ("success"/"fail"),
 * calldata, and block number.
 * Empty query returns the input unchanged.
 */
export const filterCallRecords = (records: readonly CallRecord[], query: string): readonly CallRecord[] => {
	if (query === "") return records

	const q = query.toLowerCase()
	return records.filter((r) => {
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
