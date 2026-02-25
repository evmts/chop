// Tests for T3.7 remaining evm_* procedures.

import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { evmIncreaseTime, evmSetNextBlockTimestamp } from "./evm.js"

// ---------------------------------------------------------------------------
// evm_increaseTime
// ---------------------------------------------------------------------------

describe("evmIncreaseTime procedure", () => {
	it.effect("advances timestamp by given seconds and returns hex offset", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* evmIncreaseTime(node)([60])

			expect(result).toBe("0x3c") // 60 in hex
			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(60n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("accumulates multiple increaseTime calls", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmIncreaseTime(node)([30])
			const result = yield* evmIncreaseTime(node)([30])

			expect(result).toBe("0x3c") // 60 in hex
			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(60n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles hex string input", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Number("0x3c") = 60
			const result = yield* evmIncreaseTime(node)(["0x3c"])

			expect(result).toBe("0x3c")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evm_setNextBlockTimestamp
// ---------------------------------------------------------------------------

describe("evmSetNextBlockTimestamp procedure", () => {
	it.effect("sets exact timestamp for next block and returns hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const futureTimestamp = 2_000_000_000 // year ~2033

			const result = yield* evmSetNextBlockTimestamp(node)([futureTimestamp])

			expect(result).toBe("0x77359400") // 2_000_000_000 in hex
			const nextTs = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
			expect(nextTs).toBe(2_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles hex string input", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* evmSetNextBlockTimestamp(node)(["0x77359400"])

			// Number("0x77359400") = 2000000000
			expect(result).toBe("0x77359400")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
