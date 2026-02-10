/**
 * Tests for shared/types.ts re-exports.
 *
 * Validates that all voltaire-effect primitives are properly re-exported
 * and usable from the shared types module.
 */

import { describe, expect, it } from "vitest"
import { Abi, Address, Bytes32, Hash, Hex, Rlp, Selector, Signature } from "./types.js"

describe("shared/types re-exports", () => {
	it("Hex module is re-exported and functional", () => {
		const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
		const hex = Hex.fromBytes(bytes)
		expect(hex).toBe("0xdeadbeef")
	})

	it("Hex.toBytes converts hex string to bytes", () => {
		const bytes = Hex.toBytes("0xdeadbeef")
		expect(bytes).toBeInstanceOf(Uint8Array)
		expect(bytes.length).toBe(4)
		expect(bytes[0]).toBe(0xde)
		expect(bytes[3]).toBe(0xef)
	})

	it("Hex round-trips bytes -> hex -> bytes", () => {
		const original = new Uint8Array([0x01, 0x02, 0x03, 0xff])
		const hex = Hex.fromBytes(original)
		const roundTripped = Hex.toBytes(hex)
		expect(roundTripped).toEqual(original)
	})

	it("Address module is re-exported", () => {
		expect(Address).toBeDefined()
		expect(typeof Address).toBe("object")
	})

	it("Hash module is re-exported", () => {
		expect(Hash).toBeDefined()
		expect(typeof Hash).toBe("object")
	})

	it("Bytes32 module is re-exported", () => {
		expect(Bytes32).toBeDefined()
		expect(typeof Bytes32).toBe("object")
	})

	it("Selector module is re-exported", () => {
		expect(Selector).toBeDefined()
		expect(typeof Selector).toBe("object")
	})

	it("Signature module is re-exported", () => {
		expect(Signature).toBeDefined()
		expect(typeof Signature).toBe("object")
	})

	it("Abi module is re-exported", () => {
		expect(Abi).toBeDefined()
		expect(typeof Abi).toBe("object")
	})

	it("Rlp module is re-exported", () => {
		expect(Rlp).toBeDefined()
		expect(typeof Rlp).toBe("object")
	})
})

describe("Hex — edge cases", () => {
	it("handles empty bytes", () => {
		const hex = Hex.fromBytes(new Uint8Array([]))
		expect(hex).toBe("0x")
	})

	it("handles single byte", () => {
		const hex = Hex.fromBytes(new Uint8Array([0x00]))
		expect(hex).toBe("0x00")
	})

	it("handles all-zeros 32 bytes", () => {
		const bytes = new Uint8Array(32)
		const hex = Hex.fromBytes(bytes)
		expect(hex).toBe(`0x${"00".repeat(32)}`)
	})

	it("handles all-ff 20 bytes (max address)", () => {
		const bytes = new Uint8Array(20).fill(0xff)
		const hex = Hex.fromBytes(bytes)
		expect(hex).toBe(`0x${"ff".repeat(20)}`)
	})

	it("handles uppercase hex in toBytes", () => {
		const bytes = Hex.toBytes("0xDEADBEEF")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})

	it("handles mixed case hex in toBytes", () => {
		const bytes = Hex.toBytes("0xDeAdBeEf")
		expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
	})
})

// ---------------------------------------------------------------------------
// Address module — functional tests
// ---------------------------------------------------------------------------

describe("Address — functional tests", () => {
	it("validates a correct lowercase address", () => {
		expect(Address.isValid("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(true)
	})

	it("validates a correct checksummed address", () => {
		expect(Address.isValid("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true)
	})

	it("validates zero address", () => {
		expect(Address.isValid("0x0000000000000000000000000000000000000000")).toBe(true)
	})

	it("validates max address (all ff)", () => {
		expect(Address.isValid("0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF")).toBe(true)
	})

	it("rejects too-short address", () => {
		expect(Address.isValid("0x1234")).toBe(false)
	})

	it("rejects too-long address", () => {
		expect(Address.isValid("0x" + "aa".repeat(21))).toBe(false)
	})

	it("accepts address without 0x prefix (voltaire-effect is lenient)", () => {
		// voltaire-effect Address.isValid accepts hex strings without 0x prefix
		expect(Address.isValid("d8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true)
	})

	it("rejects empty string", () => {
		expect(Address.isValid("")).toBe(false)
	})

	it("rejects non-hex characters", () => {
		expect(Address.isValid("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false)
	})

	it("ZERO_ADDRESS constant is valid", () => {
		expect(Address.isValid(Address.ZERO_ADDRESS)).toBe(true)
		expect(Address.ZERO_ADDRESS).toBe("0x0000000000000000000000000000000000000000")
	})

	it("equals compares addresses case-insensitively", () => {
		expect(
			Address.equals(
				"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				"0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045",
			),
		).toBe(true)
	})

	it("equals returns false for different addresses", () => {
		expect(
			Address.equals(
				"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				"0x0000000000000000000000000000000000000000",
			),
		).toBe(false)
	})

	it("equals with same lowercase addresses", () => {
		const addr = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
		expect(Address.equals(addr, addr)).toBe(true)
	})

	it("isAddress works as alias for validation", () => {
		expect(typeof Address.isAddress).toBe("function")
		expect(Address.isAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(true)
		expect(Address.isAddress("not-an-address")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Hash module — functional tests
// ---------------------------------------------------------------------------

describe("Hash — functional tests", () => {
	it("ZERO is a 32-byte Uint8Array of all zeros", () => {
		expect(Hash.ZERO).toBeInstanceOf(Uint8Array)
		expect(Hash.ZERO.length).toBe(32)
		expect(Hash.ZERO.every((b: number) => b === 0)).toBe(true)
	})

	it("SIZE constant is 32", () => {
		expect(Hash.SIZE).toBe(32)
	})

	it("fromHex function is available", () => {
		expect(typeof Hash.fromHex).toBe("function")
	})

	it("fromBytes function is available", () => {
		expect(typeof Hash.fromBytes).toBe("function")
	})

	it("keccak256 function is available", () => {
		expect(typeof Hash.keccak256).toBe("function")
	})

	it("keccak256Hex function is available", () => {
		expect(typeof Hash.keccak256Hex).toBe("function")
	})

	it("equals function is available", () => {
		expect(typeof Hash.equals).toBe("function")
	})

	it("toHex function is available", () => {
		expect(typeof Hash.toHex).toBe("function")
	})

	it("toBytes function is available", () => {
		expect(typeof Hash.toBytes).toBe("function")
	})

	it("isZero function is available", () => {
		expect(typeof Hash.isZero).toBe("function")
	})

	it("isHash function is available", () => {
		expect(typeof Hash.isHash).toBe("function")
	})
})

// ---------------------------------------------------------------------------
// Selector module — functional tests
// ---------------------------------------------------------------------------

describe("Selector — functional tests", () => {
	it("Hex function is available", () => {
		expect(typeof Selector.Hex).toBe("function")
	})

	it("Bytes function is available", () => {
		expect(typeof Selector.Bytes).toBe("function")
	})

	it("Signature function is available", () => {
		expect(typeof Selector.Signature).toBe("function")
	})

	it("equals function is available", () => {
		expect(typeof Selector.equals).toBe("function")
	})
})

// ---------------------------------------------------------------------------
// Bytes32 module — functional tests
// ---------------------------------------------------------------------------

describe("Bytes32 — functional tests", () => {
	it("Hex function is available", () => {
		expect(typeof Bytes32.Hex).toBe("function")
	})

	it("Bytes function is available", () => {
		expect(typeof Bytes32.Bytes).toBe("function")
	})
})

// ---------------------------------------------------------------------------
// Rlp module — functional tests
// ---------------------------------------------------------------------------

describe("Rlp — functional tests", () => {
	it("encode function is available", () => {
		expect(typeof Rlp.encode).toBe("function")
	})

	it("decode function is available", () => {
		expect(typeof Rlp.decode).toBe("function")
	})

	it("encode returns an Effect (lazy computation)", () => {
		const result = Rlp.encode(new Uint8Array([]))
		// voltaire-effect Rlp.encode returns an Effect
		expect(result).toBeDefined()
		expect(typeof result).toBe("object")
	})
})

// ---------------------------------------------------------------------------
// Hex — extended edge cases
// ---------------------------------------------------------------------------

describe("Hex — extended edge cases", () => {
	it("fromBytes with large buffer (1024 bytes)", () => {
		const bytes = new Uint8Array(1024).fill(0xab)
		const hex = Hex.fromBytes(bytes)
		expect(hex.length).toBe(2 + 1024 * 2) // 0x + 2048 hex chars
		expect(hex.startsWith("0x")).toBe(true)
	})

	it("toBytes with leading zeros preserves them", () => {
		const bytes = Hex.toBytes("0x000000ff")
		expect(bytes.length).toBe(4)
		expect(bytes[0]).toBe(0x00)
		expect(bytes[1]).toBe(0x00)
		expect(bytes[2]).toBe(0x00)
		expect(bytes[3]).toBe(0xff)
	})

	it("round-trips 20-byte address through hex", () => {
		const addr = new Uint8Array(20)
		addr[19] = 0x01
		const hex = Hex.fromBytes(addr)
		const back = Hex.toBytes(hex)
		expect(back).toEqual(addr)
	})

	it("round-trips 32-byte hash through hex", () => {
		const hash = new Uint8Array(32)
		hash[0] = 0xff
		hash[31] = 0x01
		const hex = Hex.fromBytes(hash)
		const back = Hex.toBytes(hex)
		expect(back).toEqual(hash)
	})

	it("handles maximum single byte", () => {
		expect(Hex.fromBytes(new Uint8Array([0xff]))).toBe("0xff")
	})

	it("handles minimum single byte", () => {
		expect(Hex.fromBytes(new Uint8Array([0x00]))).toBe("0x00")
	})

	it("handles 64-byte buffer (typical signature length)", () => {
		const bytes = new Uint8Array(64).fill(0x42)
		const hex = Hex.fromBytes(bytes)
		expect(hex.length).toBe(2 + 64 * 2)
	})

	it("round-trips a single 0x01 byte", () => {
		const hex = "0x01"
		const bytes = Hex.toBytes(hex)
		expect(bytes.length).toBe(1)
		expect(bytes[0]).toBe(1)
		const back = Hex.fromBytes(bytes)
		expect(back).toBe(hex)
	})
})
