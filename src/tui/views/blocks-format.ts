/**
 * Pure formatting utilities for blocks view display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 * Reuses truncateHash, formatWei, formatTimestamp, formatGas, addCommas from dashboard-format.ts.
 */

import { addCommas } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { truncateHash, formatWei, formatTimestamp, formatGas, addCommas } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Block number formatting
// ---------------------------------------------------------------------------

/** Format a block number as "#42" or "#1,000,000". */
export const formatBlockNumber = (n: bigint): string => `#${addCommas(n)}`

// ---------------------------------------------------------------------------
// Transaction count formatting
// ---------------------------------------------------------------------------

/** Format transaction count from optional hash array. */
export const formatTxCount = (hashes?: readonly string[]): string => {
	if (!hashes) return "0"
	return hashes.length.toString()
}

// ---------------------------------------------------------------------------
// Gas usage formatting (detailed for block detail view)
// ---------------------------------------------------------------------------

/** Format gas usage as "1,200,000 / 30,000,000 (40.0%)". */
export const formatGasUsage = (used: bigint, limit: bigint): string => {
	const pct = limit > 0n ? Number((used * 1000n) / limit) / 10 : 0
	return `${addCommas(used)} / ${addCommas(limit)} (${pct.toFixed(1)}%)`
}

// ---------------------------------------------------------------------------
// Absolute timestamp formatting
// ---------------------------------------------------------------------------

/** Format a Unix timestamp as an absolute UTC date string "YYYY-MM-DD HH:MM:SS UTC". */
export const formatTimestampAbsolute = (ts: bigint): string => {
	const date = new Date(Number(ts) * 1000)
	const yyyy = date.getUTCFullYear()
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
	const dd = String(date.getUTCDate()).padStart(2, "0")
	const hh = String(date.getUTCHours()).padStart(2, "0")
	const min = String(date.getUTCMinutes()).padStart(2, "0")
	const ss = String(date.getUTCSeconds()).padStart(2, "0")
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`
}
