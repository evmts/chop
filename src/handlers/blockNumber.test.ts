import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { blockNumberHandler } from "./blockNumber.js"

describe("blockNumberHandler", () => {
	it.effect("fresh node returns block 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* blockNumberHandler(node)()
			expect(result).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* blockNumberHandler(node)()
			expect(typeof result).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns updated block number after putBlock", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Get genesis head
			const genesis = yield* node.blockchain.getHead()

			// Add a new block
			yield* node.blockchain.putBlock({
				hash: `0x${"00".repeat(31)}02`,
				parentHash: genesis.hash,
				number: 1n,
				timestamp: genesis.timestamp + 12n,
				gasLimit: 30_000_000n,
				gasUsed: 0n,
				baseFeePerGas: 1_000_000_000n,
			})

			const result = yield* blockNumberHandler(node)()
			expect(result).toBe(1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
