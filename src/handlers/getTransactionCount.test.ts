import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getTransactionCountHandler } from "./getTransactionCount.js"

const TEST_ADDR = `0x${"00".repeat(19)}04`

describe("getTransactionCountHandler", () => {
	it.effect("returns 0n for non-existent account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })
			expect(result).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns correct nonce for account with transactions", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set account with nonce
			yield* node.hostAdapter.setAccount(hexToBytes(TEST_ADDR), {
				nonce: 42n,
				balance: 1_000_000n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })
			expect(result).toBe(42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })
			expect(typeof result).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
