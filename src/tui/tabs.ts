/**
 * Tab definitions for the TUI's 8-tab navigation bar.
 *
 * Pure data module — no dependencies, fully testable.
 */

/** A single tab in the tab bar. */
export interface Tab {
	/** Zero-based index (0..7). */
	readonly index: number
	/** Keyboard shortcut key ("1".."8"). */
	readonly key: string
	/** Full display name. */
	readonly name: string
	/** Short label for narrow terminals. */
	readonly shortName: string
}

/** All 8 tabs in display order. */
export const TABS: readonly Tab[] = [
	{ index: 0, key: "1", name: "Dashboard", shortName: "Dash" },
	{ index: 1, key: "2", name: "Call History", shortName: "History" },
	{ index: 2, key: "3", name: "Contracts", shortName: "Contracts" },
	{ index: 3, key: "4", name: "Accounts", shortName: "Accounts" },
	{ index: 4, key: "5", name: "Blocks", shortName: "Blocks" },
	{ index: 5, key: "6", name: "Transactions", shortName: "Txs" },
	{ index: 6, key: "7", name: "Settings", shortName: "Settings" },
	{ index: 7, key: "8", name: "State Inspector", shortName: "State" },
] as const

/** Total number of tabs. */
export const TAB_COUNT = TABS.length
