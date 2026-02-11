import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError } from "./errors.js"
import { EvmWasmService, EvmWasmTest, makeEvmWasmTestWithCleanup } from "./wasm.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a hex string (with or without 0x prefix) to Uint8Array. */
const hexToBytes = (hex: string): Uint8Array => {
	const clean = hex.startsWith("0x") ? hex.slice(2) : hex
	const bytes = new Uint8Array(clean.length / 2)
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
	}
	return bytes
}

/** Convert Uint8Array to hex string with 0x prefix. */
const bytesToHex = (bytes: Uint8Array): string => {
	return `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`
}

// ---------------------------------------------------------------------------
// Acceptance test 1: PUSH1 0x42 MSTORE RETURN → 0x42 padded to 32 bytes
// ---------------------------------------------------------------------------

describe("EvmWasmService — sync execution", () => {
	it.effect("PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN returns 0x42 padded to 32 bytes", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60,
				0x42, // PUSH1 0x42
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const result = yield* evm.execute({ bytecode })

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)

			// Output should be 0x42 padded to 32 bytes (big-endian)
			const expected = "0x0000000000000000000000000000000000000000000000000000000000000042"
			expect(bytesToHex(result.output)).toBe(expected)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("STOP returns empty output", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm.execute({ bytecode: new Uint8Array([0x00]) })
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("PUSH1 0xff, PUSH1 0x00, MSTORE, PUSH1 0x01, PUSH1 0x1f, RETURN returns single byte 0xff", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0xff, PUSH1 0x00, MSTORE → memory[0..32] = pad32(0xff)
			// PUSH1 0x01, PUSH1 0x1f, RETURN → return memory[31..32] = [0xff]
			const bytecode = new Uint8Array([0x60, 0xff, 0x60, 0x00, 0x52, 0x60, 0x01, 0x60, 0x1f, 0xf3])

			const result = yield* evm.execute({ bytecode })
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(1)
			expect(result.output[0]).toBe(0xff)
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("empty bytecode returns empty output", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm.execute({ bytecode: new Uint8Array([]) })
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 2: SLOAD yields, provide storage, resumes correctly
// ---------------------------------------------------------------------------

describe("EvmWasmService — async execution (storage)", () => {
	it.effect("SLOAD yields, host provides storage value, resumes and returns correctly", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Bytecode:
			//   PUSH1 0x01   → slot 1
			//   SLOAD        → yields, host provides 0xBEEF
			//   PUSH1 0x00   → memory offset 0
			//   MSTORE       → store at memory[0..32]
			//   PUSH1 0x20   → size 32
			//   PUSH1 0x00   → offset 0
			//   RETURN       → return memory[0..32]
			const bytecode = new Uint8Array([
				0x60,
				0x01, // PUSH1 0x01 (slot)
				0x54, // SLOAD
				0x60,
				0x00, // PUSH1 0x00 (offset)
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20 (size)
				0x60,
				0x00, // PUSH1 0x00 (offset)
				0xf3, // RETURN
			])

			// Storage value: 0xBEEF = 48879
			const storageValue = hexToBytes("0x000000000000000000000000000000000000000000000000000000000000BEEF")

			let storageReadCalled = false
			let receivedSlot: Uint8Array | null = null

			const result = yield* evm.executeAsync(
				{ bytecode },
				{
					onStorageRead: (_address, slot) =>
						Effect.sync(() => {
							storageReadCalled = true
							receivedSlot = slot
							return storageValue
						}),
				},
			)

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)
			expect(storageReadCalled).toBe(true)

			// Slot should be pad32(1)
			expect(bytesToHex(receivedSlot as unknown as Uint8Array)).toBe(
				"0x0000000000000000000000000000000000000000000000000000000000000001",
			)

			// Output should be the storage value
			expect(bytesToHex(result.output)).toBe("0x000000000000000000000000000000000000000000000000000000000000beef")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("SLOAD without callback returns zero", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			const bytecode = new Uint8Array([
				0x60,
				0x00, // PUSH1 0x00 (slot)
				0x54, // SLOAD (no callback → returns 0)
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const result = yield* evm.executeAsync({ bytecode }, {})
			expect(result.success).toBe(true)
			expect(bytesToHex(result.output)).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("multiple SLOADs in same execution", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// PUSH1 0x00, SLOAD (slot 0), PUSH1 0x01, SLOAD (slot 1), ADD (not supported)
			// Simpler: just do two SLOADs and return the second one
			// PUSH1 0x00, SLOAD, POP (not supported) → use MSTORE to consume
			// Let's use two SLOADs where the second overwrites:
			// PUSH1 0x00, SLOAD, PUSH1 0x00, MSTORE (store first at mem[0])
			// PUSH1 0x01, SLOAD, PUSH1 0x00, MSTORE (overwrite with second at mem[0])
			// PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([
				0x60,
				0x00, // PUSH1 0x00 (slot 0)
				0x54, // SLOAD
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x01, // PUSH1 0x01 (slot 1)
				0x54, // SLOAD
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE (overwrite)
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const storageMap = new Map<string, Uint8Array>()
			storageMap.set(
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				hexToBytes("0x00000000000000000000000000000000000000000000000000000000000000AA"),
			)
			storageMap.set(
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				hexToBytes("0x00000000000000000000000000000000000000000000000000000000000000BB"),
			)

			let readCount = 0

			const result = yield* evm.executeAsync(
				{ bytecode },
				{
					onStorageRead: (_address, slot) =>
						Effect.sync(() => {
							readCount++
							const key = bytesToHex(slot)
							return storageMap.get(key) ?? new Uint8Array(32)
						}),
				},
			)

			expect(result.success).toBe(true)
			expect(readCount).toBe(2)
			// Last MSTORE wins, which was slot 1 = 0xBB
			expect(bytesToHex(result.output)).toBe("0x00000000000000000000000000000000000000000000000000000000000000bb")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 3: WASM cleanup called on scope close
// ---------------------------------------------------------------------------

describe("EvmWasmService — acquireRelease lifecycle", () => {
	it.effect("cleanup is called when scope closes", () =>
		Effect.gen(function* () {
			const tracker = { cleaned: false }
			const layer = makeEvmWasmTestWithCleanup(tracker)

			// Run within a scope — layer resources are released when scope ends
			yield* Effect.scoped(
				Effect.gen(function* () {
					const evm = yield* EvmWasmService
					const result = yield* evm.execute({ bytecode: new Uint8Array([0x00]) })
					expect(result.success).toBe(true)
					// At this point, cleanup should NOT have been called yet
					expect(tracker.cleaned).toBe(false)
				}).pipe(Effect.provide(layer)),
			)

			// After scope closes, cleanup SHOULD have been called
			expect(tracker.cleaned).toBe(true)
		}),
	)

	it.effect("cleanup is called even if execution fails", () =>
		Effect.gen(function* () {
			const tracker = { cleaned: false }
			const layer = makeEvmWasmTestWithCleanup(tracker)

			yield* Effect.scoped(
				Effect.gen(function* () {
					const evm = yield* EvmWasmService
					// Execute invalid opcode → fails
					const result = yield* evm
						.execute({ bytecode: new Uint8Array([0xff]) })
						.pipe(Effect.catchTag("WasmExecutionError", () => Effect.succeed(null)))
					// Error was caught, result is null
					expect(result).toBe(null)
				}).pipe(Effect.provide(layer)),
			)

			// Cleanup still called
			expect(tracker.cleaned).toBe(true)
		}),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 4: BALANCE opcode triggers async balance read
// ---------------------------------------------------------------------------

describe("EvmWasmService — async execution (balance)", () => {
	it.effect("BALANCE yields, host provides balance, resumes and returns correctly", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			// Bytecode:
			//   PUSH1 0x42   → address (truncated to 20 bytes: 0x0...0042)
			//   BALANCE      → yields, host provides balance
			//   PUSH1 0x00   → memory offset 0
			//   MSTORE       → store at memory[0..32]
			//   PUSH1 0x20   → size 32
			//   PUSH1 0x00   → offset 0
			//   RETURN       → return memory[0..32]
			const bytecode = new Uint8Array([
				0x60,
				0x42, // PUSH1 0x42
				0x31, // BALANCE
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			// Balance: 1 ETH = 1e18 = 0xDE0B6B3A7640000
			const balanceValue = hexToBytes("0x0000000000000000000000000000000000000000000000000DE0B6B3A7640000")

			let balanceReadCalled = false
			let receivedAddress: Uint8Array | null = null

			const result = yield* evm.executeAsync(
				{ bytecode },
				{
					onBalanceRead: (address) =>
						Effect.sync(() => {
							balanceReadCalled = true
							receivedAddress = address
							return balanceValue
						}),
				},
			)

			expect(result.success).toBe(true)
			expect(result.output.length).toBe(32)
			expect(balanceReadCalled).toBe(true)

			// Address should be pad20(0x42) — 20 bytes = 40 hex chars
			expect(bytesToHex(receivedAddress as unknown as Uint8Array)).toBe("0x0000000000000000000000000000000000000042")

			// Output should be the balance
			expect(bytesToHex(result.output)).toBe("0x0000000000000000000000000000000000000000000000000de0b6b3a7640000")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("BALANCE without callback returns zero", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService

			const bytecode = new Uint8Array([
				0x60,
				0x01, // PUSH1 0x01
				0x31, // BALANCE (no callback → returns 0)
				0x60,
				0x00, // PUSH1 0x00
				0x52, // MSTORE
				0x60,
				0x20, // PUSH1 0x20
				0x60,
				0x00, // PUSH1 0x00
				0xf3, // RETURN
			])

			const result = yield* evm.executeAsync({ bytecode }, {})
			expect(result.success).toBe(true)
			expect(bytesToHex(result.output)).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("EvmWasmService — error handling", () => {
	it.effect("unsupported opcode produces WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const result = yield* evm
				.execute({ bytecode: new Uint8Array([0xfe]) }) // INVALID
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("0xfe")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("stack underflow on MSTORE produces WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// MSTORE with empty stack
			const result = yield* evm
				.execute({ bytecode: new Uint8Array([0x52]) })
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("stack underflow")
		}).pipe(Effect.provide(EvmWasmTest)),
	)

	it.effect("truncated PUSH1 produces WasmExecutionError", () =>
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			// PUSH1 without following byte
			const result = yield* evm
				.execute({ bytecode: new Uint8Array([0x60]) })
				.pipe(Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(WasmExecutionError)
			expect((result as WasmExecutionError).message).toContain("unexpected end")
		}).pipe(Effect.provide(EvmWasmTest)),
	)
})

// ---------------------------------------------------------------------------
// Service tag identity
// ---------------------------------------------------------------------------

describe("EvmWasmService — tag", () => {
	it("has correct tag key", () => {
		expect(EvmWasmService.key).toBe("EvmWasm")
	})
})
