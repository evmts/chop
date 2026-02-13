import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { gasPriceHandler } from "./gasPrice.js"

describe("gasPriceHandler", () => {
	it.effect("returns base fee from genesis block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const price = yield* gasPriceHandler(node)()
			expect(price).toBe(1_000_000_000n) // default genesis baseFee
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const price = yield* gasPriceHandler(node)()
			expect(typeof price).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns positive value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const price = yield* gasPriceHandler(node)()
			expect(price > 0n).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
