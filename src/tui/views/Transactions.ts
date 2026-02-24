/**
 * Transactions view component — scrollable table of mined transactions
 * with detail pane on Enter and filter via `/`.
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `transactionsReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import { type TransactionDetail, filterTransactions } from "./transactions-data.js"
import {
	addCommas,
	formatGasPrice,
	formatStatus,
	formatTo,
	formatTxType,
	formatWei,
	truncateAddress,
	truncateHash,
} from "./transactions-format.js"

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** View mode for the transactions pane. */
export type TransactionsViewMode = "list" | "detail"

/** Internal state for the transactions view. */
export interface TransactionsViewState {
	/** Index of the currently selected row. */
	readonly selectedIndex: number
	/** Current view mode: list table or detail pane. */
	readonly viewMode: TransactionsViewMode
	/** Active filter query string. */
	readonly filterQuery: string
	/** Whether filter input is active (capturing keystrokes). */
	readonly filterActive: boolean
	/** Current transactions displayed. */
	readonly transactions: readonly TransactionDetail[]
}

/** Default initial state. */
export const initialTransactionsState: TransactionsViewState = {
	selectedIndex: 0,
	viewMode: "list",
	filterQuery: "",
	filterActive: false,
	transactions: [],
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for transactions view state.
 *
 * Handles:
 * - j/k: move selection down/up
 * - return: enter detail view (or confirm filter)
 * - escape: back to list / clear filter
 * - /: activate filter mode
 * - backspace: delete last filter char
 * - other keys in filter mode: append to query
 */
export const transactionsReduce = (state: TransactionsViewState, key: string): TransactionsViewState => {
	// Filter mode — capture all keystrokes for the filter query
	if (state.filterActive) {
		if (key === "escape") {
			return { ...state, filterActive: false, filterQuery: "", selectedIndex: 0 }
		}
		if (key === "return") {
			return { ...state, filterActive: false }
		}
		if (key === "backspace") {
			return {
				...state,
				filterQuery: state.filterQuery.slice(0, -1),
				selectedIndex: 0,
			}
		}
		// Only accept printable single characters
		if (key.length === 1) {
			return {
				...state,
				filterQuery: state.filterQuery + key,
				selectedIndex: 0,
			}
		}
		return state
	}

	// Detail mode
	if (state.viewMode === "detail") {
		if (key === "escape") {
			return { ...state, viewMode: "list" }
		}
		return state
	}

	// List mode
	switch (key) {
		case "j": {
			const maxIndex = Math.max(0, state.transactions.length - 1)
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }
		}
		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }
		case "return":
			if (state.transactions.length === 0) return state
			return { ...state, viewMode: "detail" }
		case "/":
			return { ...state, filterActive: true }
		case "escape":
			return state
		default:
			return state
	}
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createTransactions. */
export interface TransactionsHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the view with new transactions. */
	readonly update: (transactions: readonly TransactionDetail[]) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => TransactionsViewState
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of visible data rows in the table (excluding header). */
const VISIBLE_ROWS = 19

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the Transactions view with scrollable table + detail pane.
 *
 * Layout (list mode):
 * ```
 * ┌─ Transactions ──────────────────────────────────────────────┐
 * │ Hash        Block   From          To            Value  Type │
 * │ 0xabcd...01 #1      0x1111...1111 0x2222...2222 1 ETH  Leg │
 * │ ...                                                         │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 */
export const createTransactions = (renderer: CliRenderer): TransactionsHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: TransactionsViewState = { ...initialTransactionsState }

	// -------------------------------------------------------------------------
	// List mode components
	// -------------------------------------------------------------------------

	const listBox = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		borderStyle: "rounded",
		borderColor: DRACULA.comment,
		backgroundColor: DRACULA.background,
		paddingLeft: 1,
		paddingRight: 1,
	})

	// Title
	const listTitle = new Text(renderer, {
		content: " Transactions ",
		fg: DRACULA.cyan,
	})
	listBox.add(listTitle)

	// Header row
	const headerLine = new Text(renderer, {
		content: "  Hash           Block    From          To            Value        Gas Price    Status Type",
		fg: DRACULA.comment,
		truncate: true,
	})
	listBox.add(headerLine)

	// Data rows
	const rowLines: TextRenderable[] = []
	const rowBgs: BoxRenderable[] = []
	for (let i = 0; i < VISIBLE_ROWS; i++) {
		const rowBox = new Box(renderer, {
			width: "100%",
			flexDirection: "row",
			backgroundColor: DRACULA.background,
		})
		const rowText = new Text(renderer, {
			content: "",
			fg: DRACULA.foreground,
			truncate: true,
		})
		rowBox.add(rowText)
		listBox.add(rowBox)
		rowBgs.push(rowBox)
		rowLines.push(rowText)
	}

	// Filter bar (shown at bottom when filter active)
	const filterLine = new Text(renderer, {
		content: "",
		fg: DRACULA.yellow,
		truncate: true,
	})
	listBox.add(filterLine)

	// Status line at bottom
	const statusLine = new Text(renderer, {
		content: "",
		fg: DRACULA.comment,
		truncate: true,
	})
	listBox.add(statusLine)

	// -------------------------------------------------------------------------
	// Detail mode components
	// -------------------------------------------------------------------------

	const detailBox = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		borderStyle: "rounded",
		borderColor: DRACULA.purple,
		backgroundColor: DRACULA.background,
		paddingLeft: 1,
		paddingRight: 1,
	})

	const detailTitle = new Text(renderer, {
		content: " Transaction Detail ",
		fg: DRACULA.purple,
	})
	detailBox.add(detailTitle)

	// Detail has ~24 lines for showing all info
	const DETAIL_LINES = 24
	const detailLines: TextRenderable[] = []
	for (let i = 0; i < DETAIL_LINES; i++) {
		const line = new Text(renderer, {
			content: "",
			fg: DRACULA.foreground,
		})
		detailLines.push(line)
		detailBox.add(line)
	}

	// -------------------------------------------------------------------------
	// Container — holds either listBox or detailBox
	// -------------------------------------------------------------------------

	const container = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})

	// Start in list mode
	container.add(listBox)
	let currentMode: TransactionsViewMode = "list"

	// -------------------------------------------------------------------------
	// Render functions
	// -------------------------------------------------------------------------

	/** Get the active transactions list (filtered when a query is set). */
	const getFilteredTransactions = (): readonly TransactionDetail[] =>
		viewState.filterQuery ? filterTransactions(viewState.transactions, viewState.filterQuery) : viewState.transactions

	const renderList = (): void => {
		const txs = getFilteredTransactions()
		const scrollOffset = Math.max(0, viewState.selectedIndex - VISIBLE_ROWS + 1)

		for (let i = 0; i < VISIBLE_ROWS; i++) {
			const txIndex = i + scrollOffset
			const tx = txs[txIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!tx) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = txIndex === viewState.selectedIndex
			const status = formatStatus(tx.status)
			const to = formatTo(tx.to)

			const line =
				` ${truncateHash(tx.hash).padEnd(14)}` +
				` ${`#${addCommas(tx.blockNumber)}`.padEnd(8)}` +
				` ${truncateAddress(tx.from).padEnd(13)}` +
				` ${to.padEnd(13)}` +
				` ${formatWei(tx.value).padEnd(12)}` +
				` ${formatGasPrice(tx.gasPrice).padEnd(12)}` +
				` ${status.text.padEnd(6)}` +
				` ${formatTxType(tx.type)}`

			rowLine.content = line
			rowLine.fg = isSelected ? DRACULA.foreground : DRACULA.comment
			rowBg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
		}

		// Filter bar
		if (viewState.filterActive) {
			filterLine.content = `/ ${viewState.filterQuery}_`
			filterLine.fg = DRACULA.yellow
		} else if (viewState.filterQuery) {
			filterLine.content = `Filter: ${viewState.filterQuery} (/ to edit, Esc to clear)`
			filterLine.fg = DRACULA.comment
		} else {
			filterLine.content = ""
		}

		// Status line
		statusLine.content = " [Enter] Details  [/] Filter  [j/k] Navigate"
		statusLine.fg = DRACULA.comment

		// Update title with count
		const total = txs.length
		listTitle.content = viewState.filterQuery ? ` Transactions (${total} matches) ` : ` Transactions (${total}) `
	}

	const renderDetail = (): void => {
		const txs = getFilteredTransactions()
		const tx = txs[viewState.selectedIndex]
		if (!tx) return

		const status = formatStatus(tx.status)

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(
			0,
			`Transaction ${status.text} ${tx.status === 1 ? "Success" : "Failed"} — ${formatTxType(tx.type)}`,
			status.color,
		)
		setLine(1, "")
		setLine(2, `Hash:          ${tx.hash}`, SEMANTIC.hash)
		setLine(3, `Block:         #${tx.blockNumber} (${tx.blockHash})`, DRACULA.purple)
		setLine(4, `From:          ${tx.from}`, SEMANTIC.address)
		setLine(5, `To:            ${tx.to ?? "(contract creation)"}`, SEMANTIC.address)
		setLine(6, `Value:         ${formatWei(tx.value)}`, SEMANTIC.value)
		setLine(7, `Nonce:         ${tx.nonce.toString()}`, DRACULA.foreground)
		setLine(8, `Gas Price:     ${formatGasPrice(tx.gasPrice)}`, SEMANTIC.gas)
		setLine(9, `Gas Used:      ${addCommas(tx.gasUsed)} / ${addCommas(tx.gas)}`, SEMANTIC.gas)
		setLine(10, `Status:        ${tx.status === 1 ? "Success (1)" : "Failed (0)"}`, status.color)
		setLine(11, `Type:          ${formatTxType(tx.type)} (${tx.type})`, DRACULA.foreground)
		setLine(12, "")
		setLine(13, "Calldata:", DRACULA.cyan)
		setLine(14, `  ${tx.data.length <= 70 ? tx.data : `${tx.data.slice(0, 70)}...`}`, DRACULA.foreground)
		setLine(15, "")

		// Contract address (if creation)
		if (tx.contractAddress) {
			setLine(16, `Contract:      ${tx.contractAddress}`, SEMANTIC.address)
		} else {
			setLine(16, "")
		}

		// Logs
		setLine(17, `Logs: ${tx.logs.length} entries`, DRACULA.cyan)
		const maxLogLines = DETAIL_LINES - 19 // Leave room for footer
		for (let i = 0; i < Math.min(tx.logs.length, maxLogLines); i++) {
			const log = tx.logs[i]
			if (log) {
				setLine(18 + i, `  [${i}] ${truncateAddress(log.address)} ${log.topics.length} topics`, DRACULA.comment)
			}
		}
		// Clear remaining
		const usedLines = 18 + Math.min(tx.logs.length, maxLogLines)
		for (let i = usedLines; i < DETAIL_LINES - 1; i++) {
			setLine(i, "")
		}

		// Footer
		setLine(DETAIL_LINES - 1, " [Esc] Back", DRACULA.comment)

		detailTitle.content = " Transaction Detail (Esc to go back) "
	}

	const render = (): void => {
		// Switch containers if mode changed
		if (viewState.viewMode !== currentMode) {
			if (viewState.viewMode === "detail") {
				container.remove(listBox.id)
				container.add(detailBox)
			} else {
				container.remove(detailBox.id)
				container.add(listBox)
			}
			currentMode = viewState.viewMode
		}

		if (viewState.viewMode === "list") {
			renderList()
		} else {
			renderDetail()
		}
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	const handleKey = (key: string): void => {
		viewState = transactionsReduce(viewState, key)
		// Clamp selectedIndex to the filtered count
		const filtered = getFilteredTransactions()
		if (filtered.length > 0 && viewState.selectedIndex >= filtered.length) {
			viewState = { ...viewState, selectedIndex: filtered.length - 1 }
		}
		render()
	}

	const update = (transactions: readonly TransactionDetail[]): void => {
		viewState = { ...viewState, transactions, selectedIndex: 0 }
		render()
	}

	const getState = (): TransactionsViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, getState }
}
