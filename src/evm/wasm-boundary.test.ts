/**
 * Boundary condition tests for executeWithTrace in the mini EVM interpreter.
 *
 * These tests exercise the runMiniEvmWithTrace code paths that are NOT covered
 * by the existing wasm.test.ts (which tests execute and executeAsync).
 *
 * Covers:
 * - RETURN stack underflow in tracing path (lines 706-707)
 * - REVERT stack underflow in tracing path (lines 719-720)
 * - BALANCE, SLOAD, MLOAD, MSTORE stack underflow in tracing path
 * - Unknown opcode in tracing path
 * - Normal execution produces correct structLog entries
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError } from "./errors.js"
import { EvmWasmService, EvmWasmTest } from "./wasm.js"

// ---------------------------------------------------------------------------
// executeWithTrace — stack underflow error paths
// ---------------------------------------------------------------------------

describe("EvmWasm — executeWithTrace boundary conditions", () => {
	it.effect("RETURN with empty stack fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// RETURN opcode = 0xf3, needs 2 stack items (offset, size)
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0xf3]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("RETURN")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("RETURN with only one stack item fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x20, RETURN -> only offset on stack, no size
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x60, 0x20, 0xf3]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("RETURN")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT with empty stack fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// REVERT opcode = 0xfd, needs 2 stack items (offset, size)
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0xfd]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("REVERT")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT with only one stack item fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x00, REVERT -> only offset, no size
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x60, 0x00, 0xfd]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("REVERT")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("MLOAD with empty stack fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// MLOAD (0x51) with nothing on stack
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x51]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("MLOAD")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("MSTORE with only one stack item fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x00, MSTORE -> only offset, no value
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x60, 0x00, 0x52]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("MSTORE")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("SLOAD with empty stack fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// SLOAD (0x54) with empty stack
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x54]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("SLOAD")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("BALANCE with empty stack fails with stack underflow", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// BALANCE (0x31) with empty stack
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0x31]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("BALANCE")
			expect(result.message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("unknown opcode fails with Unsupported opcode error", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// 0xfe = INVALID opcode
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0xfe]) }, {})
				.pipe(Effect.flip)
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect(result.message).toContain("Unsupported opcode")
			expect(result.message).toContain("0xfe")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// executeWithTrace — structLog generation
// ---------------------------------------------------------------------------

describe("EvmWasm — executeWithTrace structLog entries", () => {
	it.effect("PUSH1 + STOP produces correct structLog entries", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x42, STOP
			const result = yield* evm.executeWithTrace(
				{ bytecode: new Uint8Array([0x60, 0x42, 0x00]) },
				{},
			)

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			expect(result.structLogs.length).toBe(2) // PUSH1 + STOP

			// First entry: PUSH1 at pc=0
			const push1Log = result.structLogs[0]!
			expect(push1Log.pc).toBe(0)
			expect(push1Log.op).toBe("PUSH1")
			expect(push1Log.depth).toBe(1)
			expect(push1Log.stack).toEqual([]) // stack is empty before PUSH1 executes

			// Second entry: STOP at pc=2
			const stopLog = result.structLogs[1]!
			expect(stopLog.pc).toBe(2)
			expect(stopLog.op).toBe("STOP")
			expect(stopLog.depth).toBe(1)
			// After PUSH1 0x42, stack should have one entry
			expect(stopLog.stack.length).toBe(1)
			expect(stopLog.stack[0]).toBe("0000000000000000000000000000000000000000000000000000000000000042")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("normal execution with MSTORE + RETURN produces structLogs", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60, 0x42, // PUSH1 0x42
				0x60, 0x00, // PUSH1 0x00
				0x52,       // MSTORE
				0x60, 0x20, // PUSH1 0x20
				0x60, 0x00, // PUSH1 0x00
				0xf3,       // RETURN
			])

			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)
			// 6 opcodes: PUSH1, PUSH1, MSTORE, PUSH1, PUSH1, RETURN
			expect(result.structLogs.length).toBe(6)

			// Verify opcode names are correct
			const opNames = result.structLogs.map((l) => l.op)
			expect(opNames).toEqual(["PUSH1", "PUSH1", "MSTORE", "PUSH1", "PUSH1", "RETURN"])

			// Verify PCs are correct
			const pcs = result.structLogs.map((l) => l.pc)
			expect(pcs).toEqual([0, 2, 4, 5, 7, 9])

			// Gas should be tracked
			expect(result.gasUsed).toBeGreaterThan(0n)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT with valid stack produces structLogs and success=false", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x00, PUSH1 0x00, REVERT -> revert with empty data
			const bytecode = new Uint8Array([
				0x60, 0x00, // PUSH1 0x00 (size)
				0x60, 0x00, // PUSH1 0x00 (offset)
				0xfd,       // REVERT
			])

			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(false)
			expect(result.output.length).toBe(0)
			expect(result.structLogs.length).toBe(3) // PUSH1, PUSH1, REVERT

			const opNames = result.structLogs.map((l) => l.op)
			expect(opNames).toEqual(["PUSH1", "PUSH1", "REVERT"])
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("empty bytecode produces empty structLogs", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm.executeWithTrace(
				{ bytecode: new Uint8Array([]) },
				{},
			)

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			expect(result.structLogs.length).toBe(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("executeWithTrace with SLOAD records trace and uses callback", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x01, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60, 0x01, // PUSH1 0x01 (slot)
				0x54,       // SLOAD
				0x60, 0x00, // PUSH1 0x00 (offset)
				0x52,       // MSTORE
				0x60, 0x20, // PUSH1 0x20 (size)
				0x60, 0x00, // PUSH1 0x00 (offset)
				0xf3,       // RETURN
			])

			const storageValue = new Uint8Array(32)
			storageValue[31] = 0xab

			let storageReadCalled = false
			const result = yield* evm.executeWithTrace(
				{ bytecode },
				{
					onStorageRead: (_address, _slot) =>
						Effect.sync(() => {
							storageReadCalled = true
							return storageValue
						}),
				},
			)

			expect(result.success).toBe(true)
			expect(storageReadCalled).toBe(true)
			expect(result.structLogs.length).toBe(7) // PUSH1, SLOAD, PUSH1, MSTORE, PUSH1, PUSH1, RETURN

			// Verify SLOAD is recorded in trace
			const sloadLog = result.structLogs[1]!
			expect(sloadLog.op).toBe("SLOAD")
			expect(sloadLog.pc).toBe(2)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("executeWithTrace gas tracking shows remaining gas decreasing", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x42, PUSH1 0x00, STOP
			const bytecode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x00])

			const result = yield* evm.executeWithTrace(
				{ bytecode, gas: 1_000_000n },
				{},
			)

			expect(result.success).toBe(true)
			expect(result.structLogs.length).toBe(3) // PUSH1, PUSH1, STOP

			// Gas remaining should decrease over execution
			const gasValues = result.structLogs.map((l) => l.gas)
			// First instruction should have full gas
			expect(gasValues[0]).toBe(1_000_000n)
			// Subsequent instructions should have less gas
			expect(gasValues[1]!).toBeLessThan(gasValues[0]!)
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})
