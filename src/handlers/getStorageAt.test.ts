import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bigintToBytes32, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getStorageAtHandler } from "./getStorageAt.js"

const TEST_ADDR = `0x${"00".repeat(19)}03`
const SLOT_0 = `0x${"00".repeat(32)}`
const SLOT_1 = `0x${"00".repeat(31)}01`

describe("getStorageAtHandler", () => {
	it.effect("returns 0n for unset slot", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_0 })
			expect(result).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns stored value after setStorage", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create account first (storage requires existing account)
			yield* node.hostAdapter.setAccount(hexToBytes(TEST_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			// Set storage
			yield* node.hostAdapter.setStorage(hexToBytes(TEST_ADDR), bigintToBytes32(1n), 0xdeadbeefn)

			const result = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_1 })
			expect(result).toBe(0xdeadbeefn)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns bigint type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_0 })
			expect(typeof result).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
