/**
 * Help overlay component — modal showing keyboard shortcuts.
 *
 * Absolutely positioned, centered, with semi-transparent background.
 * Toggle visibility via `setVisible()`.
 */

import type { BoxRenderable } from "@opentui/core"
import { DRACULA } from "../theme.js"

/** Handle returned by createHelpOverlay. */
export interface HelpOverlayHandle {
	/** Show or hide the overlay. */
	readonly setVisible: (visible: boolean) => void
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
}

const HELP_TEXT = [
	"Keyboard Shortcuts",
	"",
	"  1-8    Switch tabs",
	"  ?      Toggle this help",
	"  q      Quit",
	"  Ctrl+C Quit",
	"",
	"Navigation",
	"",
	"  j/\u2193    Move down",
	"  k/\u2191    Move up",
	"  h/\u2190    Move left / collapse",
	"  l/\u2192    Move right / expand",
	"  Enter  Select / expand",
	"  Esc    Back / close",
	"  /      Search / filter",
	"",
	"Actions (context-dependent)",
	"",
	"  m      Mine block",
	"  f      Fund account",
	"  i      Impersonate account",
	"  e      Edit value",
	"  d      Toggle detail view",
	"  x      Toggle hex/decimal",
	"  c      Copy to clipboard",
	"",
	"Press ? or Esc to close",
]

/**
 * Create a help overlay modal.
 *
 * @param renderer - The OpenTUI render context (CliRenderer)
 * @returns A handle with `setVisible()` and `container` for composition.
 */
export const createHelpOverlay = (renderer: import("@opentui/core").CliRenderer): HelpOverlayHandle => {
	const { BoxRenderable: Box, TextRenderable: Text } = require("@opentui/core") as typeof import("@opentui/core")

	// Full-screen semi-transparent backdrop
	const container = new Box(renderer, {
		position: "absolute",
		width: "100%",
		height: "100%",
		top: 0,
		left: 0,
		zIndex: 100,
		visible: false,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: DRACULA.background,
		opacity: 0.95,
	})

	// Centered help box
	const helpBox = new Box(renderer, {
		width: 50,
		height: HELP_TEXT.length + 4,
		flexDirection: "column",
		backgroundColor: DRACULA.currentLine,
		borderStyle: "rounded",
		border: true,
		borderColor: DRACULA.purple,
		padding: 1,
		title: " Help ",
		titleAlignment: "center",
	})

	for (const line of HELP_TEXT) {
		const text = new Text(renderer, {
			content: line,
			fg: line.startsWith("  ") ? DRACULA.foreground : DRACULA.cyan,
			truncate: true,
			height: 1,
		})
		helpBox.add(text)
	}

	container.add(helpBox)

	const setVisible = (visible: boolean): void => {
		container.visible = visible
	}

	return { setVisible, container }
}
