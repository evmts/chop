import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { evmMine, evmSetAutomine, evmSetIntervalMining } from "./evm.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evmMine procedure", () => {
	it.effect("mines one block and returns '0x0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const result = yield* evmMine(node)([])

			expect(result).toBe("0x0")
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("evmSetAutomine procedure", () => {
	it.effect("disables automine when passed false", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetAutomine(node)([false])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("manual")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("enables automine when passed true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetAutomine(node)([false])
			yield* evmSetAutomine(node)([true])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 'true'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSetAutomine(node)([true])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("evmSetIntervalMining procedure", () => {
	it.effect("sets interval mode when ms > 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetIntervalMining(node)([1000])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("interval")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("sets manual mode when ms = 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetIntervalMining(node)([1000])
			yield* evmSetIntervalMining(node)([0])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("manual")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 'true'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSetIntervalMining(node)([1000])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
