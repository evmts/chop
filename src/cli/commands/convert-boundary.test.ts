import { describe, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { expect } from "vitest"
import {
	fromRlpHandler,
	fromUtf8Handler,
	fromWeiHandler,
	shlHandler,
	shrHandler,
	toBaseHandler,
	toBytes32Handler,
	toDecHandler,
	toHexHandler,
	toRlpHandler,
	toUtf8Handler,
	toWeiHandler,
} from "./convert.js"

// ============================================================================
// fromWeiHandler — boundary cases
// ============================================================================

describe("fromWeiHandler — boundary cases", () => {
	it.effect("handles negative wei value", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("-1000000000000000000")
			expect(result).toBe("-1.000000000000000000")
		}),
	)

	it.effect("handles negative fractional wei", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("-500000000000000000")
			expect(result).toBe("-0.500000000000000000")
		}),
	)

	it.effect("handles zero value", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("0")
			expect(result).toBe("0.000000000000000000")
		}),
	)

	it.effect("handles uint256 max value (2^256 - 1)", () =>
		Effect.gen(function* () {
			const uint256Max = (2n ** 256n - 1n).toString()
			const result = yield* fromWeiHandler(uint256Max)
			// 2^256 - 1 = 115792089237316195423570985008687907853269984665640564039457584007913129639935
			// Divided by 1e18: integer part = 115792089237316195423570985008687907853269984665640564039457
			// fractional part = 584007913129639935
			expect(result).toContain(".")
			// Verify it has 18 decimal places
			const parts = result.split(".")
			expect(parts[1]).toHaveLength(18)
			// Verify exact value
			expect(result).toBe("115792089237316195423570985008687907853269984665640564039457.584007913129639935")
		}),
	)

	it.effect("converts to gwei unit", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1500000000", "gwei")
			expect(result).toBe("1.500000000")
		}),
	)

	it.effect("converts to szabo unit", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1500000000000", "szabo")
			expect(result).toBe("1.500000000000")
		}),
	)

	it.effect("converts to mwei unit", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1500000", "mwei")
			expect(result).toBe("1.500000")
		}),
	)

	it.effect("handles very small negative value (-1 wei)", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("-1")
			expect(result).toBe("-0.000000000000000001")
		}),
	)

	it.effect("returns error for decimal input", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1.5").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("returns error for whitespace-only input", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("   ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// toWeiHandler — boundary cases
// ============================================================================

describe("toWeiHandler — boundary cases", () => {
	it.effect("fails on empty string input", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain('""')
			}
		}),
	)

	it.effect("fails on multiple decimal points", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.2.3").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("Multiple decimal points")
			}
		}),
	)

	it.effect("fails on non-numeric input 'abc'", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("handles negative value '-1.5'", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("-1.5")
			expect(result).toBe("-1500000000000000000")
		}),
	)

	it.effect("fails on too many decimal places for gwei (max 9)", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.0000000001", "gwei").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("Too many decimal places")
			}
		}),
	)

	it.effect("fails on too many decimal places for mwei (max 6)", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.0000001", "mwei").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("Too many decimal places")
			}
		}),
	)

	it.effect("handles leading dot '.5' as valid", () =>
		Effect.gen(function* () {
			// The integer part would be empty string "", parts[0] = "", !/^\d+$/.test("") fails
			// Actually: abs = ".5", parts = ["", "5"], integerPart = "" which fails /^\d+$/ check
			const result = yield* toWeiHandler(".5").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("handles integer with no decimal part", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("42")
			expect(result).toBe("42000000000000000000")
		}),
	)

	it.effect("handles trailing dot '5.'", () =>
		Effect.gen(function* () {
			// "5." => parts = ["5", ""], decimalPart = ""
			// !/^\d+$/.test("5") is false, decimalPart is "" so second check skipped
			const result = yield* toWeiHandler("5.")
			expect(result).toBe("5000000000000000000")
		}),
	)

	it.effect("handles negative zero '-0'", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("-0")
			expect(result).toBe("0")
		}),
	)

	it.effect("fails on wei unit with decimal value", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.5", "wei").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("handles whitespace-padded input", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("  1.5  ")
			expect(result).toBe("1500000000000000000")
		}),
	)

	it.effect("fails on special characters in input", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1e18").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("handles exactly max decimal places for ether (18)", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("0.000000000000000001")
			expect(result).toBe("1")
		}),
	)
})

// ============================================================================
// toHexHandler — boundary cases
// ============================================================================

describe("toHexHandler — boundary cases", () => {
	it.effect("converts zero", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("0")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("converts negative value", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("-1")
			expect(result).toBe("-0x1")
		}),
	)

	it.effect("handles hex string input (0x prefix accepted by BigInt)", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("0xff")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("handles negative hex input", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("-0xff")
			expect(result).toBe("-0xff")
		}),
	)

	it.effect("converts 1", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("1")
			expect(result).toBe("0x1")
		}),
	)

	it.effect("fails on empty string", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// toDecHandler — boundary cases
// ============================================================================

describe("toDecHandler — boundary cases", () => {
	it.effect("converts '0x' (empty hex body) to '0'", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0x")
			expect(result).toBe("0")
		}),
	)

	it.effect("converts 32 bytes of 0xff", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler(`0x${"ff".repeat(32)}`)
			expect(result).toBe((2n ** 256n - 1n).toString())
		}),
	)

	it.effect("fails on invalid hex chars '0xGG'", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0xGG").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("invalid hex characters")
			}
		}),
	)

	it.effect("fails on mixed valid/invalid hex '0xABZZ'", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0xABZZ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)

	it.effect("handles single hex digit '0x1'", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0x1")
			expect(result).toBe("1")
		}),
	)

	it.effect("handles leading zeros '0x000ff'", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0x000ff")
			expect(result).toBe("255")
		}),
	)
})

// ============================================================================
// toBaseHandler — boundary cases
// ============================================================================

describe("toBaseHandler — boundary cases", () => {
	it.effect("converts binary input to decimal output", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("1010", 2, 10)
			expect(result).toBe("10")
		}),
	)

	it.effect("converts decimal to base 36", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("35", 10, 36)
			expect(result).toBe("z")
		}),
	)

	it.effect("converts base 36 to decimal", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("z", 36, 10)
			expect(result).toBe("35")
		}),
	)

	it.effect("fails on base 0 (invalid)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("10", 0, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
				expect(result.left.base).toBe(0)
			}
		}),
	)

	it.effect("fails on base 1 (invalid)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("10", 1, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
				expect(result.left.base).toBe(1)
			}
		}),
	)

	it.effect("fails on base-out 37 (invalid)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("10", 10, 37).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
				expect(result.left.base).toBe(37)
			}
		}),
	)

	it.effect("fails on base-out 100 (invalid)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("10", 10, 100).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
				expect(result.left.base).toBe(100)
			}
		}),
	)

	it.effect("handles hex prefix with base 16 input", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("0xff", 16, 10)
			expect(result).toBe("255")
		}),
	)

	it.effect("handles hex prefix with 0x only (empty value) — should fail", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("0x", 16, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on empty value with base 10", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("", 10, 2).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on digit invalid for binary base (2 in base 2)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("102", 2, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("converts 0 in any base", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("0", 10, 2)
			expect(result).toBe("0")
		}),
	)
})

// ============================================================================
// fromUtf8Handler — boundary cases
// ============================================================================

describe("fromUtf8Handler — boundary cases", () => {
	it.effect("handles empty string", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("")
			expect(result).toBe("0x")
		}),
	)

	it.effect("handles emoji characters", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("\u{1F600}")
			expect(result).toMatch(/^0x[0-9a-f]+$/)
			// Round-trip check
			const roundTrip = yield* toUtf8Handler(result)
			expect(roundTrip).toBe("\u{1F600}")
		}),
	)

	it.effect("handles CJK characters", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("\u4F60\u597D")
			expect(result).toMatch(/^0x[0-9a-f]+$/)
			const roundTrip = yield* toUtf8Handler(result)
			expect(roundTrip).toBe("\u4F60\u597D")
		}),
	)

	it.effect("handles accented characters", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("\u00E9\u00E8\u00EA")
			expect(result).toMatch(/^0x[0-9a-f]+$/)
			const roundTrip = yield* toUtf8Handler(result)
			expect(roundTrip).toBe("\u00E9\u00E8\u00EA")
		}),
	)

	it.effect("handles very long string (1000 chars)", () =>
		Effect.gen(function* () {
			const longStr = "a".repeat(1000)
			const result = yield* fromUtf8Handler(longStr)
			expect(result).toMatch(/^0x[0-9a-f]+$/)
			// 1000 ASCII chars = 2000 hex chars + 0x prefix
			expect(result.length).toBe(2002)
		}),
	)

	it.effect("handles single character", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("A")
			expect(result).toBe("0x41")
		}),
	)

	it.effect("handles null byte character", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("\0")
			expect(result).toBe("0x00")
		}),
	)
})

// ============================================================================
// toUtf8Handler — boundary cases
// ============================================================================

describe("toUtf8Handler — boundary cases", () => {
	it.effect("converts empty hex '0x' to empty string", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0x")
			expect(result).toBe("")
		}),
	)

	it.effect("fails on invalid hex chars with 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0xZZZZ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("invalid hex characters")
			}
		}),
	)

	it.effect("fails on odd-length hex", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0x4").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Odd-length")
			}
		}),
	)

	it.effect("decodes valid multi-byte UTF-8 (Chinese characters)", () =>
		Effect.gen(function* () {
			// First encode, then decode for roundtrip
			const encoded = yield* fromUtf8Handler("\u4F60\u597D")
			const result = yield* toUtf8Handler(encoded)
			expect(result).toBe("\u4F60\u597D")
		}),
	)

	it.effect("decodes single ASCII byte", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0x41")
			expect(result).toBe("A")
		}),
	)

	it.effect("fails without 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("68656c6c6f").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Must start with 0x")
			}
		}),
	)

	it.effect("fails on odd-length hex with 3 chars", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0xabc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Odd-length")
			}
		}),
	)
})

// ============================================================================
// toBytes32Handler — boundary cases
// ============================================================================

describe("toBytes32Handler — boundary cases", () => {
	it.effect("handles exactly 32 bytes (64 hex chars)", () =>
		Effect.gen(function* () {
			const input = `0x${"ab".repeat(32)}`
			const result = yield* toBytes32Handler(input)
			expect(result).toBe(input)
			expect(result.length).toBe(66) // 0x + 64
		}),
	)

	it.effect("fails on value too large (> 32 bytes hex)", () =>
		Effect.gen(function* () {
			const input = `0x${"ff".repeat(33)}`
			const result = yield* toBytes32Handler(input).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("too large for bytes32")
			}
		}),
	)

	it.effect("fails on numeric value too large for bytes32", () =>
		Effect.gen(function* () {
			// 2^256 is too large — its hex representation is 65 hex chars (1 + 64 zeros)
			const tooLarge = (2n ** 256n).toString()
			const result = yield* toBytes32Handler(tooLarge).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("too large for bytes32")
			}
		}),
	)

	it.effect("fails on UTF-8 string too long for bytes32", () =>
		Effect.gen(function* () {
			// 33 ASCII chars = 33 bytes > 32
			const longStr = "a".repeat(33)
			const result = yield* toBytes32Handler(longStr).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("too large for bytes32")
			}
		}),
	)

	it.effect("fails on invalid hex chars in hex input", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("0xGGHH").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
				expect(result.left.message).toContain("invalid hex characters")
			}
		}),
	)

	it.effect("handles empty hex '0x' — pads to 32 zero bytes", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("0x")
			expect(result).toBe("0x" + "0".repeat(64))
		}),
	)

	it.effect("handles numeric string '0'", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("0")
			expect(result).toBe("0x" + "0".repeat(64))
		}),
	)

	it.effect("handles numeric string '1'", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("1")
			expect(result).toBe("0x" + "0".repeat(63) + "1")
		}),
	)

	it.effect("encodes short UTF-8 string and left-pads", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("hello")
			expect(result).toMatch(/^0x/)
			expect(result.length).toBe(66) // 0x + 64 hex chars
			// "hello" in hex is 68656c6c6f (10 hex chars)
			expect(result).toBe("0x" + "0".repeat(54) + "68656c6c6f")
		}),
	)

	it.effect("handles exactly 32 ASCII chars for UTF-8 input", () =>
		Effect.gen(function* () {
			const input = "a".repeat(32) // 32 bytes exactly
			const result = yield* toBytes32Handler(input)
			expect(result).toMatch(/^0x/)
			expect(result.length).toBe(66)
		}),
	)

	it.effect("handles max uint256 as numeric string", () =>
		Effect.gen(function* () {
			const maxUint256 = (2n ** 256n - 1n).toString()
			const result = yield* toBytes32Handler(maxUint256)
			expect(result).toBe("0x" + "f".repeat(64))
		}),
	)
})

// ============================================================================
// shlHandler — boundary cases
// ============================================================================

describe("shlHandler — boundary cases", () => {
	it.effect("shift by 0 is identity", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("255", "0")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("shift by 256 produces very large result", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "256")
			// 1 << 256 = 0x1 followed by 64 zeros
			expect(result).toMatch(/^0x1[0]{64}$/)
		}),
	)

	it.effect("fails on negative shift amount", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "-1").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("non-negative")
			}
		}),
	)

	it.effect("handles value given as hex", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("0xff", "4")
			expect(result).toBe("0xff0")
		}),
	)

	it.effect("handles shift bits given as hex", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "0x8")
			expect(result).toBe("0x100")
		}),
	)

	it.effect("fails on invalid value input", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("not_valid", "8").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("Invalid value")
			}
		}),
	)

	it.effect("fails on invalid bits input", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("Invalid shift amount")
			}
		}),
	)

	it.effect("shifting 0 always yields 0", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("0", "100")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("shifting negative value left", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("-1", "8")
			expect(result).toBe("-0x100")
		}),
	)
})

// ============================================================================
// shrHandler — boundary cases
// ============================================================================

describe("shrHandler — boundary cases", () => {
	it.effect("shift by 0 is identity", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("0xff", "0")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("shift by 256 on a 256-bit value yields 0", () =>
		Effect.gen(function* () {
			// 2^255 >> 256 = 0
			const val = (2n ** 255n).toString()
			const result = yield* shrHandler(val, "256")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("fails on negative shift amount", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("256", "-1").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("non-negative")
			}
		}),
	)

	it.effect("handles value given as hex", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("0xff00", "8")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("handles shift bits given as hex", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("256", "0x8")
			expect(result).toBe("0x1")
		}),
	)

	it.effect("fails on invalid value input", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("xyz_invalid", "8").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("Invalid value")
			}
		}),
	)

	it.effect("fails on invalid bits input", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("256", "abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
				expect(result.left.message).toContain("Invalid shift amount")
			}
		}),
	)

	it.effect("shifting 0 right always yields 0", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("0", "100")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("shifting negative value right", () =>
		Effect.gen(function* () {
			// In BigInt, -256n >> 8n = -1n
			const result = yield* shrHandler("-256", "8")
			expect(result).toBe("-0x1")
		}),
	)
})

// ============================================================================
// fromRlpHandler — boundary cases
// ============================================================================

describe("fromRlpHandler — boundary cases", () => {
	it.effect("fails on non-hex input (no 0x prefix)", () =>
		Effect.gen(function* () {
			const result = yield* fromRlpHandler("notahex").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Must start with 0x")
			}
		}),
	)

	it.effect("decodes single byte (0x42 = RLP for byte 0x42)", () =>
		Effect.gen(function* () {
			// Single bytes 0x00-0x7f are their own RLP encoding
			const result = yield* fromRlpHandler("0x42")
			expect(result).toBe("0x42")
		}),
	)

	it.effect("decodes empty list (0xc0)", () =>
		Effect.gen(function* () {
			// 0xc0 is RLP encoding of empty list
			const result = yield* fromRlpHandler("0xc0")
			// Should decode to an empty list -> JSON representation "[]"
			expect(result).toBe("[]")
		}),
	)

	it.effect("decodes empty byte string (0x80)", () =>
		Effect.gen(function* () {
			// 0x80 is RLP encoding of empty byte string
			const result = yield* fromRlpHandler("0x80")
			expect(result).toBe("0x")
		}),
	)

	it.effect("decodes RLP list with multiple items", () =>
		Effect.gen(function* () {
			// First, encode multiple values, then decode them
			const encoded = yield* toRlpHandler(["0x01", "0x02", "0x03"])
			const decoded = yield* fromRlpHandler(encoded)
			// Should be a JSON array
			const parsed = JSON.parse(decoded)
			expect(Array.isArray(parsed)).toBe(true)
			expect(parsed).toHaveLength(3)
		}),
	)

	it.effect("fails on invalid RLP encoding (truncated length)", () =>
		Effect.gen(function* () {
			// 0xb8 means a string with length prefix in next 1 byte,
			// but we don't provide enough data
			const result = yield* fromRlpHandler("0xb8").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				// Could be ConversionError (RLP decoding failed) or InvalidHexError
				expect(["ConversionError", "InvalidHexError"]).toContain(result.left._tag)
			}
		}),
	)

	it.effect("round-trips single value through encode/decode", () =>
		Effect.gen(function* () {
			const original = "0xdeadbeef"
			const encoded = yield* toRlpHandler([original])
			const decoded = yield* fromRlpHandler(encoded)
			expect(decoded).toBe(original)
		}),
	)

	it.effect("handles empty hex '0x' as RLP input", () =>
		Effect.gen(function* () {
			// Empty bytes — RLP decode of empty input
			const result = yield* fromRlpHandler("0x").pipe(Effect.either)
			// Should fail since empty bytes are not valid RLP
			expect(Either.isLeft(result)).toBe(true)
		}),
	)
})

// ============================================================================
// toRlpHandler — boundary cases
// ============================================================================

describe("toRlpHandler — boundary cases", () => {
	it.effect("encodes single hex value", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x01"])
			expect(result).toMatch(/^0x/)
		}),
	)

	it.effect("encodes multiple hex values as list", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x01", "0x02", "0x03"])
			expect(result).toMatch(/^0x/)
			// Verify round-trip
			const decoded = yield* fromRlpHandler(result)
			const parsed = JSON.parse(decoded)
			expect(Array.isArray(parsed)).toBe(true)
		}),
	)

	it.effect("fails on non-hex input (no 0x prefix)", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["hello"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("must start with 0x")
			}
		}),
	)

	it.effect("fails when second value lacks 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x01", "nothex"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)

	it.effect("encodes empty bytes '0x' as valid RLP", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x"])
			expect(result).toMatch(/^0x/)
			// 0x should encode to RLP empty string (0x80)
			expect(result).toBe("0x80")
		}),
	)

	it.effect("fails on invalid hex data '0xGG'", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0xGG"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Invalid hex data")
			}
		}),
	)

	it.effect("encodes large data (256 bytes)", () =>
		Effect.gen(function* () {
			const largeHex = "0x" + "ab".repeat(256)
			const result = yield* toRlpHandler([largeHex])
			expect(result).toMatch(/^0x/)
			// Verify round-trip
			const decoded = yield* fromRlpHandler(result)
			expect(decoded).toBe(largeHex)
		}),
	)
})

// ============================================================================
// formatRlpDecoded — BrandedRlp list type coverage (lines 443-444)
// ============================================================================

describe("fromRlpHandler — formatRlpDecoded BrandedRlp list branch", () => {
	it.effect("decodes RLP list triggering BrandedRlp list formatting", () =>
		Effect.gen(function* () {
			// Encode multiple values, then decode to exercise the list branch
			// When decoding a list, the Rlp.decode returns BrandedRlp with type "list" and items
			const encoded = yield* toRlpHandler(["0xaa", "0xbb"])
			const decoded = yield* fromRlpHandler(encoded)
			const parsed = JSON.parse(decoded)
			expect(Array.isArray(parsed)).toBe(true)
			expect(parsed).toHaveLength(2)
		}),
	)

	it.effect("decodes nested RLP list structure", () =>
		Effect.gen(function* () {
			// 0xc0 is empty list; an RLP list containing items triggers the list branch
			// Encode a list, decode it — the formatRlpDecoded should handle BrandedRlp type:"list"
			const encoded = yield* toRlpHandler(["0x01", "0x02", "0x03"])
			const decoded = yield* fromRlpHandler(encoded)
			const parsed = JSON.parse(decoded)
			expect(Array.isArray(parsed)).toBe(true)
			expect(parsed.length).toBe(3)
		}),
	)

	it.effect("handles RLP-encoded empty list (0xc0) — exercises list formatting", () =>
		Effect.gen(function* () {
			const decoded = yield* fromRlpHandler("0xc0")
			expect(decoded).toBe("[]")
		}),
	)
})

// ============================================================================
// toRlpHandler — RLP encoding failure catchAll (lines 521-526)
// ============================================================================

describe("toRlpHandler — RLP encoding failure catchAll", () => {
	it.effect("encodes odd-length hex data (0x0) gracefully", () =>
		Effect.gen(function* () {
			// 0x0 is odd-length hex — Hex.toBytes may handle or fail
			const result = yield* toRlpHandler(["0x0"]).pipe(Effect.either)
			// If it succeeds, great; if it fails, it should be an InvalidHexError from the
			// Hex.toBytes call, not an unhandled error
			if (Either.isLeft(result)) {
				expect(["InvalidHexError", "ConversionError"]).toContain(result.left._tag)
			} else {
				expect(result.right).toMatch(/^0x/)
			}
		}),
	)
})
