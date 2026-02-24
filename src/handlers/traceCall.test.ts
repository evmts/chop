import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { traceCallHandler } from "./traceCall.js"

describe("traceCallHandler", () => {
	// -----------------------------------------------------------------------
	// Happy path: trace simple bytecode
	// -----------------------------------------------------------------------

	it.effect("traces simple bytecode and returns structLogs with pc/op/gas/depth/stack", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const result = yield* traceCallHandler(node)({ data })
			expect(result.failed).toBe(false)
			expect(result.structLogs.length).toBe(6)

			// Check first entry: PUSH1 at pc=0
			const first = result.structLogs[0]!
			expect(first.pc).toBe(0)
			expect(first.op).toBe("PUSH1")
			expect(typeof first.gas).toBe("bigint")
			expect(first.depth).toBe(1)
			expect(first.stack).toEqual([])

			// Check second entry: PUSH1 at pc=2
			const second = result.structLogs[1]!
			expect(second.pc).toBe(2)
			expect(second.op).toBe("PUSH1")
			expect(second.stack.length).toBe(1) // 0x42 on stack

			// Check third entry: MSTORE at pc=4
			const third = result.structLogs[2]!
			expect(third.pc).toBe(4)
			expect(third.op).toBe("MSTORE")
			expect(third.stack.length).toBe(2) // 0x42 and 0x00 on stack

			// Check last entry: RETURN at pc=9
			const last = result.structLogs[5]!
			expect(last.op).toBe("RETURN")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("traces STOP bytecode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Simple STOP bytecode
			const data = bytesToHex(new Uint8Array([0x00]))

			const result = yield* traceCallHandler(node)({ data })
			expect(result.failed).toBe(false)
			expect(result.structLogs.length).toBe(1)
			expect(result.structLogs[0]?.op).toBe("STOP")
			expect(result.structLogs[0]?.pc).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// REVERT: trace shows revert point
	// -----------------------------------------------------------------------

	it.effect("traces REVERT bytecode — failed=true and trace shows REVERT at end", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x00, PUSH1 0x00, REVERT
			// Reverts with 0 bytes from memory offset 0
			const data = bytesToHex(new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd]))

			const result = yield* traceCallHandler(node)({ data })
			expect(result.failed).toBe(true)
			expect(result.structLogs.length).toBe(3)

			const last = result.structLogs[2]!
			expect(last.op).toBe("REVERT")
			expect(last.pc).toBe(4)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Stack snapshot format
	// -----------------------------------------------------------------------

	it.effect("stack entries are 64-char padded hex strings", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, STOP
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x00]))

			const result = yield* traceCallHandler(node)({ data })
			// STOP entry should have 0x42 on stack
			const stopLog = result.structLogs[1]!
			expect(stopLog.op).toBe("STOP")
			expect(stopLog.stack.length).toBe(1)
			expect(stopLog.stack[0]).toBe("0000000000000000000000000000000000000000000000000000000000000042")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Gas tracking
	// -----------------------------------------------------------------------

	it.effect("gas field decreases as opcodes are executed", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, STOP
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x00]))

			const result = yield* traceCallHandler(node)({ data, gas: 1_000_000n })
			expect(result.structLogs[0]?.gas).toBe(1_000_000n) // Full gas at start
			expect(result.structLogs[1]?.gas).toBe(1_000_000n - 3n) // After PUSH1 (cost=3)
			expect(result.structLogs[2]?.gas).toBe(1_000_000n - 6n) // After two PUSH1s
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error cases
	// -----------------------------------------------------------------------

	it.effect("fails with HandlerError when no to and no data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* traceCallHandler(node)({}).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("traceCall requires either 'to' or 'data'")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Return value
	// -----------------------------------------------------------------------

	it.effect("returns correct returnValue as hex string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const result = yield* traceCallHandler(node)({ data })
			expect(result.returnValue).toMatch(/^0x/)
			expect(result.gas).toBeGreaterThan(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
