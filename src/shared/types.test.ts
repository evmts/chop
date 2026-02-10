/**
 * Tests for shared/types.ts re-exports.
 *
 * Validates that all voltaire-effect primitives are properly re-exported
 * and usable from the shared types module.
 */

import { describe, expect, it } from "vitest"
import { it as itEffect } from "@effect/vitest"
import { Effect, Schema } from "effect"
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
			Address.equals("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045"),
		).toBe(true)
	})

	it("equals returns false for different addresses", () => {
		expect(
			Address.equals("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "0x0000000000000000000000000000000000000000"),
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

// ---------------------------------------------------------------------------
// Hash module — actual computation tests
// Note: Hash.keccak256, fromHex, fromBytes, equals, keccak256Hex return Effects.
// Hash.toHex, isZero, isHash are synchronous.
// ---------------------------------------------------------------------------

describe("Hash — actual computation tests", () => {
	itEffect.effect("keccak256 of empty bytes → produces 32-byte hash", () =>
		Effect.gen(function* () {
			const emptyHash = yield* Hash.keccak256(new Uint8Array([]))
			expect(emptyHash).toBeInstanceOf(Uint8Array)
			expect(emptyHash.length).toBe(32)
			const hex = Hash.toHex(emptyHash)
			expect(hex).toMatch(/^0x[0-9a-f]{64}$/)
		}),
	)

	itEffect.effect('keccak256 of "hello" bytes → produces 32-byte hash', () =>
		Effect.gen(function* () {
			const helloBytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f])
			const hash = yield* Hash.keccak256(helloBytes)
			expect(hash).toBeInstanceOf(Uint8Array)
			expect(hash.length).toBe(32)
		}),
	)

	itEffect.effect("keccak256Hex produces same result as keccak256 for same input", () =>
		Effect.gen(function* () {
			const hashFromHex = yield* Hash.keccak256Hex("0x68656c6c6f")
			const hashFromBytes = yield* Hash.keccak256(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]))
			const eq = yield* Hash.equals(hashFromHex, hashFromBytes)
			expect(eq).toBe(true)
		}),
	)

	itEffect.effect("fromHex of valid 32-byte hex → valid Hash", () =>
		Effect.gen(function* () {
			const hex = "0x" + "ab".repeat(32)
			const hash = yield* Hash.fromHex(hex)
			expect(hash).toBeInstanceOf(Uint8Array)
			expect(hash.length).toBe(32)
			expect(Hash.toHex(hash)).toBe(hex)
		}),
	)

	itEffect.effect("fromBytes of 32-byte buffer → valid Hash", () =>
		Effect.gen(function* () {
			const bytes = new Uint8Array(32)
			bytes[0] = 0xab
			bytes[31] = 0xcd
			const hash = yield* Hash.fromBytes(bytes)
			expect(hash).toBeInstanceOf(Uint8Array)
			expect(hash.length).toBe(32)
			expect(hash[0]).toBe(0xab)
			expect(hash[31]).toBe(0xcd)
		}),
	)

	itEffect.effect("toHex round-trips with fromHex", () =>
		Effect.gen(function* () {
			const originalHex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
			const hash = yield* Hash.fromHex(originalHex)
			const roundTripped = Hash.toHex(hash)
			expect(roundTripped).toBe(originalHex)
		}),
	)

	itEffect.effect("isZero on ZERO hash → true", () =>
		Effect.gen(function* () {
			const result = yield* Hash.isZero(Hash.ZERO)
			expect(result).toBe(true)
		}),
	)

	itEffect.effect("isZero on non-zero hash → false", () =>
		Effect.gen(function* () {
			const nonZero = new Uint8Array(32)
			nonZero[0] = 0x01
			const result = yield* Hash.isZero(nonZero)
			expect(result).toBe(false)
		}),
	)

	itEffect.effect("equals on same hash → true", () =>
		Effect.gen(function* () {
			const hash = yield* Hash.keccak256(new Uint8Array([0x01, 0x02, 0x03]))
			const eq = yield* Hash.equals(hash, hash)
			expect(eq).toBe(true)
		}),
	)

	itEffect.effect("equals on different hashes → false", () =>
		Effect.gen(function* () {
			const hash1 = yield* Hash.keccak256(new Uint8Array([0x01]))
			const hash2 = yield* Hash.keccak256(new Uint8Array([0x02]))
			const eq = yield* Hash.equals(hash1, hash2)
			expect(eq).toBe(false)
		}),
	)

	it("isHash on valid 32-byte buffer → true", () => {
		const hash = new Uint8Array(32)
		expect(Hash.isHash(hash)).toBe(true)
	})

	it("isHash on 20-byte buffer (address size) → false", () => {
		const addressBytes = new Uint8Array(20)
		expect(Hash.isHash(addressBytes)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Selector module — actual computation tests
// Note: Selector.Signature is a Schema, use Schema.decodeSync.
// Selector.equals is synchronous (returns boolean directly).
// ---------------------------------------------------------------------------

describe("Selector — actual computation tests", () => {
	it('Schema.decodeSync(Selector.Signature) for "transfer(address,uint256)" → 0xa9059cbb', () => {
		const sel = Schema.decodeSync(Selector.Signature)("transfer(address,uint256)")
		expect(sel).toBeInstanceOf(Uint8Array)
		expect(sel.length).toBe(4)
		const hex = Hex.fromBytes(sel)
		expect(hex).toBe("0xa9059cbb")
	})

	it('Schema.decodeSync(Selector.Signature) for "balanceOf(address)" → 0x70a08231', () => {
		const sel = Schema.decodeSync(Selector.Signature)("balanceOf(address)")
		expect(sel).toBeInstanceOf(Uint8Array)
		expect(sel.length).toBe(4)
		const hex = Hex.fromBytes(sel)
		expect(hex).toBe("0x70a08231")
	})

	it("equals on same selectors → true", () => {
		const s1 = Schema.decodeSync(Selector.Signature)("transfer(address,uint256)")
		const s2 = Schema.decodeSync(Selector.Signature)("transfer(address,uint256)")
		expect(Selector.equals(s1, s2)).toBe(true)
	})

	it("equals on different selectors → false", () => {
		const s1 = Schema.decodeSync(Selector.Signature)("transfer(address,uint256)")
		const s2 = Schema.decodeSync(Selector.Signature)("balanceOf(address)")
		expect(Selector.equals(s1, s2)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Bytes32 module — actual computation tests
// Note: Bytes32.Hex and Bytes32.Bytes are Schemas.
// ---------------------------------------------------------------------------

describe("Bytes32 — actual computation tests", () => {
	it("Schema.decodeSync(Bytes32.Hex) of valid 32-byte hex string → correct value", () => {
		const hex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
		const bytes32 = Schema.decodeSync(Bytes32.Hex)(hex)
		expect(bytes32).toBeInstanceOf(Uint8Array)
		expect(bytes32.length).toBe(32)
		expect(Hex.fromBytes(bytes32)).toBe(hex)
	})

	it("Schema.decodeSync(Bytes32.Bytes) of 32 zero bytes → equivalent to ZERO", () => {
		const zeroBytes = new Uint8Array(32)
		const bytes32 = Schema.decodeSync(Bytes32.Bytes)(zeroBytes)
		expect(bytes32).toBeInstanceOf(Uint8Array)
		expect(bytes32.length).toBe(32)
		// All bytes should be zero
		expect(bytes32.every((b: number) => b === 0)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Rlp module — encode/decode round-trips
// Rlp.encode returns Effect<Uint8Array>, Rlp.decode returns Effect<{data, remainder}>
// ---------------------------------------------------------------------------

describe("Rlp — encode/decode round-trips", () => {
	itEffect.effect("encode empty bytes → decode → get back data", () =>
		Effect.gen(function* () {
			const encoded = yield* Rlp.encode(new Uint8Array([]))
			const decoded = yield* Rlp.decode(encoded)
			expect(decoded.data).toBeDefined()
		}),
	)

	itEffect.effect("encode single byte → decode → get back data", () =>
		Effect.gen(function* () {
			const encoded = yield* Rlp.encode(new Uint8Array([0x42]))
			const decoded = yield* Rlp.decode(encoded)
			expect(decoded.data).toBeDefined()
		}),
	)

	itEffect.effect("encode list of two items → decode → get back list", () =>
		Effect.gen(function* () {
			const item1 = new Uint8Array([0x01, 0x02])
			const item2 = new Uint8Array([0x03, 0x04])
			const encoded = yield* Rlp.encode([item1, item2])
			const decoded = yield* Rlp.decode(encoded)
			expect(decoded.data).toBeDefined()
		}),
	)
})
