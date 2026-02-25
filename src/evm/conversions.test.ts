import { describe, expect, it } from "vitest"
import { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "./conversions.js"

// ---------------------------------------------------------------------------
// bytesToHex
// ---------------------------------------------------------------------------

describe("bytesToHex", () => {
	it("converts zero address to hex", () => {
		const bytes = new Uint8Array(20)
		expect(bytesToHex(bytes)).toBe("0x0000000000000000000000000000000000000000")
	})

	it("converts known address to hex", () => {
		const bytes = new Uint8Array(20)
		bytes[19] = 0x01 // 0x0...01
		expect(bytesToHex(bytes)).toBe("0x0000000000000000000000000000000000000001")
	})

	it("converts 32-byte slot to hex", () => {
		const bytes = new Uint8Array(32)
		bytes[31] = 0xff
		expect(bytesToHex(bytes)).toBe("0x00000000000000000000000000000000000000000000000000000000000000ff")
	})

	it("converts mixed bytes correctly", () => {
		const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
		expect(bytesToHex(bytes)).toBe("0xdeadbeef")
	})

	it("handles empty bytes", () => {
		expect(bytesToHex(new Uint8Array(0))).toBe("0x")
	})

	it("handles single byte", () => {
		expect(bytesToHex(new Uint8Array([0x42]))).toBe("0x42")
	})
})

// ---------------------------------------------------------------------------
// hexToBytes
// ---------------------------------------------------------------------------

describe("hexToBytes", () => {
	it("converts 0x-prefixed hex to bytes", () => {
		const bytes = hexToBytes("0xdeadbeef")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})

	it("converts hex without prefix", () => {
		const bytes = hexToBytes("deadbeef")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})

	it("roundtrips with bytesToHex for address", () => {
		const original = new Uint8Array(20)
		original[0] = 0xab
		original[19] = 0xcd
		const hex = bytesToHex(original)
		const roundtripped = hexToBytes(hex)
		expect(roundtripped).toEqual(original)
	})

	it("roundtrips with bytesToHex for 32-byte slot", () => {
		const original = new Uint8Array(32)
		original[0] = 0x01
		original[31] = 0xff
		const hex = bytesToHex(original)
		const roundtripped = hexToBytes(hex)
		expect(roundtripped).toEqual(original)
	})

	it("throws on odd-length hex", () => {
		expect(() => hexToBytes("0xabc")).toThrow("odd-length hex string")
	})

	it("handles empty hex", () => {
		expect(hexToBytes("0x")).toEqual(new Uint8Array(0))
	})

	it("handles single byte hex", () => {
		expect(hexToBytes("0x42")).toEqual(new Uint8Array([0x42]))
	})
})

// ---------------------------------------------------------------------------
// bigintToBytes32
// ---------------------------------------------------------------------------

describe("bigintToBytes32", () => {
	it("converts 0n to 32 zero bytes", () => {
		const bytes = bigintToBytes32(0n)
		expect(bytes.length).toBe(32)
		expect(bytes.every((b) => b === 0)).toBe(true)
	})

	it("converts 1n correctly", () => {
		const bytes = bigintToBytes32(1n)
		expect(bytes[31]).toBe(1)
		for (let i = 0; i < 31; i++) {
			expect(bytes[i]).toBe(0)
		}
	})

	it("converts 0xff correctly", () => {
		const bytes = bigintToBytes32(0xffn)
		expect(bytes[31]).toBe(0xff)
		for (let i = 0; i < 31; i++) {
			expect(bytes[i]).toBe(0)
		}
	})

	it("converts max uint256 correctly", () => {
		const maxUint256 = 2n ** 256n - 1n
		const bytes = bigintToBytes32(maxUint256)
		expect(bytes.every((b) => b === 0xff)).toBe(true)
	})

	it("treats negative as 0n", () => {
		const bytes = bigintToBytes32(-1n)
		expect(bytes.every((b) => b === 0)).toBe(true)
	})

	it("converts multi-byte value correctly", () => {
		// 0xdeadbeef
		const bytes = bigintToBytes32(0xdeadbeefn)
		expect(bytes[28]).toBe(0xde)
		expect(bytes[29]).toBe(0xad)
		expect(bytes[30]).toBe(0xbe)
		expect(bytes[31]).toBe(0xef)
	})
})

// ---------------------------------------------------------------------------
// bytesToBigint
// ---------------------------------------------------------------------------

describe("bytesToBigint", () => {
	it("converts 32 zero bytes to 0n", () => {
		expect(bytesToBigint(new Uint8Array(32))).toBe(0n)
	})

	it("converts single byte to bigint", () => {
		expect(bytesToBigint(new Uint8Array([0x42]))).toBe(0x42n)
	})

	it("converts empty bytes to 0n", () => {
		expect(bytesToBigint(new Uint8Array(0))).toBe(0n)
	})

	it("roundtrips with bigintToBytes32 for 0n", () => {
		expect(bytesToBigint(bigintToBytes32(0n))).toBe(0n)
	})

	it("roundtrips with bigintToBytes32 for 1n", () => {
		expect(bytesToBigint(bigintToBytes32(1n))).toBe(1n)
	})

	it("roundtrips with bigintToBytes32 for max uint256", () => {
		const maxUint256 = 2n ** 256n - 1n
		expect(bytesToBigint(bigintToBytes32(maxUint256))).toBe(maxUint256)
	})

	it("roundtrips with bigintToBytes32 for 0xdeadbeef", () => {
		const val = 0xdeadbeefn
		expect(bytesToBigint(bigintToBytes32(val))).toBe(val)
	})

	it("roundtrips with bigintToBytes32 for large value", () => {
		const val = 2n ** 128n + 42n
		expect(bytesToBigint(bigintToBytes32(val))).toBe(val)
	})
})
