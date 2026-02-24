/**
 * Accounts view component — scrollable table of devnet accounts
 * with fund prompt via `f` and impersonate via `i`.
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `accountsReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import type { AccountDetail } from "./accounts-data.js"
import {
	formatAccountType,
	formatBalance,
	formatCodeIndicator,
	formatNonce,
	truncateAddress,
} from "./accounts-format.js"

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** View mode for the accounts pane. */
export type AccountsViewMode = "list" | "detail" | "fundPrompt"

/** Internal state for the accounts view. */
export interface AccountsViewState {
	/** Index of the currently selected row. */
	readonly selectedIndex: number
	/** Current view mode. */
	readonly viewMode: AccountsViewMode
	/** Current account details. */
	readonly accounts: readonly AccountDetail[]
	/** Fund amount input string (ETH). */
	readonly fundAmount: string
	/** Whether text input is active (capturing keystrokes). */
	readonly inputActive: boolean
	/** Addresses that have been impersonated. */
	readonly impersonatedAddresses: ReadonlySet<string>
	/** Signal: fund was confirmed (consumed by handleKey). */
	readonly fundConfirmed: boolean
	/** Signal: impersonation was requested (consumed by handleKey). */
	readonly impersonateRequested: boolean
}

/** Default initial state. */
export const initialAccountsState: AccountsViewState = {
	selectedIndex: 0,
	viewMode: "list",
	accounts: [],
	fundAmount: "",
	inputActive: false,
	impersonatedAddresses: new Set(),
	fundConfirmed: false,
	impersonateRequested: false,
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for accounts view state.
 *
 * Handles:
 * - j/k: move selection down/up
 * - return: enter detail view (or confirm fund)
 * - escape: back to list / cancel fund prompt
 * - f: activate fund prompt
 * - i: impersonate selected account
 * - fund prompt mode: capture numeric input
 */
export const accountsReduce = (state: AccountsViewState, key: string): AccountsViewState => {
	// Fund prompt mode — capture numeric input
	if (state.viewMode === "fundPrompt" && state.inputActive) {
		if (key === "escape") {
			return { ...state, viewMode: "list", inputActive: false, fundAmount: "", fundConfirmed: false }
		}
		if (key === "return") {
			if (state.fundAmount === "") {
				return { ...state, viewMode: "list", inputActive: false, fundConfirmed: false }
			}
			return { ...state, viewMode: "list", inputActive: false, fundConfirmed: true }
		}
		if (key === "backspace") {
			return { ...state, fundAmount: state.fundAmount.slice(0, -1) }
		}
		// Only accept digits and dot
		if (/^[0-9.]$/.test(key)) {
			return { ...state, fundAmount: state.fundAmount + key }
		}
		return state
	}

	// Detail mode
	if (state.viewMode === "detail") {
		if (key === "escape") {
			return { ...state, viewMode: "list" }
		}
		if (key === "f" && state.accounts.length > 0) {
			return { ...state, viewMode: "fundPrompt", inputActive: true, fundAmount: "", fundConfirmed: false }
		}
		if (key === "i" && state.accounts.length > 0) {
			return { ...state, impersonateRequested: true }
		}
		return state
	}

	// List mode
	switch (key) {
		case "j": {
			const maxIndex = Math.max(0, state.accounts.length - 1)
			return {
				...state,
				selectedIndex: Math.min(state.selectedIndex + 1, maxIndex),
				fundConfirmed: false,
				impersonateRequested: false,
			}
		}
		case "k":
			return {
				...state,
				selectedIndex: Math.max(0, state.selectedIndex - 1),
				fundConfirmed: false,
				impersonateRequested: false,
			}
		case "return":
			if (state.accounts.length === 0) return state
			return { ...state, viewMode: "detail", fundConfirmed: false, impersonateRequested: false }
		case "f":
			if (state.accounts.length === 0) return state
			return {
				...state,
				viewMode: "fundPrompt",
				inputActive: true,
				fundAmount: "",
				fundConfirmed: false,
				impersonateRequested: false,
			}
		case "i":
			if (state.accounts.length === 0) return { ...state, impersonateRequested: false }
			return { ...state, impersonateRequested: true, fundConfirmed: false }
		case "escape":
			return state
		default:
			return state
	}
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createAccounts. */
export interface AccountsHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the view with new account data. */
	readonly update: (accounts: readonly AccountDetail[]) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => AccountsViewState
	/** Set the node reference (for fund/impersonate side effects). */
	readonly setNode: (node: unknown) => void
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
 * Create the Accounts view with scrollable table, detail pane, and fund prompt.
 *
 * Layout (list mode):
 * ```
 * ┌─ Accounts ──────────────────────────────────────────────────┐
 * │  Address          Balance          Nonce  Code  Type        │
 * │  0xf39F...2266    10,000.00 ETH    0      No    EOA         │
 * │  0x7099...79C8    10,000.00 ETH    0      No    EOA         │
 * │ ...                                                          │
 * └──────────────────────────────────────────────────────────────┘
 * ```
 */
export const createAccounts = (renderer: CliRenderer): AccountsHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: AccountsViewState = { ...initialAccountsState }

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
		content: " Accounts ",
		fg: DRACULA.cyan,
	})
	listBox.add(listTitle)

	// Header row
	const headerLine = new Text(renderer, {
		content: " Address            Balance              Nonce    Code   Type",
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

	// Fund prompt / status line at bottom
	const statusLine = new Text(renderer, {
		content: "",
		fg: DRACULA.yellow,
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
		content: " Account Detail ",
		fg: DRACULA.purple,
	})
	detailBox.add(detailTitle)

	const DETAIL_LINES = 15
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
	let currentMode: AccountsViewMode = "list"

	// -------------------------------------------------------------------------
	// Render functions
	// -------------------------------------------------------------------------

	const renderList = (): void => {
		const accounts = viewState.accounts
		const scrollOffset = Math.max(0, viewState.selectedIndex - VISIBLE_ROWS + 1)

		for (let i = 0; i < VISIBLE_ROWS; i++) {
			const accountIndex = i + scrollOffset
			const account = accounts[accountIndex]
			const rowLine = rowLines[i]
			const rowBg = rowBgs[i]
			if (!rowLine || !rowBg) continue

			if (!account) {
				rowLine.content = ""
				rowLine.fg = DRACULA.comment
				rowBg.backgroundColor = DRACULA.background
				continue
			}

			const isSelected = accountIndex === viewState.selectedIndex
			const acctType = formatAccountType(account.isContract)
			const impersonated = viewState.impersonatedAddresses.has(account.address)

			const line = ` ${truncateAddress(account.address).padEnd(18)} ${formatBalance(account.balance).padEnd(20)} ${formatNonce(account.nonce).padEnd(8)} ${formatCodeIndicator(account.code).padEnd(6)} ${acctType.text}${impersonated ? " 👤" : ""}`

			rowLine.content = line
			rowLine.fg = isSelected ? DRACULA.foreground : DRACULA.comment
			rowBg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
		}

		// Status line
		if (viewState.viewMode === "fundPrompt" && viewState.inputActive) {
			statusLine.content = `Fund amount (ETH): ${viewState.fundAmount}_`
			statusLine.fg = DRACULA.yellow
		} else {
			statusLine.content = " [f] Fund  [i] Impersonate  [Enter] Detail  [j/k] Navigate"
			statusLine.fg = DRACULA.comment
		}

		// Title with count
		listTitle.content = ` Accounts (${accounts.length}) `
	}

	const renderDetail = (): void => {
		const account = viewState.accounts[viewState.selectedIndex]
		if (!account) return

		const acctType = formatAccountType(account.isContract)
		const impersonated = viewState.impersonatedAddresses.has(account.address)

		const setLine = (index: number, content: string, fg: string = DRACULA.foreground): void => {
			const line = detailLines[index]
			if (!line) return
			line.content = content
			line.fg = fg
		}

		setLine(0, `Account — ${acctType.text}${impersonated ? " (Impersonated 👤)" : ""}`, acctType.color)
		setLine(1, "")
		setLine(2, `Address:   ${account.address}`, SEMANTIC.address)
		setLine(3, `Balance:   ${formatBalance(account.balance)}`, SEMANTIC.value)
		setLine(4, `Nonce:     ${formatNonce(account.nonce)}`, DRACULA.purple)
		setLine(5, `Has Code:  ${formatCodeIndicator(account.code)}`, DRACULA.foreground)
		setLine(6, `Type:      ${acctType.text}`, acctType.color)
		setLine(7, "")
		if (account.isContract && account.code.length > 0) {
			setLine(8, `Code Size: ${account.code.length} bytes`, DRACULA.orange)
		} else {
			setLine(8, "")
		}
		setLine(9, "")
		setLine(10, " [f] Fund  [i] Impersonate  [Esc] Back", DRACULA.comment)
		// Clear remaining lines
		for (let i = 11; i < DETAIL_LINES; i++) {
			setLine(i, "")
		}

		detailTitle.content = " Account Detail (Esc to go back) "
	}

	const render = (): void => {
		// Switch containers if mode changed
		const targetMode = viewState.viewMode === "fundPrompt" ? "list" : viewState.viewMode
		if (targetMode !== currentMode) {
			if (targetMode === "detail") {
				container.remove(listBox.id)
				container.add(detailBox)
			} else {
				container.remove(detailBox.id)
				container.add(listBox)
			}
			currentMode = targetMode
		}

		if (targetMode === "list") {
			renderList()
		} else {
			renderDetail()
		}
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	const handleKey = (key: string): void => {
		viewState = accountsReduce(viewState, key)

		// Clamp selectedIndex
		if (viewState.accounts.length > 0 && viewState.selectedIndex >= viewState.accounts.length) {
			viewState = { ...viewState, selectedIndex: viewState.accounts.length - 1 }
		}

		// Clear action signals after consumption (signals are one-shot)
		if (viewState.fundConfirmed) {
			viewState = { ...viewState, fundConfirmed: false }
		}
		if (viewState.impersonateRequested) {
			const addr = viewState.accounts[viewState.selectedIndex]?.address
			if (addr) {
				const newSet = new Set(viewState.impersonatedAddresses)
				if (newSet.has(addr)) {
					newSet.delete(addr)
				} else {
					newSet.add(addr)
				}
				viewState = { ...viewState, impersonatedAddresses: newSet, impersonateRequested: false }
			} else {
				viewState = { ...viewState, impersonateRequested: false }
			}
		}

		render()
	}

	const update = (accounts: readonly AccountDetail[]): void => {
		viewState = { ...viewState, accounts, selectedIndex: 0 }
		render()
	}

	const getState = (): AccountsViewState => viewState

	// setNode is a no-op — fund/impersonate side effects are handled in App.ts
	// at the application edge via Effect.runPromise.
	const setNode = (_node: unknown): void => {}

	// Initial render
	render()

	return { container, handleKey, update, getState, setNode }
}
