/**
 * Pure formatting utilities for state inspector tree display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 */

import { addCommas, formatWei, truncateAddress } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { truncateAddress }

// ---------------------------------------------------------------------------
// Tree structure formatting
// ---------------------------------------------------------------------------

/** Return the expand/collapse indicator for a tree node. */
export const formatTreeIndicator = (expanded: boolean): string => (expanded ? "▾" : "▸")

/** Return indentation string for a given depth (2 spaces per level). */
export const formatIndent = (depth: number): string => "  ".repeat(depth)

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/** Format code size — returns "(none - EOA)" for 0 or "N bytes" with commas. */
export const formatCodeSize = (codeSize: number): string => {
	if (codeSize === 0) return "(none - EOA)"
	return `${addCommas(BigInt(codeSize))} bytes`
}

/**
 * Format a hex string as either hex or decimal.
 *
 * @param hex - 0x-prefixed hex string
 * @param showDecimal - If true, converts to decimal string. Otherwise returns hex.
 */
export const formatHexOrDecimal = (hex: string, showDecimal: boolean): string => {
	if (!showDecimal) return hex
	return BigInt(hex).toString()
}

/**
 * Format a storage slot line for display.
 *
 * @param slot - 0x-prefixed hex slot key
 * @param value - 0x-prefixed hex value
 * @param showDecimal - If true, shows decimal representation
 */
export const formatStorageSlotLine = (slot: string, value: string, showDecimal: boolean): string => {
	const slotNum = BigInt(slot)
	if (showDecimal) {
		const decValue = BigInt(value).toString()
		return `Slot ${slotNum}:  ${decValue} (decimal)`
	}
	return `Slot ${slotNum}:  ${value}`
}

/** Format a balance line using formatWei. */
export const formatBalanceLine = (balance: bigint): string => `Balance: ${formatWei(balance)}`

/** Format a nonce line. */
export const formatNonceLine = (nonce: bigint): string => `Nonce:   ${nonce.toString()}`

/** Format a code size line. */
export const formatCodeLine = (codeSize: number): string => `Code:    ${formatCodeSize(codeSize)}`
