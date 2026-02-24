/**
 * Pure formatting utilities for transactions view display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 * Reuses truncateAddress/truncateHash/formatWei from dashboard-format.ts.
 */

import { SEMANTIC } from "../theme.js"
import type { FormattedField } from "./call-history-format.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { truncateAddress, truncateHash, formatWei, formatGas, addCommas } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Status formatting (numeric — from receipt status field)
// ---------------------------------------------------------------------------

/**
 * Format a numeric status (from transaction receipt) to symbol + color.
 *
 * 1 → '✓' (green), 0 → '✗' (red).
 */
export const formatStatus = (status: number): FormattedField =>
	status === 1 ? { text: "\u2713", color: SEMANTIC.success } : { text: "\u2717", color: SEMANTIC.error }

// ---------------------------------------------------------------------------
// Transaction type formatting
// ---------------------------------------------------------------------------

/**
 * Format a transaction type number to a human-readable label.
 *
 * 0 → 'Legacy', 1 → 'EIP-2930', 2 → 'EIP-1559', 3 → 'EIP-4844'.
 */
export const formatTxType = (type: number): string => {
	switch (type) {
		case 0:
			return "Legacy"
		case 1:
			return "EIP-2930"
		case 2:
			return "EIP-1559"
		case 3:
			return "EIP-4844"
		default:
			return `Type ${type}`
	}
}

// ---------------------------------------------------------------------------
// To-address formatting
// ---------------------------------------------------------------------------

/**
 * Format a `to` address — undefined/null → 'CREATE', else truncated.
 */
export const formatTo = (to?: string | null): string => {
	if (to === undefined || to === null) return "CREATE"
	if (to.length <= 10) return to
	return `${to.slice(0, 6)}...${to.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Calldata formatting
// ---------------------------------------------------------------------------

/**
 * Format calldata for display.
 *
 * '0x' → '(empty)', otherwise show the 4-byte selector.
 * Short calldata (less than 10 chars / 4 bytes after 0x) shown raw.
 */
export const formatCalldata = (data: string): string => {
	if (data === "0x" || data === "") return "(empty)"
	// Less than 4 bytes (0x + 8 hex chars) — show raw
	if (data.length < 10) return data
	return `0x${data.slice(2, 10)}`
}

// ---------------------------------------------------------------------------
// Gas price formatting
// ---------------------------------------------------------------------------

/**
 * Format gas price — delegates to formatWei.
 */
export { formatWei as formatGasPrice } from "./dashboard-format.js"
