/**
 * Pure TUI state management — reducer + key-to-action mapping.
 *
 * Extracted from the TUI render loop for testability.
 * No OpenTUI dependency — runs in any JS runtime.
 */

import { TAB_COUNT } from "./tabs.js"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Immutable TUI state. */
export interface TuiState {
	/** Index of the active tab (0..7). */
	readonly activeTab: number
	/** Whether the help overlay is visible. */
	readonly helpVisible: boolean
}

/** Default state — Dashboard tab, help hidden. */
export const initialState: TuiState = { activeTab: 0, helpVisible: false }

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Discriminated union of all TUI actions. */
export type TuiAction =
	| { readonly _tag: "SetTab"; readonly tab: number }
	| { readonly _tag: "ToggleHelp" }
	| { readonly _tag: "Quit" }
	| { readonly _tag: "ViewKey"; readonly key: string }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure state reducer.
 *
 * Returns a new state for the given action.
 * `Quit` is a signal — it returns state unchanged (the caller handles exit).
 * `ViewKey` is a pass-through — the App dispatches it to the active view.
 */
export const reduce = (state: TuiState, action: TuiAction): TuiState => {
	switch (action._tag) {
		case "SetTab":
			return { ...state, activeTab: action.tab }
		case "ToggleHelp":
			return { ...state, helpVisible: !state.helpVisible }
		case "Quit":
			return state
		case "ViewKey":
			return state
	}
}

// ---------------------------------------------------------------------------
// Key Mapping
// ---------------------------------------------------------------------------

/** Keys that map to ViewKey actions (dispatched to the active view). */
const VIEW_KEYS = new Set(["j", "k", "return", "escape", "/"])

/**
 * Maps a key name (from keyboard event) to a TuiAction, or `null` if unmapped.
 *
 * - "1".."8"          → SetTab(0..7)
 * - "?"               → ToggleHelp
 * - "q"               → Quit
 * - "j","k","return","escape","/" → ViewKey (dispatched to active view)
 */
export const keyToAction = (keyName: string): TuiAction | null => {
	if (keyName === "?") return { _tag: "ToggleHelp" }
	if (keyName === "q") return { _tag: "Quit" }

	// View-specific keys (navigation, detail, filter)
	if (VIEW_KEYS.has(keyName)) {
		return { _tag: "ViewKey", key: keyName }
	}

	// Tab switching via number keys 1-8
	const num = Number(keyName)
	if (Number.isInteger(num) && num >= 1 && num <= TAB_COUNT) {
		return { _tag: "SetTab", tab: num - 1 }
	}

	return null
}
