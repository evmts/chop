/**
 * Root TUI application — composes TabBar, StatusBar, HelpOverlay, and content area.
 *
 * Uses @opentui/core construct API. Manages state via the pure reducer
 * from `./state.ts`. Keyboard events are mapped to actions via `keyToAction`.
 *
 * When a TevmNodeShape is provided, the Dashboard view (tab 0) shows live
 * chain data that auto-updates after state changes.
 * The Call History view (tab 1) shows a scrollable table of past EVM calls.
 * The Accounts view (tab 3) shows devnet accounts with fund/impersonate.
 * The Blocks view (tab 4) shows blockchain blocks with mine via m.
 */

import { Effect } from "effect"
import type { CliRenderer } from "@opentui/core"
import type { TevmNodeShape } from "../node/index.js"
import { createHelpOverlay } from "./components/HelpOverlay.js"
import { createStatusBar } from "./components/StatusBar.js"
import { createTabBar } from "./components/TabBar.js"
import { getOpenTui } from "./opentui.js"
import { type TuiState, initialState, keyToAction, reduce } from "./state.js"
import { TABS } from "./tabs.js"
import { DRACULA } from "./theme.js"
import { createAccounts } from "./views/Accounts.js"
import { createBlocks } from "./views/Blocks.js"
import { createCallHistory } from "./views/CallHistory.js"
import { createDashboard } from "./views/Dashboard.js"
import { getAccountDetails, fundAccount, impersonateAccount } from "./views/accounts-data.js"
import { getBlocksData, mineBlock } from "./views/blocks-data.js"
import { getCallHistory } from "./views/call-history-data.js"
import { getDashboardData } from "./views/dashboard-data.js"

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
 * - Content area (middle, flex-grow) — Dashboard on tab 0, placeholders for others
 * - Status bar (bottom)
 * - Help overlay (absolute, toggled with ?)
 * - Keyboard handler (1-8 tabs, q quit, ? help)
 *
 * @param renderer - An initialized OpenTUI CliRenderer
 * @param node - Optional TevmNodeShape for live dashboard data
 * @returns AppHandle with `waitForQuit` promise
 */
export const createApp = (renderer: CliRenderer, node?: TevmNodeShape): AppHandle => {
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
	const dashboard = createDashboard(renderer)
	const callHistory = createCallHistory(renderer)
	const accounts = createAccounts(renderer)
	const blocks = createBlocks(renderer)

	// Pass node reference to accounts view for fund/impersonate side effects
	if (node) accounts.setNode(node)

	// Content area — holds Dashboard or placeholder per tab
	const contentArea = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})

	// Placeholder text for non-dashboard tabs
	const placeholderBox = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
		justifyContent: "center",
		alignItems: "center",
	})
	const placeholderText = new Text(renderer, {
		content: `[ ${TABS[0]?.name} ]`,
		fg: DRACULA.comment,
	})
	placeholderBox.add(placeholderText)

	// Start with Dashboard visible
	contentArea.add(dashboard.container)

	// -------------------------------------------------------------------------
	// View switching
	// -------------------------------------------------------------------------

	let currentView: "dashboard" | "callHistory" | "accounts" | "blocks" | "placeholder" = "dashboard"

	/** Remove whatever is currently in the content area. */
	const removeCurrentView = (): void => {
		switch (currentView) {
			case "dashboard":
				contentArea.remove(dashboard.container.id)
				break
			case "callHistory":
				contentArea.remove(callHistory.container.id)
				break
			case "accounts":
				contentArea.remove(accounts.container.id)
				break
			case "blocks":
				contentArea.remove(blocks.container.id)
				break
			case "placeholder":
				contentArea.remove(placeholderBox.id)
				break
		}
	}

	const switchToView = (tab: number): void => {
		if (tab === 0 && currentView !== "dashboard") {
			removeCurrentView()
			contentArea.add(dashboard.container)
			currentView = "dashboard"
		} else if (tab === 1 && currentView !== "callHistory") {
			removeCurrentView()
			contentArea.add(callHistory.container)
			currentView = "callHistory"
		} else if (tab === 3 && currentView !== "accounts") {
			removeCurrentView()
			contentArea.add(accounts.container)
			currentView = "accounts"
		} else if (tab === 4 && currentView !== "blocks") {
			removeCurrentView()
			contentArea.add(blocks.container)
			currentView = "blocks"
		} else if (tab !== 0 && tab !== 1 && tab !== 3 && tab !== 4 && currentView !== "placeholder") {
			removeCurrentView()
			contentArea.add(placeholderBox)
			currentView = "placeholder"
		}

		if (tab !== 0 && tab !== 1 && tab !== 3 && tab !== 4) {
			const tabDef = TABS[tab]
			if (tabDef) {
				placeholderText.content = `[ ${tabDef.name} ]`
			}
		}
	}

	// -------------------------------------------------------------------------
	// Dashboard refresh
	// -------------------------------------------------------------------------

	const refreshDashboard = (): void => {
		if (!node || state.activeTab !== 0) return
		// Effect.runPromise at the application edge — acceptable per project rules
		Effect.runPromise(getDashboardData(node)).then(
			(data) => dashboard.update(data),
			(err) => { console.error("[chop] dashboard refresh failed:", err) },
		)
	}

	const refreshCallHistory = (): void => {
		if (!node || state.activeTab !== 1) return
		// Effect.runPromise at the application edge — acceptable per project rules
		Effect.runPromise(getCallHistory(node)).then(
			(records) => callHistory.update(records),
			(err) => { console.error("[chop] call history refresh failed:", err) },
		)
	}

	const refreshAccounts = (): void => {
		if (!node || state.activeTab !== 3) return
		// Effect.runPromise at the application edge — acceptable per project rules
		Effect.runPromise(getAccountDetails(node)).then(
			(data) => accounts.update(data.accounts),
			(err) => { console.error("[chop] accounts refresh failed:", err) },
		)
	}

	const refreshBlocks = (): void => {
		if (!node || state.activeTab !== 4) return
		// Effect.runPromise at the application edge — acceptable per project rules
		Effect.runPromise(getBlocksData(node)).then(
			(data) => blocks.update(data.blocks),
			(err) => { console.error("[chop] blocks refresh failed:", err) },
		)
	}

	// Initial dashboard data load
	refreshDashboard()

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

		// Check if active view is in input mode (e.g. filter text entry, fund prompt)
		const isInputMode =
			(state.activeTab === 1 && callHistory.getState().filterActive) ||
			(state.activeTab === 3 && accounts.getState().inputActive)
		const action = keyToAction(keyName, isInputMode)
		if (!action) return

		if (action._tag === "Quit") {
			quitResolve()
			return
		}

		// Forward ViewKey to active view's handler
		if (action._tag === "ViewKey") {
			if (state.activeTab === 1) {
				callHistory.handleKey(action.key)
			} else if (state.activeTab === 3) {
				// Check for fund/impersonate signals before handling key
				const prevState = accounts.getState()
				accounts.handleKey(action.key)
				const nextState = accounts.getState()

				// Handle fund side effect — triggered when fundConfirmed was set then cleared
				if (prevState.viewMode === "fundPrompt" && prevState.inputActive && action.key === "return" && prevState.fundAmount !== "") {
					const addr = prevState.accounts[prevState.selectedIndex]?.address
					if (addr && node) {
						const ethAmount = Number.parseFloat(prevState.fundAmount)
						if (!Number.isNaN(ethAmount) && ethAmount > 0) {
							const weiAmount = BigInt(Math.floor(ethAmount * 1e18))
							Effect.runPromise(fundAccount(node, addr, weiAmount)).then(
								() => refreshAccounts(),
								(err) => { console.error("[chop] fund failed:", err) },
							)
						}
					}
				}

				// Handle impersonate side effect
				if (nextState.impersonatedAddresses.size !== prevState.impersonatedAddresses.size && node) {
					const addr = prevState.accounts[prevState.selectedIndex]?.address
					if (addr) {
						Effect.runPromise(impersonateAccount(node, addr)).then(
							() => {},
							(err) => { console.error("[chop] impersonate failed:", err) },
						)
					}
				}
			} else if (state.activeTab === 4) {
				blocks.handleKey(action.key)

				// Handle mine side effect — m key triggers mine
				if (action.key === "m" && node) {
					Effect.runPromise(mineBlock(node)).then(
						() => { refreshBlocks(); refreshDashboard() },
						(err) => { console.error("[chop] mine block failed:", err) },
					)
				}
			}
			return
		}

		state = reduce(state, action)
		tabBar.update(state.activeTab)
		helpOverlay.setVisible(state.helpVisible)

		// Switch view based on active tab
		switchToView(state.activeTab)

		// Refresh active view data
		refreshDashboard()
		refreshCallHistory()
		refreshAccounts()
		refreshBlocks()
	})

	// -------------------------------------------------------------------------
	// Start rendering
	// -------------------------------------------------------------------------

	renderer.auto()

	return { waitForQuit: promise }
}
