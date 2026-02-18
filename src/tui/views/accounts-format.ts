/**
 * Pure formatting utilities for accounts view display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 * Reuses formatWei/truncateAddress from dashboard-format.ts.
 */

import { DRACULA, SEMANTIC } from "../theme.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { truncateAddress, formatWei } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Formatted text + color pair. */
export interface FormattedField {
	readonly text: string
	readonly color: string
}

// ---------------------------------------------------------------------------
// Balance formatting
// ---------------------------------------------------------------------------

/**
 * Format a wei balance to human-readable form.
 *
 * Delegates to formatWei from dashboard-format.
 */
export { formatWei as formatBalance } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Nonce formatting
// ---------------------------------------------------------------------------

/** Format a nonce (transaction count) as a string. */
export const formatNonce = (nonce: bigint): string => nonce.toString()

// ---------------------------------------------------------------------------
// Account type formatting
// ---------------------------------------------------------------------------

/**
 * Format account type (EOA or Contract) with color.
 *
 * EOA → cyan, Contract → pink.
 */
export const formatAccountType = (isContract: boolean): FormattedField =>
	isContract
		? { text: "Contract", color: DRACULA.pink }
		: { text: "EOA", color: SEMANTIC.primary }

// ---------------------------------------------------------------------------
// Code indicator
// ---------------------------------------------------------------------------

/** Return "Yes" if code is non-empty, "No" otherwise. */
export const formatCodeIndicator = (code: Uint8Array): string =>
	code.length > 0 ? "Yes" : "No"
