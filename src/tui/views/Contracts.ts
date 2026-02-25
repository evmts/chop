/**
 * Contracts view component — split-pane layout with contract list and detail.
 *
 * Left pane: scrollable contract list (address + code size).
 * Right pane: detail for selected contract (disassembly/bytecode/storage).
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `contractsReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import type { ContractDetail, ContractSummary } from "./contracts-data.js"
import {
	formatBytecodeHex,
	formatCodeSize,
	formatDisassemblyLine,
	formatSelector,
	formatStorageValue,
	truncateAddress,
} from "./contracts-format.js"

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** View mode for the contracts pane. */
export type ContractsViewMode = "list" | "disassembly" | "bytecode" | "storage"

/** Internal state for the contracts view. */
export interface ContractsViewState {
	/** Index of the currently selected contract in the list. */
	readonly selectedIndex: number
	/** Current view mode. */
	readonly viewMode: ContractsViewMode
	/** Contract summaries for the list pane. */
	readonly contracts: readonly ContractSummary[]
	/** Full detail for the selected contract (loaded on Enter). */
	readonly detail: ContractDetail | null
	/** Scroll offset for detail pane content (disassembly/bytecode/storage). */
	readonly detailScrollOffset: number
}

/** Default initial state. */
export const initialContractsState: ContractsViewState = {
	selectedIndex: 0,
	viewMode: "list",
	contracts: [],
	detail: null,
	detailScrollOffset: 0,
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for contracts view state.
 *
 * Handles:
 * - j/k: navigate list or scroll detail
 * - return: enter detail (disassembly) view
 * - escape: back to list
 * - d: toggle disassembly ↔ bytecode (in detail modes)
 * - s: switch to/from storage view (in detail modes)
 */
export const contractsReduce = (state: ContractsViewState, key: string): ContractsViewState => {
	// Detail modes: disassembly, bytecode, storage
	if (state.viewMode === "disassembly" || state.viewMode === "bytecode" || state.viewMode === "storage") {
		switch (key) {
			case "escape":
				return { ...state, viewMode: "list", detailScrollOffset: 0 }
			case "d":
				if (state.viewMode === "disassembly") return { ...state, viewMode: "bytecode", detailScrollOffset: 0 }
				if (state.viewMode === "bytecode") return { ...state, viewMode: "disassembly", detailScrollOffset: 0 }
				return state // d does nothing in storage
			case "s":
				if (state.viewMode === "storage") return { ...state, viewMode: "disassembly", detailScrollOffset: 0 }
				return { ...state, viewMode: "storage", detailScrollOffset: 0 }
			case "j":
				return { ...state, detailScrollOffset: state.detailScrollOffset + 1 }
			case "k":
				return { ...state, detailScrollOffset: Math.max(0, state.detailScrollOffset - 1) }
			default:
				return state
		}
	}

	// List mode
	switch (key) {
		case "j": {
			const maxIndex = Math.max(0, state.contracts.length - 1)
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }
		}
		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }
		case "return":
			if (state.contracts.length === 0) return state
			return { ...state, viewMode: "disassembly", detailScrollOffset: 0 }
		case "d":
		case "s":
			return state // These keys do nothing in list mode
		default:
			return state
	}
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createContracts. */
export interface ContractsHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the contract list data. */
	readonly update: (contracts: readonly ContractSummary[]) => void
	/** Update the detail pane with loaded contract detail. */
	readonly updateDetail: (detail: ContractDetail) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => ContractsViewState
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of visible data rows in the list pane. */
const LIST_VISIBLE_ROWS = 19

/** Number of visible lines in the detail pane. */
const DETAIL_VISIBLE_LINES = 20

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the Contracts view with split-pane layout.
 *
 * Layout (list mode):
 * ```
 * ┌─ Contracts ──────────────────────────────────────────────┐
 * │  Address           Code Size                              │
 * │  0xABCD...1234     1.5 KB                                │
 * │  0x1234...5678     2.0 KB                                │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * Layout (detail mode - disassembly/bytecode/storage):
 * ```
 * ┌─ Contract Detail ────────────────────────────────────────┐
 * │  [Disassembly / Bytecode / Storage]                      │
 * │  0x0000: PUSH1 0x80                                      │
 * │  0x0002: PUSH1 0x40                                      │
 * │  ...                                                      │
 * └──────────────────────────────────────────────────────────┘
 * ```
 */
export const createContracts = (renderer: CliRenderer): ContractsHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: ContractsViewState = { ...initialContractsState }

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

	const listTitle = new Text(renderer, {
		content: " Contracts ",
		fg: DRACULA.cyan,
	})
	listBox.add(listTitle)

	const headerLine = new Text(renderer, {
		content: "  Address                     Code Size",
		fg: DRACULA.comment,
		truncate: true,
	})
	listBox.add(headerLine)

	// Pre-allocated rows
	const rowLines: TextRenderable[] = []
	const rowBgs: BoxRenderable[] = []
	for (let i = 0; i < LIST_VISIBLE_ROWS; i++) {
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

	const listStatusLine = new Text(renderer, {
		content: "",
		fg: DRACULA.comment,
		truncate: true,
	})
	listBox.add(listStatusLine)

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
		content: " Contract Detail ",
		fg: DRACULA.purple,
	})
	detailBox.add(detailTitle)

	const detailLines: TextRenderable[] = []
	for (let i = 0; i < DETAIL_VISIBLE_LINES; i++) {
		const line = new Text(renderer, {
			content: "",
			fg: DRACULA.foreground,
		})
		detailLines.push(line)
		detailBox.add(line)
	}

	// -------------------------------------------------------------------------
	// Container
	// -------------------------------------------------------------------------

	const container = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})

	container.add(listBox)
	let currentMode: ContractsViewMode = "list"

	// -------------------------------------------------------------------------
	// Render functions
	// -------------------------------------------------------------------------

	const renderList = (): void => {
		const contracts = viewState.contracts
		const scrollOffset = Math.max(0, viewState.selectedIndex - LIST_VISIBLE_ROWS + 1)

		for (let i = 0; i < LIST_VISIBLE_ROWS; i++) {
			const contractIndex = i + scrollOffset
			const contract = contracts[contractIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!contract) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = contractIndex === viewState.selectedIndex
			const line = ` ${truncateAddress(contract.address).padEnd(28)} ${formatCodeSize(contract.codeSize)}`

			rowLine.content = line
			rowLine.fg = isSelected ? DRACULA.foreground : DRACULA.comment
			rowBg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
		}

		listStatusLine.content = " [Enter] Details  [j/k] Navigate"
		listTitle.content = ` Contracts (${contracts.length}) `
	}

	const renderDisassembly = (): void => {
		const detail = viewState.detail
		if (!detail) return

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(0, `Contract ${truncateAddress(detail.address)}  (${formatCodeSize(detail.codeSize)})`, DRACULA.cyan)
		setLine(1, "")

		// Selectors section
		if (detail.selectors.length > 0) {
			setLine(2, "Function Selectors:", DRACULA.comment)
			const maxSelectorLines = Math.min(detail.selectors.length, 4)
			for (let i = 0; i < maxSelectorLines; i++) {
				const sel = detail.selectors[i]!
				setLine(3 + i, `  ${formatSelector(sel.selector, sel.name)}`, SEMANTIC.primary)
			}
			if (detail.selectors.length > maxSelectorLines) {
				setLine(3 + maxSelectorLines, `  ... and ${detail.selectors.length - maxSelectorLines} more`, DRACULA.comment)
			}
		} else {
			setLine(2, "No function selectors detected.", DRACULA.comment)
		}

		// Disassembly section
		const disasmStartLine = detail.selectors.length > 0 ? Math.min(detail.selectors.length, 4) + 5 : 4
		setLine(disasmStartLine - 1, "Disassembly:", DRACULA.comment)

		const availableLines = DETAIL_VISIBLE_LINES - disasmStartLine - 1 // -1 for footer
		const offset = viewState.detailScrollOffset
		for (let i = 0; i < availableLines; i++) {
			const instIdx = i + offset
			if (instIdx < detail.instructions.length) {
				setLine(disasmStartLine + i, `  ${formatDisassemblyLine(detail.instructions[instIdx]!)}`, DRACULA.foreground)
			} else {
				setLine(disasmStartLine + i, "")
			}
		}

		// Footer
		setLine(DETAIL_VISIBLE_LINES - 1, " [d] Bytecode  [s] Storage  [j/k] Scroll  [Esc] Back", DRACULA.comment)

		detailTitle.content = " Disassembly (d=bytecode, s=storage, Esc=back) "
	}

	const renderBytecode = (): void => {
		const detail = viewState.detail
		if (!detail) return

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(0, `Contract ${truncateAddress(detail.address)}  (${formatCodeSize(detail.codeSize)})`, DRACULA.cyan)
		setLine(1, "Bytecode Hex Dump:", DRACULA.comment)

		const hexDump = formatBytecodeHex(detail.bytecodeHex, viewState.detailScrollOffset)
		const hexLines = hexDump.split("\n")

		const availableLines = DETAIL_VISIBLE_LINES - 3 // title + header + footer
		for (let i = 0; i < availableLines; i++) {
			if (i < hexLines.length) {
				setLine(2 + i, `  ${hexLines[i]}`, DRACULA.foreground)
			} else {
				setLine(2 + i, "")
			}
		}

		// Footer
		setLine(DETAIL_VISIBLE_LINES - 1, " [d] Disassembly  [s] Storage  [j/k] Scroll  [Esc] Back", DRACULA.comment)

		detailTitle.content = " Bytecode (d=disasm, s=storage, Esc=back) "
	}

	const renderStorage = (): void => {
		const detail = viewState.detail
		if (!detail) return

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(0, `Contract ${truncateAddress(detail.address)}  Storage`, DRACULA.cyan)
		setLine(1, "")

		if (detail.storageEntries.length === 0) {
			setLine(2, "No storage entries found.", DRACULA.comment)
			for (let i = 3; i < DETAIL_VISIBLE_LINES - 1; i++) {
				setLine(i, "")
			}
		} else {
			setLine(2, "  Slot                                                                Value", DRACULA.comment)
			const offset = viewState.detailScrollOffset
			const availableLines = DETAIL_VISIBLE_LINES - 4 // title + blank + header + footer
			for (let i = 0; i < availableLines; i++) {
				const entryIdx = i + offset
				if (entryIdx < detail.storageEntries.length) {
					const entry = detail.storageEntries[entryIdx]!
					setLine(3 + i, `  ${entry.slot.padEnd(68)} ${formatStorageValue(entry.value)}`, SEMANTIC.value)
				} else {
					setLine(3 + i, "")
				}
			}
		}

		// Footer
		setLine(DETAIL_VISIBLE_LINES - 1, " [d] Disassembly  [s] Back  [j/k] Scroll  [Esc] List", DRACULA.comment)

		detailTitle.content = " Storage (d=disasm, s=back, Esc=list) "
	}

	const render = (): void => {
		// Switch containers if mode changed
		const isDetail = viewState.viewMode !== "list"
		if (isDetail && currentMode === "list") {
			container.remove(listBox.id)
			container.add(detailBox)
			currentMode = viewState.viewMode
		} else if (!isDetail && currentMode !== "list") {
			container.remove(detailBox.id)
			container.add(listBox)
			currentMode = "list"
		} else {
			currentMode = viewState.viewMode
		}

		switch (viewState.viewMode) {
			case "list":
				renderList()
				break
			case "disassembly":
				renderDisassembly()
				break
			case "bytecode":
				renderBytecode()
				break
			case "storage":
				renderStorage()
				break
		}
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	const handleKey = (key: string): void => {
		viewState = contractsReduce(viewState, key)

		// Clamp selectedIndex
		if (viewState.contracts.length > 0 && viewState.selectedIndex >= viewState.contracts.length) {
			viewState = { ...viewState, selectedIndex: viewState.contracts.length - 1 }
		}

		render()
	}

	const update = (contracts: readonly ContractSummary[]): void => {
		viewState = { ...viewState, contracts, selectedIndex: 0 }
		render()
	}

	const updateDetail = (detail: ContractDetail): void => {
		viewState = { ...viewState, detail }
		render()
	}

	const getState = (): ContractsViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, updateDetail, getState }
}
