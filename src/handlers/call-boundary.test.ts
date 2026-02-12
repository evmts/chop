/**
 * Boundary condition tests for handlers/call.ts.
 *
 * Covers:
 * - callHandler with value parameter
 * - callHandler with contract that uses calldata
 * - callHandler with all parameters set (from, to, data, value, gas)
 * - callHandler with zero gas
 * - buildExecuteParams branch coverage
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { callHandler } from "./call.js"

const CONTRACT_ADDR = `0x${"00".repeat(19)}42`

// ---------------------------------------------------------------------------
// Value parameter — branch coverage
// ---------------------------------------------------------------------------

describe("callHandler — value parameter", () => {
	it.effect("passes value = 0n without error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const data = bytesToHex(new Uint8Array([0x00])) // STOP
			const result = yield* callHandler(node)({ data, value: 0n })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("passes value parameter to execution", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const data = bytesToHex(new Uint8Array([0x00])) // STOP
			const result = yield* callHandler(node)({ data, value: 1000n })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Contract call with calldata — branch coverage
// ---------------------------------------------------------------------------

describe("callHandler — contract with calldata", () => {
	it.effect("passes calldata to contract call", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract code: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			// Call with calldata
			const calldata = bytesToHex(new Uint8Array([0xaa, 0xbb]))
			const result = yield* callHandler(node)({ to: CONTRACT_ADDR, data: calldata })
			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0x42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// All parameters set — buildExecuteParams coverage
// ---------------------------------------------------------------------------

describe("callHandler — all parameters set", () => {
	it.effect("handles all params (from, to, data, value, gas) for contract call", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract code: STOP
			const contractCode = new Uint8Array([0x00])

			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			const result = yield* callHandler(node)({
				to: CONTRACT_ADDR,
				from: `0x${"00".repeat(19)}aa`,
				data: "0xdeadbeef",
				value: 100n,
				gas: 5_000_000n,
			})
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles all params for raw bytecode execution", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const data = bytesToHex(new Uint8Array([0x00])) // STOP

			const result = yield* callHandler(node)({
				data,
				from: `0x${"00".repeat(19)}bb`,
				value: 0n,
				gas: 1_000_000n,
			})
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Gas parameter edge cases
// ---------------------------------------------------------------------------

describe("callHandler — gas edge cases", () => {
	it.effect("uses default gas when not specified", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = yield* callHandler(node)({ data })
			expect(result.success).toBe(true)
			expect(result.gasUsed).toBeGreaterThanOrEqual(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("respects explicit gas limit", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// STOP with very high gas limit
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = yield* callHandler(node)({ data, gas: 100_000_000n })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Contract call — no data for raw execution
// ---------------------------------------------------------------------------

describe("callHandler — data field semantics", () => {
	it.effect("data is treated as calldata when to is set", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract: STOP
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array([0x00]),
			})

			// Data is calldata, not bytecode (because `to` is set)
			const result = yield* callHandler(node)({ to: CONTRACT_ADDR, data: "0x" + "ab".repeat(100) })
			expect(result.success).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("data without to is treated as bytecode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// PUSH1 0x01, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([0x60, 0x01, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			const result = yield* callHandler(node)({ data: bytesToHex(bytecode) })
			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Empty contract code path
// ---------------------------------------------------------------------------

describe("callHandler — empty contract code", () => {
	it.effect("calling address with empty code and data returns empty output", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}ee`

			// Account exists but has no code
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 1n,
				balance: 100n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* callHandler(node)({ to: addr, data: "0xdeadbeef" })
			expect(result.success).toBe(true)
			expect(result.output.length).toBe(0)
			expect(result.gasUsed).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
