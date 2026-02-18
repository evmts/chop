/**
 * Pure formatting utilities for call history display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 * Reuses truncateAddress/truncateHash/formatWei/formatGas from dashboard-format.ts.
 */

import { DRACULA, SEMANTIC } from "../theme.js"
import type { CallType } from "../services/call-history-store.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { truncateAddress, truncateHash, formatWei, formatGas, formatTimestamp } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Call type formatting
// ---------------------------------------------------------------------------

/** Formatted text + color pair. */
export interface FormattedField {
	readonly text: string
	readonly color: string
}

/**
 * Format a call type to a short label + color.
 *
 * CALL → cyan, CREATE/CREATE2 → green, STATICCALL → purple, DELEGATECALL → orange.
 */
export const formatCallType = (type: CallType): FormattedField => {
	switch (type) {
		case "CALL":
			return { text: "CALL", color: SEMANTIC.primary }
		case "CREATE":
			return { text: "CREATE", color: SEMANTIC.success }
		case "STATICCALL":
			return { text: "STATIC", color: DRACULA.purple }
		case "DELEGATECALL":
			return { text: "DELCALL", color: DRACULA.orange }
		case "CREATE2":
			return { text: "CREATE2", color: DRACULA.green }
	}
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

/**
 * Format a success/failure boolean to a symbol + color.
 *
 * true → ✓ (green), false → ✗ (red).
 */
export const formatStatus = (success: boolean): FormattedField =>
	success ? { text: "\u2713", color: SEMANTIC.success } : { text: "\u2717", color: SEMANTIC.error }

// ---------------------------------------------------------------------------
// Gas breakdown
// ---------------------------------------------------------------------------

/** Add commas as thousands separators (locale-independent). */
const addCommas = (n: bigint): string => {
	const s = n.toString()
	const chars: string[] = []
	for (let i = 0; i < s.length; i++) {
		if (i > 0 && (s.length - i) % 3 === 0) chars.push(",")
		chars.push(s[i]!)
	}
	return chars.join("")
}

/**
 * Format gas used vs gas limit with commas and percentage.
 *
 * Example: "21,000 / 30,000,000 (0.07%)"
 */
export const formatGasBreakdown = (used: bigint, limit: bigint): string => {
	if (limit === 0n) return `${addCommas(used)} / ${addCommas(limit)}`
	const pct = Number((used * 10000n) / limit) / 100
	return `${addCommas(used)} / ${addCommas(limit)} (${pct.toFixed(2)}%)`
}

// ---------------------------------------------------------------------------
// Data truncation
// ---------------------------------------------------------------------------

/**
 * Truncate hex data to a readable length.
 *
 * Preserves prefix + first/last bytes with "..." in the middle.
 * Returns short data unchanged.
 *
 * @param data - 0x-prefixed hex string
 * @param maxLen - Maximum output length (default 22)
 */
export const truncateData = (data: string, maxLen = 22): string => {
	if (data.length <= maxLen) return data
	// Keep "0x" + first 8 chars + "..." + last 4 chars
	const prefixLen = Math.max(6, Math.floor((maxLen - 3) / 2))
	const suffixLen = Math.max(4, maxLen - prefixLen - 3)
	return `${data.slice(0, prefixLen)}...${data.slice(-suffixLen)}`
}
