import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getTransactionCountHandler } from "./getTransactionCount.js"
import { setNonceHandler } from "./setNonce.js"

const TEST_ADDR = `0x${"00".repeat(19)}ff`

describe("setNonceHandler", () => {
	it.effect("set → getTransactionCount → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 42n })
			const nonce = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })

			expect(nonce).toBe(42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("overwrites existing nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 10n })
			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 99n })
			const nonce = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })

			expect(nonce).toBe(99n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("set nonce to 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 42n })
			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 0n })
			const nonce = yield* getTransactionCountHandler(node)({ address: TEST_ADDR })

			expect(nonce).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 1n })
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("preserves balance when setting nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(TEST_ADDR)

			// Set balance first
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, { ...account, balance: 1000n })

			// Set nonce — balance should be preserved
			yield* setNonceHandler(node)({ address: TEST_ADDR, nonce: 5n })

			const updated = yield* node.hostAdapter.getAccount(addrBytes)
			expect(updated.nonce).toBe(5n)
			expect(updated.balance).toBe(1000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
