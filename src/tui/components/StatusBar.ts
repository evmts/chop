/**
 * Status bar component — bottom bar with chain info.
 *
 * Shows static placeholder content for T4.1.
 * Future tasks will make it dynamic (chain ID, block number, gas price, etc.).
 */

import type { BoxRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA } from "../theme.js"

/** Handle returned by createStatusBar. */
export interface StatusBarHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
}

/**
 * Create a status bar with placeholder chain info.
 *
 * Layout: single row at bottom with chain info and help hint.
 *
 * @param renderer - The OpenTUI render context (CliRenderer)
 * @returns A handle with `container` for composition.
 */
export const createStatusBar = (renderer: import("@opentui/core").CliRenderer): StatusBarHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	const container = new Box(renderer, {
		width: "100%",
		height: 1,
		flexDirection: "row",
		backgroundColor: DRACULA.currentLine,
	})

	const statusText = new Text(renderer, {
		content: " \u26D3 31337 \u2502 \u25AA #0 \u2502 \u26FD 0 gwei \u2502 0 accounts \u2502 local \u2502 ?=help ",
		fg: DRACULA.foreground,
		bg: DRACULA.currentLine,
		truncate: true,
		flexGrow: 1,
	})

	container.add(statusText)

	return { container }
}
