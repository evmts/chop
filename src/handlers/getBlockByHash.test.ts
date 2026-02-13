import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getBlockByHashHandler } from "./getBlockByHash.js"

describe("getBlockByHashHandler", () => {
	it.effect("returns block by known genesis hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Get genesis hash first
			const genesis = yield* node.blockchain.getHead()
			const block = yield* getBlockByHashHandler(node)({ hash: genesis.hash, includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.number).toBe(0n)
			expect(block!.hash).toBe(genesis.hash)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByHashHandler(node)({
				hash: `0x${"ff".repeat(32)}`,
				includeFullTxs: false,
			})
			expect(block).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns block with correct fields", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const genesis = yield* node.blockchain.getHead()
			const block = yield* getBlockByHashHandler(node)({ hash: genesis.hash, includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.parentHash).toBeDefined()
			expect(typeof block!.gasLimit).toBe("bigint")
			expect(typeof block!.timestamp).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
