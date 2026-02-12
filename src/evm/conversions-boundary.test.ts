/**
 * Boundary condition tests for evm/conversions.ts.
 *
 * Covers:
 * - hexToBytes with invalid hex characters (NaN from parseInt)
 * - hexToBytes with uppercase/mixed case
 * - hexToBytes with very long input
 * - bigintToBytes32 overflow (> 256 bits)
 * - bytesToBigint with non-32-byte inputs
 * - bytesToHex with all 0xFF bytes
 */

import { describe, expect, it } from "vitest"
import { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "./conversions.js"

// ---------------------------------------------------------------------------
// hexToBytes — boundary conditions
// ---------------------------------------------------------------------------

describe("hexToBytes — boundary conditions", () => {
	it("produces NaN bytes for invalid hex characters (gg)", () => {
		// parseInt("gg", 16) returns NaN, Number.parseInt returns NaN → 0 via Uint8Array
		const bytes = hexToBytes("0xgggg")
		// Uint8Array will clamp NaN to 0
		expect(bytes.length).toBe(2)
		expect(bytes[0]).toBe(0) // NaN → 0
		expect(bytes[1]).toBe(0) // NaN → 0
	})

	it("handles uppercase hex correctly", () => {
		const bytes = hexToBytes("0xDEADBEEF")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})

	it("handles mixed case hex correctly", () => {
		const bytes = hexToBytes("0xDeAdBeEf")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})

	it("handles very long hex string (256 bytes)", () => {
		const hex = `0x${"ab".repeat(256)}`
		const bytes = hexToBytes(hex)
		expect(bytes.length).toBe(256)
		expect(bytes.every((b) => b === 0xab)).toBe(true)
	})

	it("handles hex with leading zeros", () => {
		const bytes = hexToBytes("0x0001")
		expect(bytes).toEqual(new Uint8Array([0x00, 0x01]))
	})

	it("handles all-zero hex", () => {
		const bytes = hexToBytes("0x" + "00".repeat(32))
		expect(bytes.length).toBe(32)
		expect(bytes.every((b) => b === 0)).toBe(true)
	})

	it("handles all-ff hex", () => {
		const bytes = hexToBytes("0x" + "ff".repeat(20))
		expect(bytes.length).toBe(20)
		expect(bytes.every((b) => b === 0xff)).toBe(true)
	})

	it("throws ConversionError on odd-length with prefix", () => {
		expect(() => hexToBytes("0xa")).toThrow("odd-length hex string")
	})

	it("throws ConversionError on odd-length without prefix", () => {
		expect(() => hexToBytes("abc")).toThrow("odd-length hex string")
	})

	it("does not throw on empty string without prefix", () => {
		const bytes = hexToBytes("")
		expect(bytes.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// bigintToBytes32 — boundary conditions
// ---------------------------------------------------------------------------

describe("bigintToBytes32 — boundary conditions", () => {
	it("handles value exactly at 2^256 (overflow wraps)", () => {
		// 2^256 should overflow — only lower 256 bits used
		const overflow = 2n ** 256n
		const bytes = bigintToBytes32(overflow)
		// After shifting 256 bits, all bytes should be 0 since only lower 256 bits are extracted
		expect(bytes.length).toBe(32)
		// 2^256 in 32 bytes: the loop only extracts the lower 256 bits
		// 2^256 & 0xff = 0 for all bytes since 2^256 has a 1 in bit 256 which is beyond 32 bytes
		expect(bytes.every((b) => b === 0)).toBe(true)
	})

	it("handles 2^256 + 1 (overflow)", () => {
		const overflow = 2n ** 256n + 1n
		const bytes = bigintToBytes32(overflow)
		// Only lower 256 bits = 1
		expect(bytes[31]).toBe(1)
		expect(bytes.slice(0, 31).every((b) => b === 0)).toBe(true)
	})

	it("handles negative values (clamps to 0)", () => {
		expect(bigintToBytes32(-100n).every((b) => b === 0)).toBe(true)
	})

	it("handles 2^255 (high bit set)", () => {
		const val = 2n ** 255n
		const bytes = bigintToBytes32(val)
		expect(bytes[0]).toBe(0x80) // high bit set
		expect(bytes.slice(1).every((b) => b === 0)).toBe(true)
	})

	it("handles 2^8 - 1 (single byte max)", () => {
		const bytes = bigintToBytes32(255n)
		expect(bytes[31]).toBe(255)
		expect(bytes.slice(0, 31).every((b) => b === 0)).toBe(true)
	})

	it("handles 2^8 (two bytes)", () => {
		const bytes = bigintToBytes32(256n)
		expect(bytes[30]).toBe(1)
		expect(bytes[31]).toBe(0)
	})

	it("handles 2^128 (exactly half of uint256)", () => {
		const val = 2n ** 128n
		const bytes = bigintToBytes32(val)
		// 2^128 in big-endian 32 bytes:
		// Loop fills from byte[31] back: bytes[31..16] = 0, bytes[15] = 1, bytes[14..0] = 0
		expect(bytes[15]).toBe(1)
		expect(bytes.slice(0, 15).every((b) => b === 0)).toBe(true)
		expect(bytes.slice(16).every((b) => b === 0)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// bytesToBigint — boundary conditions
// ---------------------------------------------------------------------------

describe("bytesToBigint — boundary conditions", () => {
	it("converts single 0xFF byte to 255n", () => {
		expect(bytesToBigint(new Uint8Array([0xff]))).toBe(255n)
	})

	it("converts two bytes (big-endian) correctly", () => {
		expect(bytesToBigint(new Uint8Array([0x01, 0x00]))).toBe(256n)
	})

	it("handles very large input (64 bytes)", () => {
		const bytes = new Uint8Array(64)
		bytes[0] = 1
		const result = bytesToBigint(bytes)
		expect(result).toBe(2n ** 504n) // 1 in first byte of 64 bytes
	})

	it("converts max uint256 from all-ff 32 bytes", () => {
		const bytes = new Uint8Array(32).fill(0xff)
		const result = bytesToBigint(bytes)
		expect(result).toBe(2n ** 256n - 1n)
	})

	it("handles single zero byte", () => {
		expect(bytesToBigint(new Uint8Array([0]))).toBe(0n)
	})

	it("handles leading zero bytes", () => {
		const bytes = new Uint8Array([0, 0, 0, 1])
		expect(bytesToBigint(bytes)).toBe(1n)
	})
})

// ---------------------------------------------------------------------------
// bytesToHex — boundary conditions
// ---------------------------------------------------------------------------

describe("bytesToHex — boundary conditions", () => {
	it("handles all 0xFF bytes (max address)", () => {
		const bytes = new Uint8Array(20).fill(0xff)
		expect(bytesToHex(bytes)).toBe("0x" + "ff".repeat(20))
	})

	it("handles alternating bytes", () => {
		const bytes = new Uint8Array([0x0f, 0xf0, 0x0f, 0xf0])
		expect(bytesToHex(bytes)).toBe("0x0ff00ff0")
	})

	it("handles single 0x00 byte", () => {
		expect(bytesToHex(new Uint8Array([0x00]))).toBe("0x00")
	})

	it("handles 32-byte value with only first byte set", () => {
		const bytes = new Uint8Array(32)
		bytes[0] = 0xff
		expect(bytesToHex(bytes)).toBe("0xff" + "00".repeat(31))
	})

	it("handles 1024-byte buffer", () => {
		const bytes = new Uint8Array(1024).fill(0xab)
		const hex = bytesToHex(bytes)
		expect(hex.length).toBe(2 + 1024 * 2) // "0x" + 2048 hex chars
		expect(hex).toBe("0x" + "ab".repeat(1024))
	})
})

// ---------------------------------------------------------------------------
// Round-trip — comprehensive
// ---------------------------------------------------------------------------

describe("conversions — round-trip comprehensive", () => {
	it("bigintToBytes32 → bytesToBigint for 2^255-1", () => {
		const val = 2n ** 255n - 1n
		expect(bytesToBigint(bigintToBytes32(val))).toBe(val)
	})

	it("bigintToBytes32 → bytesToBigint for 2^128-1", () => {
		const val = 2n ** 128n - 1n
		expect(bytesToBigint(bigintToBytes32(val))).toBe(val)
	})

	it("bigintToBytes32 → bytesToBigint for 2^64-1", () => {
		const val = 2n ** 64n - 1n
		expect(bytesToBigint(bigintToBytes32(val))).toBe(val)
	})

	it("hexToBytes → bytesToHex for 20-byte address", () => {
		const hex = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
		expect(bytesToHex(hexToBytes(hex))).toBe(hex)
	})

	it("hexToBytes → bytesToHex for 32-byte hash", () => {
		const hex = "0x" + "ab".repeat(32)
		expect(bytesToHex(hexToBytes(hex))).toBe(hex)
	})

	it("bytesToHex → hexToBytes → bytesToHex preserves value", () => {
		const original = new Uint8Array([0x00, 0x01, 0xfe, 0xff])
		const hex = bytesToHex(original)
		const bytes = hexToBytes(hex)
		expect(bytesToHex(bytes)).toBe(hex)
	})
})
