import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { estimateGasHandler } from "./estimateGas.js"

describe("estimateGasHandler", () => {
	it.effect("returns 21000 for simple transfer", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const gas = yield* estimateGasHandler(node)({
				to: `0x${"00".repeat(19)}01`,
			})
			expect(gas).toBe(21000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 21000 when no to and no data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const gas = yield* estimateGasHandler(node)({})
			expect(gas).toBe(21000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const gas = yield* estimateGasHandler(node)({
				to: `0x${"00".repeat(19)}01`,
			})
			expect(typeof gas).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns positive value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const gas = yield* estimateGasHandler(node)({
				to: `0x${"00".repeat(19)}01`,
			})
			expect(gas > 0n).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
