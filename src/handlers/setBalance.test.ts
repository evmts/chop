import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getBalanceHandler } from "./getBalance.js"
import { setBalanceHandler } from "./setBalance.js"

const TEST_ADDR = `0x${"00".repeat(19)}ff`
const ONE_ETH = 1_000_000_000_000_000_000n

describe("setBalanceHandler", () => {
	it.effect("set → getBalance → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: ONE_ETH })
			const balance = yield* getBalanceHandler(node)({ address: TEST_ADDR })

			expect(balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("overwrites existing balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: ONE_ETH })
			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: 2n * ONE_ETH })
			const balance = yield* getBalanceHandler(node)({ address: TEST_ADDR })

			expect(balance).toBe(2n * ONE_ETH)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("set balance to 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: ONE_ETH })
			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: 0n })
			const balance = yield* getBalanceHandler(node)({ address: TEST_ADDR })

			expect(balance).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: ONE_ETH })
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("preserves other account fields (nonce, code)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(TEST_ADDR)

			// Set nonce first
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, { ...account, nonce: 42n, balance: ONE_ETH })

			// Now set balance — nonce should be preserved
			yield* setBalanceHandler(node)({ address: TEST_ADDR, balance: 2n * ONE_ETH })

			const updated = yield* node.hostAdapter.getAccount(addrBytes)
			expect(updated.balance).toBe(2n * ONE_ETH)
			expect(updated.nonce).toBe(42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
