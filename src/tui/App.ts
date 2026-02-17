/**
 * Root TUI application — composes TabBar, StatusBar, HelpOverlay, and content area.
 *
 * Uses @opentui/core construct API. Manages state via the pure reducer
 * from `./state.ts`. Keyboard events are mapped to actions via `keyToAction`.
 */

import type { CliRenderer } from "@opentui/core"
import { createHelpOverlay } from "./components/HelpOverlay.js"
import { createStatusBar } from "./components/StatusBar.js"
import { createTabBar } from "./components/TabBar.js"
import { getOpenTui } from "./opentui.js"
import { type TuiState, initialState, keyToAction, reduce } from "./state.js"
import { TABS } from "./tabs.js"
import { DRACULA } from "./theme.js"

/** Handle returned by createApp. */
export interface AppHandle {
	/** Promise that resolves when the user quits (press `q`). */
	readonly waitForQuit: Promise<void>
}

/**
 * Create and compose the full TUI application.
 *
 * Sets up:
 * - Tab bar (top)
 * - Content area (middle, flex-grow)
 * - Status bar (bottom)
 * - Help overlay (absolute, toggled with ?)
 * - Keyboard handler (1-8 tabs, q quit, ? help)
 *
 * @param renderer - An initialized OpenTUI CliRenderer
 * @returns AppHandle with `waitForQuit` promise
 */
export const createApp = (renderer: CliRenderer): AppHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let state: TuiState = initialState

	// -------------------------------------------------------------------------
	// Components
	// -------------------------------------------------------------------------

	const tabBar = createTabBar(renderer)
	const statusBar = createStatusBar(renderer)
	const helpOverlay = createHelpOverlay(renderer)

	// Content area — placeholder per tab
	const contentArea = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
		justifyContent: "center",
		alignItems: "center",
	})

	const contentText = new Text(renderer, {
		content: `[ ${TABS[0]?.name} ]`,
		fg: DRACULA.comment,
	})
	contentArea.add(contentText)

	// -------------------------------------------------------------------------
	// Layout composition
	// -------------------------------------------------------------------------

	// Root container: column layout [tabBar, content, statusBar]
	const rootContainer = new Box(renderer, {
		width: "100%",
		height: "100%",
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})

	rootContainer.add(tabBar.container)
	rootContainer.add(contentArea)
	rootContainer.add(statusBar.container)

	renderer.root.add(rootContainer)
	renderer.root.add(helpOverlay.container)

	// -------------------------------------------------------------------------
	// Keyboard handling
	// -------------------------------------------------------------------------

	let quitResolve: () => void
	const promise = new Promise<void>((resolve) => {
		quitResolve = resolve
	})

	// KeyHandler extends EventEmitter<KeyHandlerEventMap> — runtime check guards
	// against unexpected renderer.keyInput shapes before subscribing.
	const keyInput: unknown = renderer.keyInput
	if (!keyInput || typeof (keyInput as { on?: unknown }).on !== "function") {
		throw new Error("renderer.keyInput does not expose an .on() method")
	}
	const emitter = keyInput as { on: (event: "keypress", cb: (key: { name: string; sequence: string }) => void) => void }
	emitter.on("keypress", (key) => {
		const keyName = key.name ?? key.sequence
		const action = keyToAction(keyName)
		if (!action) return

		if (action._tag === "Quit") {
			quitResolve()
			return
		}

		state = reduce(state, action)
		tabBar.update(state.activeTab)
		helpOverlay.setVisible(state.helpVisible)

		// Update content placeholder
		const tab = TABS[state.activeTab]
		if (tab) {
			contentText.content = `[ ${tab.name} ]`
		}
	})

	// -------------------------------------------------------------------------
	// Start rendering
	// -------------------------------------------------------------------------

	renderer.auto()

	return { waitForQuit: promise }
}
