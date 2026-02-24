/**
 * State Inspector view component — tree browser for accounts → storage.
 *
 * Features: expand/collapse with Enter or h/l, hex/decimal toggle with x,
 * edit storage with e (devnet only), search with /.
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `stateInspectorReduce()` and `buildFlatTree()` for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import type { AccountTreeNode, StateInspectorData } from "./state-inspector-data.js"
import {
	formatBalanceLine,
	formatCodeLine,
	formatIndent,
	formatNonceLine,
	formatStorageSlotLine,
	formatTreeIndicator,
	truncateAddress,
} from "./state-inspector-format.js"

// ---------------------------------------------------------------------------
// Tree row model
// ---------------------------------------------------------------------------

/** Row types in the flat tree. */
export type TreeRowType = "account" | "balance" | "nonce" | "code" | "storageHeader" | "storageSlot"

/** A single row in the flattened tree. */
export interface TreeRow {
	/** Type of this row. */
	readonly type: TreeRowType
	/** Index of the account this row belongs to. */
	readonly accountIndex: number
	/** For storageSlot rows, index into the account's storage array. */
	readonly slotIndex?: number
}

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** Internal state for the state inspector view. */
export interface StateInspectorViewState {
	/** Cursor position in the flat visible list. */
	readonly selectedIndex: number
	/** Set of account indices that are expanded. */
	readonly expandedAccounts: ReadonlySet<number>
	/** Set of account indices whose storage section is expanded. */
	readonly expandedStorage: ReadonlySet<number>
	/** Whether hex or decimal mode is active. */
	readonly showDecimal: boolean
	/** Whether search input is capturing keys. */
	readonly searchActive: boolean
	/** Current search text. */
	readonly searchQuery: string
	/** Whether edit input is capturing keys. */
	readonly editActive: boolean
	/** Edit value input. */
	readonly editValue: string
	/** Signal: edit was confirmed (consumed by App.ts). */
	readonly editConfirmed: boolean
	/** Account tree data from data layer. */
	readonly accounts: readonly AccountTreeNode[]
}

/** Default initial state. */
export const initialStateInspectorState: StateInspectorViewState = {
	selectedIndex: 0,
	expandedAccounts: new Set(),
	expandedStorage: new Set(),
	showDecimal: false,
	searchActive: false,
	searchQuery: "",
	editActive: false,
	editValue: "",
	editConfirmed: false,
	accounts: [],
}

// ---------------------------------------------------------------------------
// Flat tree builder (pure, testable)
// ---------------------------------------------------------------------------

/**
 * Build a flat list of TreeRow entries based on which accounts/storage
 * sections are expanded. This determines total row count and what each
 * selectedIndex maps to.
 */
export const buildFlatTree = (state: StateInspectorViewState): readonly TreeRow[] => {
	const rows: TreeRow[] = []
	const filteredAccounts = state.searchQuery
		? state.accounts.filter((a) => a.address.toLowerCase().includes(state.searchQuery.toLowerCase()))
		: state.accounts

	for (let i = 0; i < filteredAccounts.length; i++) {
		const account = filteredAccounts[i]!
		// Find original index for expansion tracking
		const originalIndex = state.accounts.indexOf(account)
		rows.push({ type: "account", accountIndex: originalIndex })

		if (state.expandedAccounts.has(originalIndex)) {
			rows.push({ type: "balance", accountIndex: originalIndex })
			rows.push({ type: "nonce", accountIndex: originalIndex })
			rows.push({ type: "code", accountIndex: originalIndex })
			rows.push({ type: "storageHeader", accountIndex: originalIndex })

			if (state.expandedStorage.has(originalIndex)) {
				for (let s = 0; s < account.storage.length; s++) {
					rows.push({ type: "storageSlot", accountIndex: originalIndex, slotIndex: s })
				}
			}
		}
	}

	return rows
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/** Set utilities for immutable toggle. */
const toggleSet = (set: ReadonlySet<number>, value: number): ReadonlySet<number> => {
	const next = new Set(set)
	if (next.has(value)) {
		next.delete(value)
	} else {
		next.add(value)
	}
	return next
}

const removeFromSet = (set: ReadonlySet<number>, value: number): ReadonlySet<number> => {
	const next = new Set(set)
	next.delete(value)
	return next
}

/**
 * Pure reducer for state inspector view state.
 *
 * Handles navigation (j/k), expand/collapse (return/l/h),
 * hex/dec toggle (x), search (/), and edit (e).
 */
export const stateInspectorReduce = (state: StateInspectorViewState, key: string): StateInspectorViewState => {
	// --- Search mode ---
	if (state.searchActive) {
		if (key === "escape") {
			return { ...state, searchActive: false, searchQuery: "" }
		}
		if (key === "return") {
			return { ...state, searchActive: false }
		}
		if (key === "backspace") {
			return { ...state, searchQuery: state.searchQuery.slice(0, -1) }
		}
		// Single printable characters
		if (key.length === 1) {
			return { ...state, searchQuery: state.searchQuery + key }
		}
		return state
	}

	// --- Edit mode ---
	if (state.editActive) {
		if (key === "escape") {
			return { ...state, editActive: false, editValue: "", editConfirmed: false }
		}
		if (key === "return") {
			return { ...state, editActive: false, editConfirmed: true }
		}
		if (key === "backspace") {
			return { ...state, editValue: state.editValue.slice(0, -1) }
		}
		// Single printable characters (hex chars)
		if (key.length === 1) {
			return { ...state, editValue: state.editValue + key }
		}
		return state
	}

	// --- Normal mode ---
	const flatTree = buildFlatTree(state)
	const maxIndex = Math.max(0, flatTree.length - 1)
	const currentRow = flatTree[state.selectedIndex]

	switch (key) {
		case "j":
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }

		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }

		case "return": {
			if (!currentRow) return state
			if (currentRow.type === "account") {
				return { ...state, expandedAccounts: toggleSet(state.expandedAccounts, currentRow.accountIndex) }
			}
			if (currentRow.type === "storageHeader") {
				return { ...state, expandedStorage: toggleSet(state.expandedStorage, currentRow.accountIndex) }
			}
			return state
		}

		case "l": {
			if (!currentRow) return state
			if (currentRow.type === "account" && !state.expandedAccounts.has(currentRow.accountIndex)) {
				return { ...state, expandedAccounts: toggleSet(state.expandedAccounts, currentRow.accountIndex) }
			}
			if (currentRow.type === "storageHeader" && !state.expandedStorage.has(currentRow.accountIndex)) {
				return { ...state, expandedStorage: toggleSet(state.expandedStorage, currentRow.accountIndex) }
			}
			return state
		}

		case "h": {
			if (!currentRow) return state
			if (currentRow.type === "account") {
				// Collapse if expanded
				if (state.expandedAccounts.has(currentRow.accountIndex)) {
					return { ...state, expandedAccounts: removeFromSet(state.expandedAccounts, currentRow.accountIndex) }
				}
				return state
			}
			if (currentRow.type === "storageHeader") {
				if (state.expandedStorage.has(currentRow.accountIndex)) {
					return { ...state, expandedStorage: removeFromSet(state.expandedStorage, currentRow.accountIndex) }
				}
				// Jump to parent account
				const parentIndex = flatTree.findIndex(
					(r) => r.type === "account" && r.accountIndex === currentRow.accountIndex,
				)
				if (parentIndex >= 0) {
					return {
						...state,
						selectedIndex: parentIndex,
						expandedAccounts: removeFromSet(state.expandedAccounts, currentRow.accountIndex),
					}
				}
				return state
			}
			// Child rows (balance, nonce, code, storageSlot) — jump to parent
			if (
				currentRow.type === "balance" ||
				currentRow.type === "nonce" ||
				currentRow.type === "code" ||
				currentRow.type === "storageSlot"
			) {
				const parentIndex = flatTree.findIndex(
					(r) => r.type === "account" && r.accountIndex === currentRow.accountIndex,
				)
				if (parentIndex >= 0) {
					return {
						...state,
						selectedIndex: parentIndex,
						expandedAccounts: removeFromSet(state.expandedAccounts, currentRow.accountIndex),
					}
				}
			}
			return state
		}

		case "x":
			return { ...state, showDecimal: !state.showDecimal }

		case "/":
			return { ...state, searchActive: true }

		case "e": {
			if (!currentRow) return state
			if (currentRow.type === "storageSlot") {
				return { ...state, editActive: true, editValue: "", editConfirmed: false }
			}
			return state
		}

		default:
			return state
	}
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createStateInspector. */
export interface StateInspectorHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the view with new state inspector data. */
	readonly update: (data: StateInspectorData) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => StateInspectorViewState
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of visible rows in the tree. */
const VISIBLE_ROWS = 19

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the State Inspector view with tree browser.
 *
 * Layout:
 * ```
 * ┌─ State Inspector ──────────────────────────────────────────┐
 * │  ▸ 0xf39F...2266                                          │
 * │  ▾ 0x7099...79C8                                          │
 * │    Balance: 5,000.00 ETH                                   │
 * │    Nonce:   3                                               │
 * │    Code:    256 bytes                                       │
 * │    ▸ Storage (2 slots)                                     │
 * └────────────────────────────────────────────────────────────┘
 * ```
 */
export const createStateInspector = (renderer: CliRenderer): StateInspectorHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: StateInspectorViewState = { ...initialStateInspectorState }

	// -------------------------------------------------------------------------
	// Components
	// -------------------------------------------------------------------------

	const container = new Box(renderer, {
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
	const titleText = new Text(renderer, {
		content: " State Inspector ",
		fg: DRACULA.cyan,
	})
	container.add(titleText)

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
		container.add(rowBox)
		rowBgs.push(rowBox)
		rowLines.push(rowText)
	}

	// Status line
	const statusLine = new Text(renderer, {
		content: " [Enter/l] Expand  [h] Collapse  [x] Hex/Dec  [/] Search  [e] Edit  [j/k] Navigate",
		fg: DRACULA.comment,
		truncate: true,
	})
	container.add(statusLine)

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	const render = (): void => {
		const flatTree = buildFlatTree(viewState)
		const scrollOffset = Math.max(0, viewState.selectedIndex - VISIBLE_ROWS + 1)

		for (let i = 0; i < VISIBLE_ROWS; i++) {
			const rowIndex = i + scrollOffset
			const row = flatTree[rowIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!row) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = rowIndex === viewState.selectedIndex
			const account = viewState.accounts[row.accountIndex]

			let content = ""
			let fg: string = DRACULA.foreground

			switch (row.type) {
				case "account": {
					const indicator = formatTreeIndicator(viewState.expandedAccounts.has(row.accountIndex))
					const addr = account ? truncateAddress(account.address) : "???"
					content = `${formatIndent(0)}${indicator} ${addr}`
					fg = isSelected ? SEMANTIC.address : DRACULA.cyan
					break
				}
				case "balance": {
					content = `${formatIndent(1)}${formatBalanceLine(account?.balance ?? 0n)}`
					fg = isSelected ? SEMANTIC.value : DRACULA.green
					break
				}
				case "nonce": {
					content = `${formatIndent(1)}${formatNonceLine(account?.nonce ?? 0n)}`
					fg = isSelected ? DRACULA.foreground : DRACULA.comment
					break
				}
				case "code": {
					content = `${formatIndent(1)}${formatCodeLine(account?.codeSize ?? 0)}`
					fg = isSelected ? DRACULA.foreground : DRACULA.comment
					break
				}
				case "storageHeader": {
					const indicator = formatTreeIndicator(viewState.expandedStorage.has(row.accountIndex))
					const slotCount = account?.storage.length ?? 0
					content = `${formatIndent(1)}${indicator} Storage (${slotCount} slot${slotCount !== 1 ? "s" : ""})`
					fg = isSelected ? DRACULA.purple : DRACULA.comment
					break
				}
				case "storageSlot": {
					const slotEntry = account?.storage[row.slotIndex ?? 0]
					if (slotEntry) {
						content = `${formatIndent(2)}${formatStorageSlotLine(slotEntry.slot, slotEntry.value, viewState.showDecimal)}`
					}
					fg = isSelected ? SEMANTIC.value : DRACULA.comment
					break
				}
			}

			rowLine.content = content
			rowLine.fg = fg
			rowBg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
		}

		// Update status line based on mode
		if (viewState.searchActive) {
			statusLine.content = ` Search: ${viewState.searchQuery}█  [Enter] Confirm  [Esc] Cancel`
		} else if (viewState.editActive) {
			statusLine.content = ` Edit value: ${viewState.editValue}█  [Enter] Confirm  [Esc] Cancel`
		} else {
			statusLine.content = " [Enter/l] Expand  [h] Collapse  [x] Hex/Dec  [/] Search  [e] Edit  [j/k] Navigate"
		}

		// Update title with count
		const filteredCount = viewState.searchQuery
			? viewState.accounts.filter((a) => a.address.toLowerCase().includes(viewState.searchQuery.toLowerCase())).length
			: viewState.accounts.length
		titleText.content = ` State Inspector (${filteredCount} accounts) `
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	const handleKey = (key: string): void => {
		viewState = stateInspectorReduce(viewState, key)

		// Clamp selectedIndex to the flat tree
		const flatTree = buildFlatTree(viewState)
		if (flatTree.length > 0 && viewState.selectedIndex >= flatTree.length) {
			viewState = { ...viewState, selectedIndex: flatTree.length - 1 }
		}

		render()
	}

	const update = (data: StateInspectorData): void => {
		viewState = { ...viewState, accounts: data.accounts, editConfirmed: false }
		render()
	}

	const getState = (): StateInspectorViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, getState }
}
