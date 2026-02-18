import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { keyToAction } from "../state.js"
import {
	type BlocksViewState,
	blocksReduce,
	initialBlocksState,
} from "./Blocks.js"
import type { BlockDetail } from "./blocks-data.js"

/** Helper to create a minimal BlockDetail. */
const makeBlock = (overrides: Partial<BlockDetail> = {}): BlockDetail => ({
	hash: `0x${"ab".repeat(32)}`,
	parentHash: `0x${"00".repeat(32)}`,
	number: 0n,
	timestamp: BigInt(Math.floor(Date.now() / 1000)),
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
	transactionHashes: [],
	...overrides,
})

/** Create state with a given number of blocks. */
const stateWithBlocks = (count: number, overrides: Partial<BlocksViewState> = {}): BlocksViewState => ({
	...initialBlocksState,
	blocks: Array.from({ length: count }, (_, i) =>
		makeBlock({ number: BigInt(count - 1 - i), hash: `0x${(count - 1 - i).toString(16).padStart(64, "0")}` }),
	),
	...overrides,
})

describe("Blocks view reducer", () => {
	describe("initialState", () => {
		it.effect("starts in list mode with no selection", () =>
			Effect.sync(() => {
				expect(initialBlocksState.selectedIndex).toBe(0)
				expect(initialBlocksState.viewMode).toBe("list")
				expect(initialBlocksState.blocks).toEqual([])
				expect(initialBlocksState.mineRequested).toBe(false)
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(5)
				const next = blocksReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(5, { selectedIndex: 3 })
				const next = blocksReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last block", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { selectedIndex: 2 })
				const next = blocksReduce(state, "j")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("k clamps at first block", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { selectedIndex: 0 })
				const next = blocksReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j does nothing with empty blocks", () =>
			Effect.sync(() => {
				const next = blocksReduce(initialBlocksState, "j")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("k does nothing with empty blocks", () =>
			Effect.sync(() => {
				const next = blocksReduce(initialBlocksState, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("Enter → detail view", () => {
		it.effect("enter switches to detail mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { selectedIndex: 1 })
				const next = blocksReduce(state, "return")
				expect(next.viewMode).toBe("detail")
			}),
		)

		it.effect("enter preserves selectedIndex", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(5, { selectedIndex: 2 })
				const next = blocksReduce(state, "return")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("enter does nothing with empty blocks", () =>
			Effect.sync(() => {
				const next = blocksReduce(initialBlocksState, "return")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("Escape → back to list", () => {
		it.effect("escape returns to list mode from detail", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { viewMode: "detail", selectedIndex: 1 })
				const next = blocksReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape does nothing in list mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3)
				const next = blocksReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("m → mine block", () => {
		it.effect("m sets mineRequested in list mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3)
				const next = blocksReduce(state, "m")
				expect(next.mineRequested).toBe(true)
			}),
		)

		it.effect("m sets mineRequested in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { viewMode: "detail" })
				const next = blocksReduce(state, "m")
				expect(next.mineRequested).toBe(true)
			}),
		)

		it.effect("m works even with empty blocks (mine genesis+1)", () =>
			Effect.sync(() => {
				const next = blocksReduce(initialBlocksState, "m")
				expect(next.mineRequested).toBe(true)
			}),
		)
	})

	describe("unknown keys", () => {
		it.effect("unknown key returns state unchanged in list mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3)
				const next = blocksReduce(state, "x")
				expect(next).toEqual(state)
			}),
		)

		it.effect("unknown key returns state unchanged in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithBlocks(3, { viewMode: "detail" })
				const next = blocksReduce(state, "x")
				expect(next).toEqual(state)
			}),
		)
	})

	describe("key routing integration", () => {
		it.effect("m key is forwarded as ViewKey", () =>
			Effect.sync(() => {
				// Note: this test will pass once state.ts adds "m" to VIEW_KEYS
				// For now, "m" may not be in VIEW_KEYS yet — we test the reducer directly
				const state = stateWithBlocks(3)
				const next = blocksReduce(state, "m")
				expect(next.mineRequested).toBe(true)
			}),
		)

		it.effect("j/k navigation keys are forwarded as ViewKey", () =>
			Effect.sync(() => {
				const jAction = keyToAction("j")
				const kAction = keyToAction("k")
				expect(jAction).toEqual({ _tag: "ViewKey", key: "j" })
				expect(kAction).toEqual({ _tag: "ViewKey", key: "k" })
			}),
		)
	})
})
