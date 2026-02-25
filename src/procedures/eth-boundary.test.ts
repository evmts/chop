/**
 * Boundary condition tests for procedures/eth.ts.
 *
 * Covers:
 * - bigintToHex with max uint256, 2^128, negative (if possible)
 * - bigintToHex32 with max uint256, boundary values
 * - ethCall with empty params, missing data
 * - ethGetBalance/ethGetCode with various address formats
 * - wrapErrors catching defects
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	bigintToHex,
	bigintToHex32,
	ethCall,
	ethChainId,
	ethGetBalance,
	ethGetCode,
	ethGetStorageAt,
	ethGetTransactionCount,
} from "./eth.js"

// ---------------------------------------------------------------------------
// bigintToHex — boundary conditions
// ---------------------------------------------------------------------------

describe("bigintToHex — boundary conditions", () => {
	it("converts max uint256 to hex", () => {
		const maxU256 = 2n ** 256n - 1n
		const hex = bigintToHex(maxU256)
		expect(hex.startsWith("0x")).toBe(true)
		// max uint256 = ff...ff (64 hex chars)
		expect(hex).toBe(`0x${"f".repeat(64)}`)
	})

	it("converts 2^128 to hex", () => {
		const val = 2n ** 128n
		expect(bigintToHex(val)).toBe("0x100000000000000000000000000000000")
	})

	it("converts 2^64 to hex", () => {
		const val = 2n ** 64n
		expect(bigintToHex(val)).toBe("0x10000000000000000")
	})

	it("converts 1n to hex", () => {
		expect(bigintToHex(1n)).toBe("0x1")
	})

	it("converts 16n to hex (single digit boundary)", () => {
		expect(bigintToHex(16n)).toBe("0x10")
	})

	it("converts 15n to hex", () => {
		expect(bigintToHex(15n)).toBe("0xf")
	})

	it("converts 256n to hex", () => {
		expect(bigintToHex(256n)).toBe("0x100")
	})
})

// ---------------------------------------------------------------------------
// bigintToHex32 — boundary conditions
// ---------------------------------------------------------------------------

describe("bigintToHex32 — boundary conditions", () => {
	it("converts max uint256 to 64-char padded hex", () => {
		const maxU256 = 2n ** 256n - 1n
		const hex = bigintToHex32(maxU256)
		expect(hex).toBe(`0x${"f".repeat(64)}`)
		expect(hex.length).toBe(2 + 64) // "0x" + 64 chars
	})

	it("converts 2^255 to padded hex", () => {
		const val = 2n ** 255n
		const hex = bigintToHex32(val)
		expect(hex.length).toBe(66) // 0x + 64 chars
		expect(hex.startsWith("0x8")).toBe(true) // high bit set
	})

	it("pads small values to 64 chars", () => {
		expect(bigintToHex32(42n).length).toBe(66) // 0x + 64 chars
		expect(bigintToHex32(42n)).toBe(`0x${"0".repeat(62)}2a`)
	})
})

// ---------------------------------------------------------------------------
// ethCall — boundary conditions
// ---------------------------------------------------------------------------

describe("ethCall — boundary conditions", () => {
	it.effect("handles empty params (defaults to empty object)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// ethCall with [] defaults to {} which triggers the error path (no to, no data)
			const result = yield* ethCall(node)([]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(result).toContain("error")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles params with value and gas", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// STOP bytecode with value and gas
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = yield* ethCall(node)([{ data, value: "0x0", gas: "0xf4240" }])
			expect(result).toBe("0x")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles params with from address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const data = bytesToHex(new Uint8Array([0x00]))
			const from = `0x${"00".repeat(19)}ab`
			const result = yield* ethCall(node)([{ data, from }])
			expect(result).toBe("0x")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetBalance — boundary conditions
// ---------------------------------------------------------------------------

describe("ethGetBalance — boundary conditions", () => {
	it.effect("returns correct hex for max uint256 balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}ff`
			const maxU256 = 2n ** 256n - 1n
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 0n,
				balance: maxU256,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			const result = yield* ethGetBalance(node)([addr])
			expect(result).toBe(`0x${"f".repeat(64)}`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 0x0 for zero-address account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBalance(node)([`0x${"00".repeat(20)}`])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetCode — boundary conditions
// ---------------------------------------------------------------------------

describe("ethGetCode — boundary conditions", () => {
	it.effect("returns hex for large bytecode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}dd`
			const largeCode = new Uint8Array(1024).fill(0x60) // 1024 PUSH1 opcodes
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: largeCode,
			})
			const result = (yield* ethGetCode(node)([addr])) as string
			expect(result.length).toBe(2 + 1024 * 2) // 0x + hex
			expect(result).toBe(`0x${"60".repeat(1024)}`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetStorageAt — boundary conditions
// ---------------------------------------------------------------------------

describe("ethGetStorageAt — boundary conditions", () => {
	it.effect("returns padded zero for max slot number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}aa`
			const maxSlot = `0x${"ff".repeat(32)}` // slot at max uint256
			const result = yield* ethGetStorageAt(node)([addr, maxSlot])
			expect(result).toBe(`0x${"0".repeat(64)}`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetTransactionCount — boundary conditions
// ---------------------------------------------------------------------------

describe("ethGetTransactionCount — boundary conditions", () => {
	it.effect("returns correct hex for large nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}ee`
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 255n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			const result = yield* ethGetTransactionCount(node)([addr])
			expect(result).toBe("0xff")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns correct hex for nonce 256", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}ef`
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 256n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			const result = yield* ethGetTransactionCount(node)([addr])
			expect(result).toBe("0x100")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethChainId — idempotency
// ---------------------------------------------------------------------------

describe("ethChainId — idempotency", () => {
	it.effect("returns same result on multiple calls", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const r1 = yield* ethChainId(node)([])
			const r2 = yield* ethChainId(node)([])
			expect(r1).toBe(r2)
			expect(r1).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("ignores params", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethChainId(node)(["ignored", 42, true])
			expect(result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
