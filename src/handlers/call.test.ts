import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { callHandler } from "./call.js"

const CONTRACT_ADDR = `0x${"00".repeat(19)}42`

describe("callHandler", () => {
	// -----------------------------------------------------------------------
	// Raw bytecode execution (no `to`)
	// -----------------------------------------------------------------------

	it.effect("executes raw bytecode and returns result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const result = yield* callHandler(node)({ data })
			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0x42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("tracks gasUsed", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Simple STOP bytecode
			const data = bytesToHex(new Uint8Array([0x00]))

			const result = yield* callHandler(node)({ data })
			expect(result.success).toBe(true)
			expect(typeof result.gasUsed).toBe("bigint")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Contract call (with `to`)
	// -----------------------------------------------------------------------

	it.effect("calls deployed contract and returns result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract code: PUSH1 0x99, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x99, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			// Deploy contract
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			const result = yield* callHandler(node)({ to: CONTRACT_ADDR })
			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0x99n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("contract with SLOAD reads storage during execution", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract code: PUSH1 0x01 (slot), SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x01, 0x54, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			// Deploy contract
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			// Set storage at slot 1 to 0xdeadbeef
			yield* node.hostAdapter.setStorage(hexToBytes(CONTRACT_ADDR), bigintToBytes32(1n), 0xdeadbeefn)

			const result = yield* callHandler(node)({ to: CONTRACT_ADDR })
			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0xdeadbeefn)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------

	it.effect("calling address with no code returns success with empty output", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const emptyAddr = `0x${"00".repeat(19)}ff`

			const result = yield* callHandler(node)({ to: emptyAddr })
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			expect(result.gasUsed).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with HandlerError when no to and no data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* callHandler(node)({}).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("call requires either 'to' or 'data'")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns CallResult shape", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const data = bytesToHex(new Uint8Array([0x00])) // STOP
			const result = yield* callHandler(node)({ data })

			expect(result).toHaveProperty("success")
			expect(result).toHaveProperty("output")
			expect(result).toHaveProperty("gasUsed")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("accepts from parameter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const data = bytesToHex(new Uint8Array([0x00])) // STOP
			const from = `0x${"00".repeat(19)}aa`

			const result = yield* callHandler(node)({ data, from })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("accepts gas parameter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const data = bytesToHex(new Uint8Array([0x00])) // STOP

			const result = yield* callHandler(node)({ data, gas: 1_000_000n })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("wraps WasmExecutionError as HandlerError", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// 0xFE (INVALID) is an unsupported opcode in the mini EVM — triggers WasmExecutionError
			const data = bytesToHex(new Uint8Array([0xfe]))

			const error = yield* callHandler(node)({ data }).pipe(
				Effect.flip, // flip success/error so we can inspect the error
			)
			expect(error._tag).toBe("HandlerError")
			expect(error.message).toContain("0xfe")
			expect(error.cause).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
