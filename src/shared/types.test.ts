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
