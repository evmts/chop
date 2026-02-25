import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getCodeHandler } from "./getCode.js"
import { setCodeHandler } from "./setCode.js"

const TEST_ADDR = `0x${"00".repeat(19)}ff`
const BYTECODE = "0x6080604052"

describe("setCodeHandler", () => {
	it.effect("set → getCode → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setCodeHandler(node)({ address: TEST_ADDR, code: BYTECODE })
			const code = yield* getCodeHandler(node)({ address: TEST_ADDR })

			expect(bytesToHex(code)).toBe(BYTECODE)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("overwrites existing code", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setCodeHandler(node)({ address: TEST_ADDR, code: BYTECODE })
			const newCode = "0xdeadbeef"
			yield* setCodeHandler(node)({ address: TEST_ADDR, code: newCode })
			const code = yield* getCodeHandler(node)({ address: TEST_ADDR })

			expect(bytesToHex(code)).toBe(newCode)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("set empty code (clear contract)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setCodeHandler(node)({ address: TEST_ADDR, code: BYTECODE })
			yield* setCodeHandler(node)({ address: TEST_ADDR, code: "0x" })
			const code = yield* getCodeHandler(node)({ address: TEST_ADDR })

			expect(code.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* setCodeHandler(node)({ address: TEST_ADDR, code: BYTECODE })
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
