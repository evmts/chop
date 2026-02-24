/**
 * Coverage tests for gaps in the mini EVM interpreter (wasm.ts).
 *
 * Covers:
 * - REVERT opcode in the non-trace `execute` path (lines 547-558)
 * - BALANCE without callback in the trace `executeWithTrace` path (lines 635-636)
 * - PUSH2 opcode (0x61) — unsupported in the mini EVM, should fail
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError } from "./errors.js"
import { EvmWasmService, EvmWasmTest } from "./wasm.js"

/** Convert Uint8Array to hex string with 0x prefix. */
const bytesToHex = (bytes: Uint8Array): string => {
	return `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`
}

// ---------------------------------------------------------------------------
// REVERT in non-trace execute path
// ---------------------------------------------------------------------------

describe("EvmWasm — REVERT in execute (non-trace)", () => {
	it.effect("REVERT with valid offset and size returns success=false", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Store 0x00 at memory[0] (just to have defined memory), then REVERT with offset=0, size=0
			// Bytecode: PUSH1 0x00, PUSH1 0x00, REVERT
			const bytecode = new Uint8Array([
				0x60, 0x00, // PUSH1 0x00 (size)
				0x60, 0x00, // PUSH1 0x00 (offset)
				0xfd,       // REVERT
			])

			const result = yield* evm.execute({ bytecode })

			expect(result.success).toBe(false)
			expect(result.output.length).toBe(0)
			expect(result.gasUsed).toBeGreaterThan(0n)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT returns revert data from memory", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Store 0xAB at memory offset 0, then REVERT returning 32 bytes from offset 0
			// Bytecode: PUSH1 0xAB, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, REVERT
			const bytecode = new Uint8Array([
				0x60, 0xab, // PUSH1 0xAB
				0x60, 0x00, // PUSH1 0x00
				0x52,       // MSTORE (stores 0xAB at memory[0..32] as big-endian 32-byte word)
				0x60, 0x20, // PUSH1 0x20 (size = 32)
				0x60, 0x00, // PUSH1 0x00 (offset = 0)
				0xfd,       // REVERT
			])

			const result = yield* evm.execute({ bytecode })

			expect(result.success).toBe(false)
			expect(result.output.length).toBe(32)

			const expected = "0x00000000000000000000000000000000000000000000000000000000000000ab"
			expect(bytesToHex(result.output)).toBe(expected)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT with empty stack fails with WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// REVERT with nothing on the stack
			const bytecode = new Uint8Array([0xfd])

			const result = yield* evm.execute({ bytecode }).pipe(Effect.flip)

			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("REVERT")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// BALANCE without callback in executeWithTrace path
// ---------------------------------------------------------------------------

describe("EvmWasm — BALANCE without callback in executeWithTrace", () => {
	it.effect("BALANCE without onBalanceRead callback pushes 0n to the stack", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Push an address onto the stack, call BALANCE (no callback, so it should push 0),
			// then store the result in memory and return it.
			//
			// Bytecode:
			//   PUSH1 0x42        — dummy address value
			//   BALANCE (0x31)    — pops address, pushes balance (0n without callback)
			//   PUSH1 0x00        — memory offset
			//   MSTORE (0x52)     — store balance at memory[0..32]
			//   PUSH1 0x20        — size = 32
			//   PUSH1 0x00        — offset = 0
			//   RETURN (0xf3)     — return memory[0..32]
			const bytecode = new Uint8Array([
				0x60, 0x42, // PUSH1 0x42 (address)
				0x31,       // BALANCE
				0x60, 0x00, // PUSH1 0x00 (memory offset)
				0x52,       // MSTORE
				0x60, 0x20, // PUSH1 0x20 (return size)
				0x60, 0x00, // PUSH1 0x00 (return offset)
				0xf3,       // RETURN
			])

			// Pass empty callbacks object — no onBalanceRead
			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)

			// Balance should be 0 — all zero bytes
			const expected = "0x0000000000000000000000000000000000000000000000000000000000000000"
			expect(bytesToHex(result.output)).toBe(expected)

			// Verify structLogs were recorded (trace mode is active)
			expect(result.structLogs.length).toBeGreaterThan(0)

			// The BALANCE opcode should appear in the struct logs
			const balanceLog = result.structLogs.find((log) => log.op === "BALANCE")
			expect(balanceLog).toBeDefined()
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// PUSH2 opcode (0x61) — unsupported in the mini EVM
// ---------------------------------------------------------------------------

describe("EvmWasm — PUSH2 opcode", () => {
	it.effect("PUSH2 in execute fails with unsupported opcode error", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH2 0x01 0x00 — push the 2-byte value 0x0100 (256)
			const bytecode = new Uint8Array([0x61, 0x01, 0x00])

			const result = yield* evm.execute({ bytecode }).pipe(Effect.flip)

			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("Unsupported opcode")
			expect(result.message).toContain("0x61")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})
