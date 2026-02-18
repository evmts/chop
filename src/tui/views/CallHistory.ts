/**
 * Call History view component — scrollable table of past EVM calls
 * with detail pane on Enter and filter via `/`.
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `callHistoryReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import type { CallRecord } from "../services/call-history-store.js"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import {
	formatCallType,
	formatGas,
	formatGasBreakdown,
	formatStatus,
	formatWei,
	truncateAddress,
	truncateData,
	truncateHash,
} from "./call-history-format.js"

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** View mode for the call history pane. */
export type ViewMode = "list" | "detail"

/** Internal state for the call history view. */
export interface CallHistoryViewState {
	/** Index of the currently selected row. */
	readonly selectedIndex: number
	/** Current view mode: list table or detail pane. */
	readonly viewMode: ViewMode
	/** Active filter query string. */
	readonly filterQuery: string
	/** Whether filter input is active (capturing keystrokes). */
	readonly filterActive: boolean
	/** Current records displayed. */
	readonly records: readonly CallRecord[]
}

/** Default initial state. */
export const initialCallHistoryState: CallHistoryViewState = {
	selectedIndex: 0,
	viewMode: "list",
	filterQuery: "",
	filterActive: false,
	records: [],
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for call history view state.
 *
 * Handles:
 * - j/k: move selection down/up
 * - return: enter detail view (or confirm filter)
 * - escape: back to list / clear filter
 * - /: activate filter mode
 * - backspace: delete last filter char
 * - other keys in filter mode: append to query
 */
export const callHistoryReduce = (state: CallHistoryViewState, key: string): CallHistoryViewState => {
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
			const maxIndex = Math.max(0, state.records.length - 1)
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }
		}
		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }
		case "return":
			if (state.records.length === 0) return state
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

/** Handle returned by createCallHistory. */
export interface CallHistoryHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. Returns true if handled. */
	readonly handleKey: (key: string) => void
	/** Update the view with new records. */
	readonly update: (records: readonly CallRecord[]) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => CallHistoryViewState
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
 * Create the Call History view with scrollable table + detail pane.
 *
 * Layout (list mode):
 * ```
 * ┌─ Call History ──────────────────────────────────────────────┐
 * │ #    Type     From          To            Value    Gas  Sta │
 * │ 1    CALL     0xf39F...2266 0x7099...79C8 1.5 ETH 21K  ✓  │
 * │ 2    CREATE   0xf39F...2266               0 ETH   50K  ✓  │
 * │ ...                                                        │
 * └────────────────────────────────────────────────────────────┘
 * ```
 *
 * Layout (detail mode):
 * ```
 * ┌─ Call Detail ──────────────────────────────────────────────┐
 * │ Call #1 — CALL (✓ Success)                                 │
 * │ From:   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266        │
 * │ To:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8        │
 * │ Value:  1.50 ETH                                           │
 * │ Gas:    21,000 / 21,000 (100.00%)                          │
 * │                                                            │
 * │ Calldata:                                                  │
 * │ 0xa9059cbb...                                              │
 * │                                                            │
 * │ Return Data:                                               │
 * │ 0x...                                                      │
 * │                                                            │
 * │ Logs: 0 entries                                            │
 * └────────────────────────────────────────────────────────────┘
 * ```
 */
export const createCallHistory = (renderer: CliRenderer): CallHistoryHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: CallHistoryViewState = { ...initialCallHistoryState }

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
		content: " Call History ",
		fg: DRACULA.cyan,
	})
	listBox.add(listTitle)

	// Header row
	const headerLine = new Text(renderer, {
		content: " #    Type     From          To            Value        Gas    Status",
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
		content: " Call Detail ",
		fg: DRACULA.purple,
	})
	detailBox.add(detailTitle)

	// Detail has ~20 lines for showing all info
	const DETAIL_LINES = 20
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
	let currentMode: ViewMode = "list"

	// -------------------------------------------------------------------------
	// Render functions
	// -------------------------------------------------------------------------

	const renderList = (): void => {
		const records = viewState.records
		const scrollOffset = Math.max(0, viewState.selectedIndex - VISIBLE_ROWS + 1)

		for (let i = 0; i < VISIBLE_ROWS; i++) {
			const recordIndex = i + scrollOffset
			const record = records[recordIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!record) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = recordIndex === viewState.selectedIndex
			const ct = formatCallType(record.type)
			const status = formatStatus(record.success)
			const to = record.to ? truncateAddress(record.to) : "CREATE"

			const line = ` ${record.id.toString().padEnd(4)} ${ct.text.padEnd(8)} ${truncateAddress(record.from).padEnd(13)} ${to.padEnd(13)} ${formatWei(record.value).padEnd(12)} ${formatGas(record.gasUsed).padEnd(6)} ${status.text}`

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

		// Update title with count
		const total = records.length
		listTitle.content = viewState.filterQuery
			? ` Call History (${total} matches) `
			: ` Call History (${total}) `
	}

	const renderDetail = (): void => {
		const record = viewState.records[viewState.selectedIndex]
		if (!record) return

		const ct = formatCallType(record.type)
		const status = formatStatus(record.success)

		const setDetailLine = (index: number, content: string, fg = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setDetailLine(0, `Call #${record.id} \u2014 ${ct.text} (${status.text} ${record.success ? "Success" : "Failed"})`, ct.color)
		setDetailLine(1, "")
		setDetailLine(2, `From:      ${record.from}`, SEMANTIC.address)
		setDetailLine(3, `To:        ${record.to || "(contract creation)"}`, SEMANTIC.address)
		setDetailLine(4, `Value:     ${formatWei(record.value)}`, SEMANTIC.value)
		setDetailLine(5, `Block:     #${record.blockNumber}`, DRACULA.purple)
		setDetailLine(6, `Tx Hash:   ${record.txHash}`, SEMANTIC.hash)
		setDetailLine(7, `Gas:       ${formatGasBreakdown(record.gasUsed, record.gasLimit)}`, SEMANTIC.gas)
		setDetailLine(8, "")
		setDetailLine(9, "Calldata:", DRACULA.cyan)
		setDetailLine(10, `  ${truncateData(record.calldata, 70)}`, DRACULA.foreground)
		setDetailLine(11, "")
		setDetailLine(12, "Return Data:", DRACULA.cyan)
		setDetailLine(13, `  ${truncateData(record.returnData, 70)}`, DRACULA.foreground)
		setDetailLine(14, "")
		setDetailLine(15, `Logs: ${record.logs.length} entries`, DRACULA.cyan)
		// Show first few logs
		for (let i = 0; i < Math.min(record.logs.length, 4); i++) {
			const log = record.logs[i]
			if (log) {
				setDetailLine(16 + i, `  [${i}] ${truncateAddress(log.address)} ${log.topics.length} topics`, DRACULA.comment)
			}
		}
		// Clear remaining lines
		for (let i = 16 + Math.min(record.logs.length, 4); i < DETAIL_LINES; i++) {
			setDetailLine(i, "")
		}

		detailTitle.content = ` Call #${record.id} Detail (Esc to go back) `
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
		viewState = callHistoryReduce(viewState, key)
		render()
	}

	const update = (records: readonly CallRecord[]): void => {
		viewState = { ...viewState, records, selectedIndex: 0 }
		render()
	}

	const getState = (): CallHistoryViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, getState }
}
