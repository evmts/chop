import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { netListening, netPeerCount, netVersion } from "./net.js"

describe("netVersion", () => {
	it.effect("returns chain ID as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* netVersion(node)([])
			expect(result).toBe("31337")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns custom chain ID as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* netVersion(node)([])
			expect(result).toBe("1")
		}).pipe(Effect.provide(TevmNode.LocalTest({ chainId: 1n }))),
	)
})

describe("netListening", () => {
	it.effect("returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* netListening(node)([])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("netPeerCount", () => {
	it.effect("returns 0x0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* netPeerCount(node)([])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
