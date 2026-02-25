import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { getBlocksData, mineBlock } from "./blocks-data.js"

describe("blocks-data", () => {
	describe("getBlocksData", () => {
		it.effect("returns at least 1 block (genesis) on fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getBlocksData(node)
				expect(data.blocks.length).toBeGreaterThanOrEqual(1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("genesis block has number 0n", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getBlocksData(node)
				// Blocks are in reverse order, so genesis is last
				expect(data.blocks[data.blocks.length - 1]?.number).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("blocks are in reverse chronological order (first has highest number)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(3)
				const data = yield* getBlocksData(node)
				// Check top blocks are in descending order
				expect(data.blocks[0]?.number).toBe(3n)
				expect(data.blocks[1]?.number).toBe(2n)
				expect(data.blocks[2]?.number).toBe(1n)
				// Verify non-increasing order invariant
				for (let i = 1; i < data.blocks.length; i++) {
					expect(data.blocks[i]?.number).toBeLessThanOrEqual(data.blocks[i - 1]?.number as bigint)
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("block has expected fields", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getBlocksData(node)
				const block = data.blocks[0]
				expect(block).toBeDefined()
				expect(typeof block?.hash).toBe("string")
				expect(typeof block?.parentHash).toBe("string")
				expect(typeof block?.number).toBe("bigint")
				expect(typeof block?.timestamp).toBe("bigint")
				expect(typeof block?.gasLimit).toBe("bigint")
				expect(typeof block?.gasUsed).toBe("bigint")
				expect(typeof block?.baseFeePerGas).toBe("bigint")
				expect(Array.isArray(block?.transactionHashes)).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("genesis block has 1 gwei base fee", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getBlocksData(node)
				const genesis = data.blocks[data.blocks.length - 1]
				expect(genesis).toBeDefined()
				expect(genesis?.baseFeePerGas).toBe(1_000_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transactionHashes is always an array (never undefined)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getBlocksData(node)
				for (const block of data.blocks) {
					expect(Array.isArray(block.transactionHashes)).toBe(true)
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("mineBlock", () => {
		it.effect("returns array with 1 block", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const minedBlocks = yield* mineBlock(node)
				expect(minedBlocks.length).toBe(1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("increases block count", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const before = yield* getBlocksData(node)
				yield* mineBlock(node)
				const after = yield* getBlocksData(node)
				expect(after.blocks.length).toBe(before.blocks.length + 1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("after mining, new block is at top of list", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* mineBlock(node)
				const data = yield* getBlocksData(node)
				expect(data.blocks[0]?.number).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
