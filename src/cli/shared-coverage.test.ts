/**
 * Additional coverage tests for `src/cli/shared.ts`.
 *
 * Covers:
 * - `hexToDecimal` non-string branch (line 65): number, undefined, null inputs
 * - `hexToDecimal` with various hex strings
 * - `validateHexData` error paths and success path
 */

import { describe, it } from "@effect/vitest"
import { Data, Effect } from "effect"
import { expect } from "vitest"
import { hexToDecimal, validateHexData } from "./shared.js"

// ---------------------------------------------------------------------------
// Error constructor for validateHexData tests
// ---------------------------------------------------------------------------

class HexValidationError extends Data.TaggedError("HexValidationError")<{
	readonly message: string
	readonly data: string
}> {}

const mkError = (message: string, data: string) => new HexValidationError({ message, data })

// ---------------------------------------------------------------------------
// hexToDecimal — non-string branch (line 65 coverage)
// ---------------------------------------------------------------------------

describe("hexToDecimal — non-string branch", () => {
	it("returns String(input) for number input", () => {
		const result = hexToDecimal(42)
		expect(result).toBe("42")
	})

	it("returns String(input) for undefined input", () => {
		const result = hexToDecimal(undefined)
		expect(result).toBe("undefined")
	})

	it("returns String(input) for null input", () => {
		const result = hexToDecimal(null)
		expect(result).toBe("null")
	})

	it("returns String(input) for boolean input", () => {
		expect(hexToDecimal(true)).toBe("true")
		expect(hexToDecimal(false)).toBe("false")
	})

	it("returns String(input) for bigint input", () => {
		const result = hexToDecimal(999n)
		expect(result).toBe("999")
	})
})

// ---------------------------------------------------------------------------
// hexToDecimal — string branch (BigInt-compatible hex strings)
// ---------------------------------------------------------------------------

describe("hexToDecimal — string branch", () => {
	it("converts '0x0' to '0'", () => {
		expect(hexToDecimal("0x0")).toBe("0")
	})

	it("converts '0xff' to '255'", () => {
		expect(hexToDecimal("0xff")).toBe("255")
	})

	it("converts '0x10000' to '65536'", () => {
		expect(hexToDecimal("0x10000")).toBe("65536")
	})

	it("converts '0x1' to '1'", () => {
		expect(hexToDecimal("0x1")).toBe("1")
	})

	it("converts '0x7a69' (31337) correctly", () => {
		expect(hexToDecimal("0x7a69")).toBe("31337")
	})
})

// ---------------------------------------------------------------------------
// validateHexData — error paths
// ---------------------------------------------------------------------------

describe("validateHexData — error paths", () => {
	it.effect("rejects data missing '0x' prefix", () =>
		Effect.gen(function* () {
			const err = yield* Effect.flip(validateHexData("deadbeef", mkError))
			expect(err).toBeInstanceOf(HexValidationError)
			expect(err.message).toContain("must start with 0x")
			expect(err.data).toBe("deadbeef")
		}),
	)

	it.effect("rejects data with invalid hex characters", () =>
		Effect.gen(function* () {
			const err = yield* Effect.flip(validateHexData("0xZZZZ", mkError))
			expect(err).toBeInstanceOf(HexValidationError)
			expect(err.message).toContain("Invalid hex characters")
			expect(err.data).toBe("0xZZZZ")
		}),
	)

	it.effect("rejects odd-length hex string", () =>
		Effect.gen(function* () {
			const err = yield* Effect.flip(validateHexData("0xabc", mkError))
			expect(err).toBeInstanceOf(HexValidationError)
			expect(err.message).toContain("Odd-length hex string")
			expect(err.data).toBe("0xabc")
		}),
	)
})

// ---------------------------------------------------------------------------
// validateHexData — success path
// ---------------------------------------------------------------------------

describe("validateHexData — success path", () => {
	it.effect("parses valid hex '0xdeadbeef' to correct bytes", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xdeadbeef", mkError)
			expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
		}),
	)

	it.effect("parses valid empty hex '0x' to empty Uint8Array", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0x", mkError)
			expect(result).toEqual(new Uint8Array([]))
		}),
	)

	it.effect("parses valid '0x0102' to [1, 2]", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0x0102", mkError)
			expect(result).toEqual(new Uint8Array([0x01, 0x02]))
		}),
	)
})
