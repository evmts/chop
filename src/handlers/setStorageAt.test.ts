import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getStorageAtHandler } from "./getStorageAt.js"
import { setStorageAtHandler } from "./setStorageAt.js"

const TEST_ADDR = `0x${"00".repeat(19)}ff`
const SLOT_0 = `0x${"00".repeat(32)}`
const SLOT_1 = `0x${"00".repeat(31)}01`

describe("setStorageAtHandler", () => {
	it.effect("set → getStorageAt → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_0,
				value: "0x42",
			})
			const value = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_0 })

			expect(value).toBe(0x42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("set different slots independently", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_0,
				value: "0x10",
			})
			yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_1,
				value: "0x20",
			})

			const val0 = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_0 })
			const val1 = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_1 })

			expect(val0).toBe(0x10n)
			expect(val1).toBe(0x20n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("overwrite existing storage value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_0,
				value: "0x10",
			})
			yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_0,
				value: "0xff",
			})

			const value = yield* getStorageAtHandler(node)({ address: TEST_ADDR, slot: SLOT_0 })
			expect(value).toBe(0xffn)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* setStorageAtHandler(node)({
				address: TEST_ADDR,
				slot: SLOT_0,
				value: "0x1",
			})
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
