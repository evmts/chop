/**
 * Settings view component — form-style key-value layout of node settings.
 *
 * Sections:
 * - Node Configuration: Chain ID, Hardfork
 * - Mining: Mining Mode (editable toggle), Block Time
 * - Gas: Block Gas Limit (editable), Base Fee, Min Gas Price
 * - Fork: Fork URL, Fork Block
 *
 * Uses @opentui/core construct API (no JSX). Exposes a pure
 * `settingsReduce()` function for unit testing.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import type { SettingsViewData } from "./settings-data.js"
import {
	formatBlockTime,
	formatChainId,
	formatForkBlock,
	formatForkUrl,
	formatGasLimitValue,
	formatHardfork,
	formatMiningMode,
	formatWei,
} from "./settings-format.js"

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

/** A field in the settings form. */
export interface SettingsFieldDef {
	/** Field identifier key. */
	readonly key: string
	/** Display label. */
	readonly label: string
	/** Section this field belongs to. */
	readonly section: string
	/** Whether this field is editable. */
	readonly editable: boolean
}

/** All settings fields in display order. */
export const SETTINGS_FIELDS: readonly SettingsFieldDef[] = [
	{ key: "chainId", label: "Chain ID", section: "Node Configuration", editable: false },
	{ key: "hardfork", label: "Hardfork", section: "Node Configuration", editable: false },
	{ key: "miningMode", label: "Mining Mode", section: "Mining", editable: true },
	{ key: "blockTime", label: "Block Time", section: "Mining", editable: false },
	{ key: "blockGasLimit", label: "Block Gas Limit", section: "Gas", editable: true },
	{ key: "baseFee", label: "Base Fee", section: "Gas", editable: false },
	{ key: "minGasPrice", label: "Min Gas Price", section: "Gas", editable: false },
	{ key: "forkUrl", label: "Fork URL", section: "Fork", editable: false },
	{ key: "forkBlock", label: "Fork Block", section: "Fork", editable: false },
] as const

// ---------------------------------------------------------------------------
// View state (pure, testable)
// ---------------------------------------------------------------------------

/** Internal state for the settings view. */
export interface SettingsViewState {
	/** Index of the currently selected field. */
	readonly selectedIndex: number
	/** Whether text input is active (for gas limit editing). */
	readonly inputActive: boolean
	/** Current gas limit input string. */
	readonly gasLimitInput: string
	/** Signal: mining mode was toggled (consumed by App.ts). */
	readonly miningModeToggled: boolean
	/** Signal: gas limit was confirmed (consumed by App.ts). */
	readonly gasLimitConfirmed: boolean
	/** Current settings data (null = not yet loaded). */
	readonly data: SettingsViewData | null
}

/** Default initial state. */
export const initialSettingsState: SettingsViewState = {
	selectedIndex: 0,
	inputActive: false,
	gasLimitInput: "",
	miningModeToggled: false,
	gasLimitConfirmed: false,
	data: null,
}

// ---------------------------------------------------------------------------
// Pure reducer (testable without OpenTUI)
// ---------------------------------------------------------------------------

/**
 * Pure reducer for settings view state.
 *
 * Normal mode:
 * - j/k: move selection down/up
 * - return/space on miningMode: set miningModeToggled signal
 * - return on blockGasLimit: enter input mode
 *
 * Input mode (gas limit editing):
 * - 0-9: append digit
 * - backspace: remove last digit
 * - return: confirm (set gasLimitConfirmed if non-empty)
 * - escape: cancel
 */
export const settingsReduce = (state: SettingsViewState, key: string): SettingsViewState => {
	// Input mode: gas limit text entry
	if (state.inputActive) {
		switch (key) {
			case "return":
				if (state.gasLimitInput === "") {
					// Empty input → cancel
					return { ...state, inputActive: false }
				}
				return { ...state, inputActive: false, gasLimitConfirmed: true }
			case "escape":
				return { ...state, inputActive: false, gasLimitInput: "", gasLimitConfirmed: false }
			case "backspace":
				return { ...state, gasLimitInput: state.gasLimitInput.slice(0, -1) }
			default: {
				// Only accept digit keys
				if (/^[0-9]$/.test(key)) {
					return { ...state, gasLimitInput: state.gasLimitInput + key }
				}
				return state
			}
		}
	}

	// Normal mode
	switch (key) {
		case "j": {
			const maxIndex = SETTINGS_FIELDS.length - 1
			return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, maxIndex) }
		}
		case "k":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) }
		case "return":
		case "space": {
			const field = SETTINGS_FIELDS[state.selectedIndex]
			if (!field?.editable) return state

			if (field.key === "miningMode") {
				return { ...state, miningModeToggled: true }
			}
			if (field.key === "blockGasLimit") {
				return { ...state, inputActive: true, gasLimitInput: "" }
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

/** Handle returned by createSettings. */
export interface SettingsHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Process a view key event. */
	readonly handleKey: (key: string) => void
	/** Update the view with new settings data. */
	readonly update: (data: SettingsViewData) => void
	/** Get current view state (for testing/inspection). */
	readonly getState: () => SettingsViewState
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the Settings view with form-style key-value layout.
 *
 * Layout:
 * ```
 * ┌─ Settings ──────────────────────────────────────────────┐
 * │  Node Configuration                                      │
 * │    Chain ID         31337 (0x7a69)                       │
 * │    Hardfork         Prague                               │
 * │                                                          │
 * │  Mining                                                  │
 * │  > Mining Mode      Auto         [Space/Enter to cycle]  │
 * │    Block Time       Auto (mine on tx)                    │
 * │                                                          │
 * │  Gas                                                     │
 * │  > Block Gas Limit  30,000,000   [Enter to edit]        │
 * │    Base Fee         1.00 gwei                            │
 * │    Min Gas Price    0 ETH                                │
 * │                                                          │
 * │  Fork                                                    │
 * │    Fork URL         N/A (local mode)                     │
 * │    Fork Block       N/A (local mode)                     │
 * └──────────────────────────────────────────────────────────┘
 * ```
 */
export const createSettings = (renderer: CliRenderer): SettingsHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let viewState: SettingsViewState = { ...initialSettingsState }

	// -------------------------------------------------------------------------
	// Components
	// -------------------------------------------------------------------------

	const settingsBox = new Box(renderer, {
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
	const title = new Text(renderer, {
		content: " Settings ",
		fg: DRACULA.cyan,
	})
	settingsBox.add(title)

	// Pre-allocate lines for sections + fields + spacing
	// We need:
	// - Section headers (4): Node Configuration, Mining, Gas, Fork
	// - Fields (9): one per SETTINGS_FIELDS entry
	// - Blank separator lines (3): between sections
	// - Status line (1)
	// Total = ~20 lines
	const TOTAL_LINES = 22
	const lines: TextRenderable[] = []
	const lineBgs: BoxRenderable[] = []

	for (let i = 0; i < TOTAL_LINES; i++) {
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
		settingsBox.add(rowBox)
		lineBgs.push(rowBox)
		lines.push(rowText)
	}

	// Container
	const container = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})
	container.add(settingsBox)

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	/** Get the formatted value for a field. */
	const getFieldValue = (key: string, data: SettingsViewData): string => {
		switch (key) {
			case "chainId":
				return formatChainId(data.chainId)
			case "hardfork":
				return formatHardfork(data.hardfork)
			case "miningMode":
				return formatMiningMode(data.miningMode).text
			case "blockTime":
				return formatBlockTime(data.miningInterval)
			case "blockGasLimit":
				return formatGasLimitValue(data.blockGasLimit)
			case "baseFee":
				return formatWei(data.baseFee)
			case "minGasPrice":
				return formatWei(data.minGasPrice)
			case "forkUrl":
				return formatForkUrl(data.forkUrl)
			case "forkBlock":
				return formatForkBlock(data.forkBlock)
			default:
				return ""
		}
	}

	/** Get the color for a field value. */
	const getFieldColor = (key: string, data: SettingsViewData): string => {
		switch (key) {
			case "miningMode":
				return formatMiningMode(data.miningMode).color
			case "chainId":
				return DRACULA.purple
			case "baseFee":
			case "minGasPrice":
				return SEMANTIC.value
			case "blockGasLimit":
				return DRACULA.orange
			default:
				return DRACULA.foreground
		}
	}

	const render = (): void => {
		const data = viewState.data

		// Clear all lines
		for (let i = 0; i < TOTAL_LINES; i++) {
			const line = lines[i]
			const bg = lineBgs[i]
			if (line) {
				line.content = ""
				line.fg = DRACULA.comment
			}
			if (bg) bg.backgroundColor = DRACULA.background
		}

		if (!data) {
			const line = lines[0]
			if (line) {
				line.content = "  Loading settings..."
				line.fg = DRACULA.comment
			}
			return
		}

		let lineIdx = 0
		let fieldIdx = 0
		let lastSection = ""

		for (const field of SETTINGS_FIELDS) {
			// Section header
			if (field.section !== lastSection) {
				if (lastSection !== "") {
					lineIdx++ // blank line between sections
				}
				const sectionLine = lines[lineIdx]
				if (sectionLine) {
					sectionLine.content = `  ${field.section}`
					sectionLine.fg = DRACULA.cyan
				}
				lineIdx++
				lastSection = field.section
			}

			const isSelected = fieldIdx === viewState.selectedIndex
			const line = lines[lineIdx]
			const bg = lineBgs[lineIdx]

			if (line && bg) {
				const prefix = field.editable ? (isSelected ? " > " : "   ") : "   "
				const label = field.label.padEnd(18)

				// Gas limit in input mode
				if (field.key === "blockGasLimit" && viewState.inputActive && isSelected) {
					const cursor = viewState.gasLimitInput + "_"
					line.content = `${prefix}${label} ${cursor}`
					line.fg = DRACULA.foreground
				} else {
					const value = getFieldValue(field.key, data)
					const hint =
						field.editable && isSelected ? (field.key === "miningMode" ? "  [Space/Enter]" : "  [Enter to edit]") : ""
					line.content = `${prefix}${label} ${value}${hint}`
					line.fg = isSelected ? getFieldColor(field.key, data) : DRACULA.comment
				}

				bg.backgroundColor = isSelected ? DRACULA.currentLine : DRACULA.background
			}

			lineIdx++
			fieldIdx++
		}

		// Status line at bottom
		const statusIdx = TOTAL_LINES - 1
		const statusLine = lines[statusIdx]
		if (statusLine) {
			if (viewState.inputActive) {
				statusLine.content = " Type gas limit, [Enter] Confirm  [Esc] Cancel"
			} else {
				statusLine.content = " [j/k] Navigate  [Space/Enter] Edit  [?] Help"
			}
			statusLine.fg = DRACULA.comment
		}
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	const handleKey = (key: string): void => {
		viewState = settingsReduce(viewState, key)
		render()
	}

	const update = (data: SettingsViewData): void => {
		viewState = { ...viewState, data, miningModeToggled: false, gasLimitConfirmed: false }
		render()
	}

	const getState = (): SettingsViewState => viewState

	// Initial render
	render()

	return { container, handleKey, update, getState }
}
