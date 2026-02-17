/**
 * Dashboard view component — 2x2 grid showing chain info, recent blocks,
 * recent transactions, and account summaries.
 *
 * Uses @opentui/core construct API (no JSX). Pre-creates TextRenderable
 * instances for each line; `update()` mutates their `.content` property
 * for efficient re-rendering.
 */

import type { BoxRenderable, CliRenderer, TextRenderable } from "@opentui/core"
import { getOpenTui } from "../opentui.js"
import { DRACULA, SEMANTIC } from "../theme.js"
import type { DashboardData } from "./dashboard-data.js"
import { formatGas, formatTimestamp, formatWei, truncateAddress, truncateHash } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** Handle returned by createDashboard for updating displayed data. */
export interface DashboardHandle {
	/** The root box renderable (for layout composition). */
	readonly container: BoxRenderable
	/** Update all panels with fresh dashboard data. */
	readonly update: (data: DashboardData) => void
}

// ---------------------------------------------------------------------------
// Panel helper — creates a bordered box with a title
// ---------------------------------------------------------------------------

const createPanel = (
	renderer: CliRenderer,
	title: string,
	lineCount: number,
): { panel: BoxRenderable; lines: TextRenderable[] } => {
	const { BoxRenderable: Box, TextRenderable: Text } = getOpenTui()

	const panel = new Box(renderer, {
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
		content: ` ${title} `,
		fg: DRACULA.cyan,
	})
	panel.add(titleText)

	// Content lines
	const lines: TextRenderable[] = []
	for (let i = 0; i < lineCount; i++) {
		const line = new Text(renderer, {
			content: "",
			fg: DRACULA.foreground,
			truncate: true,
		})
		lines.push(line)
		panel.add(line)
	}

	return { panel, lines }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the Dashboard view with a 2x2 grid layout.
 *
 * Layout:
 * ```
 * ┌─ Chain Info ──────┐┌─ Recent Blocks ───┐
 * │ Chain ID: 31337   ││ #1  3s ago  0 txs  │
 * │ Block: 42         ││ #0  1m ago  0 txs  │
 * └───────────────────┘└────────────────────┘
 * ┌─ Recent Txs ──────┐┌─ Accounts ────────┐
 * │ 0xab..cd → 0x12.. ││ 0xf39F..2266 10K  │
 * └───────────────────┘└────────────────────┘
 * ```
 */
export const createDashboard = (renderer: CliRenderer): DashboardHandle => {
	const { BoxRenderable: Box } = getOpenTui()

	// -------------------------------------------------------------------------
	// Create panels
	// -------------------------------------------------------------------------

	const chainInfo = createPanel(renderer, "Chain Info", 6)
	const recentBlocks = createPanel(renderer, "Recent Blocks", 6) // header + 5 blocks
	const recentTxs = createPanel(renderer, "Recent Transactions", 11) // header + 10 txs
	const accounts = createPanel(renderer, "Accounts", 11) // header + 10 accounts

	// -------------------------------------------------------------------------
	// Layout: 2x2 grid
	// -------------------------------------------------------------------------

	const topRow = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "row",
		backgroundColor: DRACULA.background,
	})
	topRow.add(chainInfo.panel)
	topRow.add(recentBlocks.panel)

	const bottomRow = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "row",
		backgroundColor: DRACULA.background,
	})
	bottomRow.add(recentTxs.panel)
	bottomRow.add(accounts.panel)

	const container = new Box(renderer, {
		width: "100%",
		flexGrow: 1,
		flexDirection: "column",
		backgroundColor: DRACULA.background,
	})
	container.add(topRow)
	container.add(bottomRow)

	// -------------------------------------------------------------------------
	// Update function
	// -------------------------------------------------------------------------

	const update = (data: DashboardData): void => {
		// --- Chain Info panel ---
		const ci = data.chainInfo
		setLine(chainInfo.lines, 0, `Chain ID:  ${ci.chainId}`, DRACULA.comment, SEMANTIC.primary)
		setLine(chainInfo.lines, 1, `Block:     #${ci.blockNumber}`, DRACULA.comment, DRACULA.purple)
		setLine(chainInfo.lines, 2, `Gas Price: ${formatWei(ci.gasPrice)}`, DRACULA.comment, SEMANTIC.gas)
		setLine(chainInfo.lines, 3, `Base Fee:  ${formatWei(ci.baseFee)}`, DRACULA.comment, SEMANTIC.gas)
		setLine(chainInfo.lines, 4, `Client:    ${ci.clientVersion}`, DRACULA.comment, DRACULA.foreground)
		setLine(chainInfo.lines, 5, `Mining:    ${ci.miningMode}`, DRACULA.comment, DRACULA.green)

		// --- Recent Blocks panel ---
		setLine(recentBlocks.lines, 0, " Block    Time       Txs   Gas Used", DRACULA.comment, DRACULA.comment)
		for (let i = 0; i < 5; i++) {
			const block = data.recentBlocks[i]
			if (block) {
				const line = ` #${block.number.toString().padEnd(6)} ${formatTimestamp(block.timestamp).padEnd(10)} ${block.txCount.toString().padEnd(5)} ${formatGas(block.gasUsed)}`
				setLine(recentBlocks.lines, i + 1, line, DRACULA.foreground, DRACULA.foreground)
			} else {
				setLine(recentBlocks.lines, i + 1, "", DRACULA.comment, DRACULA.comment)
			}
		}

		// --- Recent Transactions panel ---
		setLine(recentTxs.lines, 0, " Hash          From          To            Value", DRACULA.comment, DRACULA.comment)
		for (let i = 0; i < 10; i++) {
			const tx = data.recentTxs[i]
			if (tx) {
				const to = tx.to ? truncateAddress(tx.to) : "CREATE"
				const line = ` ${truncateHash(tx.hash)}  ${truncateAddress(tx.from)}  ${to.padEnd(13)} ${formatWei(tx.value)}`
				setLine(recentTxs.lines, i + 1, line, DRACULA.foreground, DRACULA.foreground)
			} else {
				setLine(recentTxs.lines, i + 1, "", DRACULA.comment, DRACULA.comment)
			}
		}

		// --- Accounts panel ---
		setLine(accounts.lines, 0, " Address        Balance", DRACULA.comment, DRACULA.comment)
		for (let i = 0; i < 10; i++) {
			const acct = data.accounts[i]
			if (acct) {
				const line = ` ${truncateAddress(acct.address)}  ${formatWei(acct.balance)}`
				setLine(accounts.lines, i + 1, line, SEMANTIC.address, SEMANTIC.address)
			} else {
				setLine(accounts.lines, i + 1, "", DRACULA.comment, DRACULA.comment)
			}
		}
	}

	return { container, update }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely set a line's content and color. */
const setLine = (
	lines: TextRenderable[],
	index: number,
	content: string,
	fg: string,
	_valueFg: string,
): void => {
	const line = lines[index]
	if (!line) return
	line.content = content
	line.fg = fg
}
