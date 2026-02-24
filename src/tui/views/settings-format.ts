/**
 * Pure formatting utilities for settings view display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 * Reuses addCommas from dashboard-format.ts.
 */

import { DRACULA } from "../theme.js"
import { addCommas } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { addCommas, formatWei } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Formatted text + color pair. */
export interface FormattedField {
	readonly text: string
	readonly color: string
}

// ---------------------------------------------------------------------------
// Mining mode formatting
// ---------------------------------------------------------------------------

/**
 * Format a mining mode to a label + color.
 *
 * auto → green, manual → yellow, interval → cyan.
 */
export const formatMiningMode = (mode: string): FormattedField => {
	switch (mode) {
		case "auto":
			return { text: "Auto", color: DRACULA.green }
		case "manual":
			return { text: "Manual", color: DRACULA.yellow }
		case "interval":
			return { text: "Interval", color: DRACULA.cyan }
		default:
			return { text: mode, color: DRACULA.foreground }
	}
}

// ---------------------------------------------------------------------------
// Chain ID formatting
// ---------------------------------------------------------------------------

/** Format a chain ID as "31337 (0x7a69)". */
export const formatChainId = (id: bigint): string => `${id.toString()} (0x${id.toString(16)})`

// ---------------------------------------------------------------------------
// Gas limit formatting
// ---------------------------------------------------------------------------

/** Format a gas limit with commas. */
export const formatGasLimitValue = (limit: bigint): string => addCommas(limit)

// ---------------------------------------------------------------------------
// Block time formatting
// ---------------------------------------------------------------------------

/** Format a mining interval in ms to a human-readable string. */
export const formatBlockTime = (intervalMs: number): string => {
	if (intervalMs === 0) return "Auto (mine on tx)"
	if (intervalMs >= 1000 && intervalMs % 1000 === 0) return `${intervalMs / 1000}s`
	if (intervalMs >= 1000) return `${Math.floor(intervalMs / 1000)}s`
	return `${intervalMs}ms`
}

// ---------------------------------------------------------------------------
// Fork URL formatting
// ---------------------------------------------------------------------------

/** Format a fork URL or show N/A for local mode. */
export const formatForkUrl = (url: string | undefined): string => {
	if (url === undefined) return "N/A (local mode)"
	return url
}

// ---------------------------------------------------------------------------
// Hardfork formatting
// ---------------------------------------------------------------------------

/** Capitalize the first letter of a hardfork name. */
export const formatHardfork = (name: string): string => {
	if (name.length === 0) return ""
	return name.charAt(0).toUpperCase() + name.slice(1)
}
