import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError } from "./errors.js"
import { EvmWasmService, EvmWasmTest } from "./wasm.js"

// ---------------------------------------------------------------------------
// Edge cases in runMiniEvmWithTrace (lines 670-694 of wasm.ts)
// ---------------------------------------------------------------------------

describe("EvmWasmService — executeWithTrace edge cases", () => {
	// -----------------------------------------------------------------------
	// SLOAD without onStorageRead callback (lines 680-682)
	// When no onStorageRead callback is provided, SLOAD should push 0n.
	// -----------------------------------------------------------------------

	it.effect("SLOAD without onStorageRead callback pushes 0n", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x01  — push slot number 1
			// SLOAD       — load storage (no callback => pushes 0n)
			// PUSH1 0x00  — push memory offset 0
			// MSTORE      — store the 0n value at memory[0..31]
			// PUSH1 0x20  — push return size 32
			// PUSH1 0x00  — push return offset 0
			// RETURN      — return 32 bytes from memory[0..31]
			const bytecode = new Uint8Array([0x60, 0x01, 0x54, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			// Pass empty callbacks — no onStorageRead
			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(true)
			// Output should be 32 zero bytes (SLOAD returned 0n)
			expect(result.output.length).toBe(32)
			const allZero = result.output.every((b) => b === 0)
			expect(allZero).toBe(true)

			// Verify structLogs contain the SLOAD entry
			const ops = result.structLogs.map((s) => s.op)
			expect(ops).toContain("SLOAD")

			// Gas should include SLOAD cost (2100n)
			expect(result.gasUsed).toBeGreaterThanOrEqual(2100n)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("SLOAD without onStorageRead: verify 0n on stack via MSTORE + RETURN", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x05  — push slot 5
			// SLOAD       — no callback, pushes 0n
			// PUSH1 0x00  — memory offset
			// MSTORE      — store at memory[0]
			// PUSH1 0x20  — size 32
			// PUSH1 0x00  — offset 0
			// RETURN
			const bytecode = new Uint8Array([0x60, 0x05, 0x54, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(true)
			// The returned value should be all zeros (0n stored as 32 bytes)
			expect(result.output).toEqual(new Uint8Array(32))
			expect(result.structLogs.length).toBeGreaterThan(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	// -----------------------------------------------------------------------
	// PUSH1 at end of bytecode (lines 692-694)
	// When PUSH1 is the last byte with no operand, it should fail.
	// -----------------------------------------------------------------------

	it.effect("PUSH1 at end of bytecode fails with WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Single PUSH1 opcode with no operand byte following it
			const bytecode = new Uint8Array([0x60])

			const result = yield* evm
				.executeWithTrace({ bytecode }, {})
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))

			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("PUSH1")
			expect((result as WasmExecutionError).message).toContain("unexpected end of bytecode")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("PUSH1 at end of bytecode after valid opcodes fails", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x42  — valid: push 0x42
			// PUSH1 0x00  — valid: push 0x00
			// MSTORE      — valid: store 0x42 at memory[0]
			// PUSH1       — invalid: no operand, truncated bytecode
			const bytecode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60])

			const result = yield* evm
				.executeWithTrace({ bytecode }, {})
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))

			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("PUSH1")
			expect((result as WasmExecutionError).message).toContain("unexpected end of bytecode")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})
