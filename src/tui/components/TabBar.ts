/**
 * Tab bar component — horizontal row of 8 tabs.
 *
 * Uses @opentui/core renderables. Active tab is highlighted
 * with Dracula `currentLine` background and `foreground` text.
 * Inactive tabs use `comment` color.
 */

import type { BoxRenderable, TextRenderable } from "@opentui/core"
import { TABS } from "../tabs.js"
import { DRACULA } from "../theme.js"

/** Handle returned by createTabBar for updating active tab. */
export interface TabBarHandle {
	/** Re-render tab bar to reflect a new active tab index. */
	readonly update: (activeTab: number) => void
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
}

/**
 * Create a tab bar with 8 tabs.
 *
 * @param renderer - The OpenTUI render context (CliRenderer)
 * @returns A handle with `update(activeTab)` and `container` for composition.
 */
export const createTabBar = (renderer: import("@opentui/core").CliRenderer): TabBarHandle => {
	// Lazy-require to avoid loading at import time in tests
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { BoxRenderable: Box, TextRenderable: Text } = require("@opentui/core") as typeof import("@opentui/core")

	const container = new Box(renderer, {
		width: "100%",
		height: 1,
		flexDirection: "row",
		backgroundColor: DRACULA.background,
	})

	const tabTexts: TextRenderable[] = []

	for (const tab of TABS) {
		const text = new Text(renderer, {
			content: ` ${tab.key}:${tab.shortName} `,
			fg: DRACULA.comment,
			truncate: true,
		})
		tabTexts.push(text)
		container.add(text)
	}

	const update = (activeTab: number): void => {
		for (let i = 0; i < tabTexts.length; i++) {
			const text = tabTexts[i]
			const tab = TABS[i]
			if (!text || !tab) continue
			if (i === activeTab) {
				text.fg = DRACULA.foreground
				text.bg = DRACULA.currentLine
				text.content = `▸${tab.key}:${tab.shortName} `
			} else {
				text.fg = DRACULA.comment
				text.bg = DRACULA.background
				text.content = ` ${tab.key}:${tab.shortName} `
			}
		}
	}

	// Set initial state
	update(0)

	return { update, container }
}
