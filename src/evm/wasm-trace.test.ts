import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError } from "./errors.js"
import { EvmWasmService, EvmWasmTest } from "./wasm.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Uint8Array to hex string with 0x prefix. */
const bytesToHex = (bytes: Uint8Array): string => {
	return `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`
}

// ---------------------------------------------------------------------------
// executeWithTrace — coverage for runMiniEvmWithTrace
// ---------------------------------------------------------------------------

describe("EvmWasmService — executeWithTrace", () => {
	it.effect("happy path: PUSH1 0x42 + MSTORE + RETURN produces structLogs", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			const result = yield* evm.executeWithTrace({ bytecode }, {})

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)
			expect(bytesToHex(result.output)).toBe("0x0000000000000000000000000000000000000000000000000000000000000042")
			// structLogs should contain entries for each opcode executed
			expect(result.structLogs.length).toBeGreaterThan(0)
			// First log should be PUSH1
			expect(result.structLogs[0]?.op).toBe("PUSH1")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("STOP returns empty output with structLogs", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm.executeWithTrace({ bytecode: new Uint8Array([0x00]) }, {})
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			// structLogs should have at least one entry for STOP
			expect(result.structLogs.length).toBeGreaterThanOrEqual(1)
			expect(result.structLogs[0]?.op).toBe("STOP")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("unsupported opcode produces WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm
				.executeWithTrace({ bytecode: new Uint8Array([0xfe]) }, {}) // INVALID
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("0xfe")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("empty bytecode returns empty output (implicit STOP)", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm.executeWithTrace({ bytecode: new Uint8Array([]) }, {})
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			// No opcodes to execute, so structLogs should be empty
			expect(result.structLogs.length).toBe(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("REVERT with tracing returns success=false and structLogs", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x00, PUSH1 0x00, REVERT (revert with empty data)
			const bytecode = new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd])
			const result = yield* evm.executeWithTrace({ bytecode }, {})
			expect(result.success).toBe(false)
			expect(result.structLogs.length).toBeGreaterThan(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("executeWithTrace with SLOAD triggers async callback", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x01, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([0x60, 0x01, 0x54, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
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
			expect(result.output[31]).toBe(0xab)
			expect(result.structLogs.length).toBeGreaterThan(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("executeWithTrace with BALANCE triggers async callback", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x42, BALANCE, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([0x60, 0x42, 0x31, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			const balanceValue = new Uint8Array(32)
			balanceValue[31] = 0xff

			let balanceReadCalled = false
			const result = yield* evm.executeWithTrace(
				{ bytecode },
				{
					onBalanceRead: (_address) =>
						Effect.sync(() => {
							balanceReadCalled = true
							return balanceValue
						}),
				},
			)

			expect(result.success).toBe(true)
			expect(balanceReadCalled).toBe(true)
			expect(result.output[31]).toBe(0xff)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("executeWithTrace MLOAD traces correctly", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x00, MLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x00, 0x51, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3,
			])
			const result = yield* evm.executeWithTrace({ bytecode }, {})
			expect(result.success).toBe(true)
			// Should have structLogs for each operation
			const ops = result.structLogs.map((s) => s.op)
			expect(ops).toContain("PUSH1")
			expect(ops).toContain("MSTORE")
			expect(ops).toContain("MLOAD")
			expect(ops).toContain("RETURN")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})
