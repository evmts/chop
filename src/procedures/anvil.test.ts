import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { anvilMine } from "./anvil.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("anvilMine procedure", () => {
	it.effect("mines 1 block by default and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const result = yield* anvilMine(node)([])

			expect(result).toBeNull()
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("mines specified number of blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			yield* anvilMine(node)([3])

			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 3n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("mines with hex block count", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			yield* anvilMine(node)(["0x5"])

			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			// Number("0x5") = NaN — actually we need to handle hex. Let's check.
			// Note: Number("0x5") = 5 in JS! Hex string parsing works.
			expect(headAfter).toBe(headBefore + 5n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
