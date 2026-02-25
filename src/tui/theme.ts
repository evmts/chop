/**
 * Dracula theme color palette for the TUI.
 *
 * Matches the canonical Dracula specification (https://draculatheme.com/contribute)
 * and the Zig `styles.zig` palette from the design doc.
 */

/** Raw Dracula palette — 11 canonical colors. */
export const DRACULA = {
	background: "#282A36",
	currentLine: "#44475A",
	foreground: "#F8F8F2",
	comment: "#6272A4",
	cyan: "#8BE9FD",
	green: "#50FA7B",
	orange: "#FFB86C",
	pink: "#FF79C6",
	purple: "#BD93F9",
	red: "#FF5555",
	yellow: "#F1FA8C",
} as const

/** Semantic color aliases — map UI intent to Dracula colors. */
export const SEMANTIC = {
	primary: DRACULA.cyan,
	secondary: DRACULA.purple,
	success: DRACULA.green,
	error: DRACULA.red,
	warning: DRACULA.orange,
	muted: DRACULA.comment,
	text: DRACULA.foreground,
	bg: DRACULA.background,
	bgHighlight: DRACULA.currentLine,
	address: DRACULA.cyan,
	hash: DRACULA.yellow,
	value: DRACULA.green,
	gas: DRACULA.orange,
} as const
