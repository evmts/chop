import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { chainIdHandler } from "./chainId.js"

describe("chainIdHandler", () => {
	it.effect("returns default chain ID 31337", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* chainIdHandler(node)()
			expect(result).toBe(31337n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns custom chain ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* chainIdHandler(node)()
			expect(result).toBe(42n)
		}).pipe(Effect.provide(TevmNode.LocalTest({ chainId: 42n }))),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* chainIdHandler(node)()
			expect(typeof result).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
