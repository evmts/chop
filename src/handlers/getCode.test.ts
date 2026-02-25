import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getCodeHandler } from "./getCode.js"

const TEST_ADDR = `0x${"00".repeat(19)}02`

describe("getCodeHandler", () => {
	it.effect("returns empty bytes for non-existent account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getCodeHandler(node)({ address: TEST_ADDR })
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns deployed bytecode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Deploy contract code
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(TEST_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			const result = yield* getCodeHandler(node)({ address: TEST_ADDR })
			expect(result).toEqual(contractCode)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns Uint8Array type", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getCodeHandler(node)({ address: TEST_ADDR })
			expect(result).toBeInstanceOf(Uint8Array)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty bytes for EOA (account with balance but no code)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set account with balance but no code
			yield* node.hostAdapter.setAccount(hexToBytes(TEST_ADDR), {
				nonce: 5n,
				balance: 1_000_000n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* getCodeHandler(node)({ address: TEST_ADDR })
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
