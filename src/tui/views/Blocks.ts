/**
 * Blocks view component — scrollable table of blockchain blocks
 * with mine via `m` and block detail on Enter.
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `blocksReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import type { BlockDetail } from "./blocks-data.js"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import {
	formatBlockNumber,
	formatTxCount,
	formatGasUsage,
	formatTimestampAbsolute,
	truncateHash,
	formatTimestamp,
	formatGas,
	formatWei,
} from "./blocks-format.js"

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** View mode for the blocks pane. */
export type BlocksViewMode = "list" | "detail"

/** Internal state for the blocks view. */
export interface BlocksViewState {
	/** Index of the currently selected row. */
	readonly selectedIndex: number
	/** Current view mode. */
	readonly viewMode: BlocksViewMode
	/** Current block details (reverse chronological order). */
	readonly blocks: readonly BlockDetail[]
	/** Signal: mine was requested (consumed by App.ts). */
	readonly mineRequested: boolean
}

/** Default initial state. */
export const initialBlocksState: BlocksViewState = {
	selectedIndex: 0,
	viewMode: "list",
	blocks: [],
	mineRequested: false,
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for blocks view state.
 *
 * Handles:
 * - j/k: move selection down/up
 * - return: enter detail view
 * - escape: back to list
 * - m: request mine block
 */
export const blocksReduce = (state: BlocksViewState, key: string): BlocksViewState => {
	// Detail mode
	if (state.viewMode === "detail") {
		if (key === "escape") {
			return { ...state, viewMode: "list" }
		}
		if (key === "m") {
			return { ...state, mineRequested: true }
		}
		return state
	}

	// List mode
	switch (key) {
		case "j": {
			const maxIndex = Math.max(0, state.blocks.length - 1)
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }
		}
		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }
		case "return":
			if (state.blocks.length === 0) return state
			return { ...state, viewMode: "detail" }
		case "m":
			return { ...state, mineRequested: true }
		case "escape":
			return state
		default:
			return state
	}
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createBlocks. */
export interface BlocksHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the view with new block data. */
	readonly update: (blocks: readonly BlockDetail[]) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => BlocksViewState
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
 * Create the Blocks view with scrollable table and detail pane.
 *
 * Layout (list mode):
 * ```
 * ┌─ Blocks ────────────────────────────────────────────────────┐
 * │  Block    Hash          Timestamp          Txs  Gas Used    │
 * │  #3       0xabcd...ef01  5s ago            0    0           │
 * │  #2       0x1234...5678  10s ago           0    0           │
 * │ ...                                                          │
 * └──────────────────────────────────────────────────────────────┘
 * ```
 */
export const createBlocks = (renderer: CliRenderer): BlocksHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: BlocksViewState = { ...initialBlocksState }

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
		content: " Blocks ",
		fg: DRACULA.cyan,
	})
	listBox.add(listTitle)

	// Header row
	const headerLine = new Text(renderer, {
		content: "  Block      Hash           Timestamp            Txs   Gas Used     Base Fee",
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
		content: " Block Detail ",
		fg: DRACULA.purple,
	})
	detailBox.add(detailTitle)

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
	let currentMode: BlocksViewMode = "list"

	// -------------------------------------------------------------------------
	// Render functions
	// -------------------------------------------------------------------------

	const renderList = (): void => {
		const blocks = viewState.blocks
		const scrollOffset = Math.max(0, viewState.selectedIndex - VISIBLE_ROWS + 1)

		for (let i = 0; i < VISIBLE_ROWS; i++) {
			const blockIndex = i + scrollOffset
			const block = blocks[blockIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!block) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = blockIndex === viewState.selectedIndex

			const line = ` ${formatBlockNumber(block.number).padEnd(10)} ${truncateHash(block.hash).padEnd(14)} ${formatTimestamp(block.timestamp).padEnd(20)} ${formatTxCount(block.transactionHashes).padEnd(5)} ${formatGas(block.gasUsed).padEnd(12)} ${formatWei(block.baseFeePerGas)}`

			rowLine.content = line
			rowLine.fg = isSelected ? DRACULA.foreground : DRACULA.comment
			rowBg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
		}

		// Status line
		statusLine.content = " [Enter] Details  [m] Mine  [j/k] Navigate"
		statusLine.fg = DRACULA.comment

		// Title with count
		listTitle.content = ` Blocks (${blocks.length}) `
	}

	const renderDetail = (): void => {
		const block = viewState.blocks[viewState.selectedIndex]
		if (!block) return

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(0, `Block ${formatBlockNumber(block.number)}`, DRACULA.cyan)
		setLine(1, "")
		setLine(2, `Hash:          ${block.hash}`, SEMANTIC.hash)
		setLine(3, `Parent Hash:   ${block.parentHash}`, SEMANTIC.hash)
		setLine(4, `Number:        ${block.number.toString()}`, DRACULA.purple)
		setLine(
			5,
			`Timestamp:     ${formatTimestampAbsolute(block.timestamp)} (${formatTimestamp(block.timestamp)})`,
			DRACULA.foreground,
		)
		setLine(6, `Gas Used:      ${formatGasUsage(block.gasUsed, block.gasLimit)}`, SEMANTIC.gas)
		setLine(7, `Base Fee:      ${formatWei(block.baseFeePerGas)}`, SEMANTIC.value)
		setLine(8, `Transactions:  ${block.transactionHashes.length}`, DRACULA.foreground)
		setLine(9, "")

		// Transaction hashes list
		if (block.transactionHashes.length > 0) {
			setLine(10, "Transaction Hashes:", DRACULA.comment)
			const maxTxLines = DETAIL_LINES - 13 // Leave room for footer
			for (let i = 0; i < maxTxLines && i < block.transactionHashes.length; i++) {
				setLine(11 + i, `  ${block.transactionHashes[i]}`, SEMANTIC.hash)
			}
			if (block.transactionHashes.length > maxTxLines) {
				setLine(11 + maxTxLines, `  ... and ${block.transactionHashes.length - maxTxLines} more`, DRACULA.comment)
			}
			// Clear remaining
			const usedLines =
				11 +
				Math.min(block.transactionHashes.length, maxTxLines) +
				(block.transactionHashes.length > maxTxLines ? 1 : 0)
			for (let i = usedLines; i < DETAIL_LINES - 1; i++) {
				setLine(i, "")
			}
		} else {
			setLine(10, "No transactions in this block.", DRACULA.comment)
			for (let i = 11; i < DETAIL_LINES - 1; i++) {
				setLine(i, "")
			}
		}

		// Footer
		setLine(DETAIL_LINES - 1, " [m] Mine  [Esc] Back", DRACULA.comment)

		detailTitle.content = ` Block Detail (Esc to go back) `
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
		viewState = blocksReduce(viewState, key)

		// Clamp selectedIndex
		if (viewState.blocks.length > 0 && viewState.selectedIndex >= viewState.blocks.length) {
			viewState = { ...viewState, selectedIndex: viewState.blocks.length - 1 }
		}

		render()
	}

	const update = (blocks: readonly BlockDetail[]): void => {
		viewState = { ...viewState, blocks, selectedIndex: 0 }
		render()
	}

	const getState = (): BlocksViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, getState }
}
