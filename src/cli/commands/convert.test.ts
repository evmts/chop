import { describe, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { expect } from "vitest"
import { runCli } from "../test-helpers.js"
import {
	ConversionError,
	InvalidBaseError,
	InvalidHexError,
	InvalidNumberError,
	convertCommands,
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
// Error Types
// ============================================================================

describe("ConversionError", () => {
	it("has correct tag and fields", () => {
		const error = new ConversionError({ message: "test error" })
		expect(error._tag).toBe("ConversionError")
		expect(error.message).toBe("test error")
	})

	it("preserves cause", () => {
		const cause = new Error("original")
		const error = new ConversionError({ message: "wrapped", cause })
		expect(error.cause).toBe(cause)
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ConversionError({ message: "boom" })).pipe(
				Effect.catchTag("ConversionError", (e) => Effect.succeed(`caught: ${e.message}`)),
			)
			expect(result).toBe("caught: boom")
		}),
	)

	it("structural equality for same fields", () => {
		const a = new ConversionError({ message: "test" })
		const b = new ConversionError({ message: "test" })
		expect(a).toEqual(b)
	})
})

describe("InvalidNumberError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidNumberError({ message: "bad number", value: "abc" })
		expect(error._tag).toBe("InvalidNumberError")
		expect(error.message).toBe("bad number")
		expect(error.value).toBe("abc")
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidNumberError({ message: "oops", value: "x" })).pipe(
				Effect.catchTag("InvalidNumberError", (e) => Effect.succeed(e.value)),
			)
			expect(result).toBe("x")
		}),
	)
})

describe("InvalidHexError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidHexError({ message: "bad hex", value: "zzz" })
		expect(error._tag).toBe("InvalidHexError")
		expect(error.message).toBe("bad hex")
		expect(error.value).toBe("zzz")
	})
})

describe("InvalidBaseError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidBaseError({ message: "bad base", base: 99 })
		expect(error._tag).toBe("InvalidBaseError")
		expect(error.message).toBe("bad base")
		expect(error.base).toBe(99)
	})
})

// ============================================================================
// fromWeiHandler
// ============================================================================

describe("fromWeiHandler", () => {
	it.effect("converts 1e18 wei to 1 ether with full precision", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1000000000000000000")
			expect(result).toBe("1.000000000000000000")
		}),
	)

	it.effect("converts 1.5 ether worth of wei", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1500000000000000000")
			expect(result).toBe("1.500000000000000000")
		}),
	)

	it.effect("converts 0 wei", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("0")
			expect(result).toBe("0.000000000000000000")
		}),
	)

	it.effect("converts 1 wei (smallest unit)", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1")
			expect(result).toBe("0.000000000000000001")
		}),
	)

	it.effect("converts to gwei", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1000000000", "gwei")
			expect(result).toBe("1.000000000")
		}),
	)

	it.effect("converts to wei unit (no decimals)", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("42", "wei")
			expect(result).toBe("42")
		}),
	)

	it.effect("handles large numbers", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("123456789012345678901234567890")
			expect(result).toBe("123456789012.345678901234567890")
		}),
	)

	it.effect("fails on invalid number", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on unknown unit", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("1", "bogus").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
			}
		}),
	)

	it.effect("handles negative values", () =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler("-1000000000000000000")
			expect(result).toBe("-1.000000000000000000")
		}),
	)
})

// ============================================================================
// toWeiHandler
// ============================================================================

describe("toWeiHandler", () => {
	it.effect("converts 1.5 ether to wei", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.5")
			expect(result).toBe("1500000000000000000")
		}),
	)

	it.effect("converts 1 ether to wei", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1")
			expect(result).toBe("1000000000000000000")
		}),
	)

	it.effect("converts 0 to 0", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("0")
			expect(result).toBe("0")
		}),
	)

	it.effect("converts smallest fraction to 1 wei", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("0.000000000000000001")
			expect(result).toBe("1")
		}),
	)

	it.effect("converts to gwei", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.5", "gwei")
			expect(result).toBe("1500000000")
		}),
	)

	it.effect("converts with wei unit", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1", "wei")
			expect(result).toBe("1")
		}),
	)

	it.effect("fails on too many decimals", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1.0000000000000000001").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
			}
		}),
	)

	it.effect("fails on invalid number", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on unknown unit", () =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler("1", "bogus").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
			}
		}),
	)
})

// ============================================================================
// toHexHandler
// ============================================================================

describe("toHexHandler", () => {
	it.effect("converts 255 to 0xff", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("255")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("converts 0 to 0x0", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("0")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("converts 16 to 0x10", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("16")
			expect(result).toBe("0x10")
		}),
	)

	it.effect("handles large numbers", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("1000000000000000000")
			expect(result).toBe("0xde0b6b3a7640000")
		}),
	)

	it.effect("fails on non-numeric input", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("abc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on floating point input", () =>
		Effect.gen(function* () {
			const result = yield* toHexHandler("1.5").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// toDecHandler
// ============================================================================

describe("toDecHandler", () => {
	it.effect("converts 0xff to 255", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0xff")
			expect(result).toBe("255")
		}),
	)

	it.effect("converts 0x0 to 0", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0x0")
			expect(result).toBe("0")
		}),
	)

	it.effect("converts 0x10 to 16", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0x10")
			expect(result).toBe("16")
		}),
	)

	it.effect("handles uppercase hex", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0xABCDEF")
			expect(result).toBe("11259375")
		}),
	)

	it.effect("fails without 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("ff").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)

	it.effect("fails on invalid hex characters", () =>
		Effect.gen(function* () {
			const result = yield* toDecHandler("0xGG").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)
})

// ============================================================================
// toBaseHandler
// ============================================================================

describe("toBaseHandler", () => {
	it.effect("converts 255 decimal to binary", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("255", 10, 2)
			expect(result).toBe("11111111")
		}),
	)

	it.effect("converts ff hex to decimal", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("ff", 16, 10)
			expect(result).toBe("255")
		}),
	)

	it.effect("converts binary to hex", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("11111111", 2, 16)
			expect(result).toBe("ff")
		}),
	)

	it.effect("converts decimal to octal", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("255", 10, 8)
			expect(result).toBe("377")
		}),
	)

	it.effect("fails on invalid base-in (0)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("255", 0, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
			}
		}),
	)

	it.effect("fails on invalid base-in (1)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("255", 1, 10).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
			}
		}),
	)

	it.effect("fails on invalid base-out (37)", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("255", 10, 37).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBaseError")
			}
		}),
	)

	it.effect("fails on invalid value for base", () =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler("xyz", 10, 2).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// fromUtf8Handler
// ============================================================================

describe("fromUtf8Handler", () => {
	it.effect("converts 'hello' to hex", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("hello")
			expect(result).toBe("0x68656c6c6f")
		}),
	)

	it.effect("converts empty string to 0x", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("")
			expect(result).toBe("0x")
		}),
	)

	it.effect("handles unicode", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("café")
			expect(result).toMatch(/^0x[0-9a-f]+$/)
		}),
	)

	it.effect("handles special characters", () =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler("Hello, World!")
			expect(result).toMatch(/^0x[0-9a-f]+$/)
		}),
	)
})

// ============================================================================
// toUtf8Handler
// ============================================================================

describe("toUtf8Handler", () => {
	it.effect("converts hex 'hello' back to string", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0x68656c6c6f")
			expect(result).toBe("hello")
		}),
	)

	it.effect("converts 0x to empty string", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0x")
			expect(result).toBe("")
		}),
	)

	it.effect("fails without 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("68656c6c6f").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)

	it.effect("fails on invalid hex chars", () =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler("0xGG").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)
})

// ============================================================================
// toBytes32Handler
// ============================================================================

describe("toBytes32Handler", () => {
	it.effect("pads short hex to 32 bytes", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("0xff")
			expect(result).toBe("0x00000000000000000000000000000000000000000000000000000000000000ff")
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}),
	)

	it.effect("keeps 32-byte hex unchanged", () =>
		Effect.gen(function* () {
			const input = `0x${"ab".repeat(32)}`
			const result = yield* toBytes32Handler(input)
			expect(result).toBe(input)
		}),
	)

	it.effect("converts numeric string to bytes32", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("255")
			expect(result).toBe("0x00000000000000000000000000000000000000000000000000000000000000ff")
		}),
	)

	it.effect("converts 0 to bytes32", () =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler("0x0")
			expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
		}),
	)

	it.effect("fails on value too large for bytes32", () =>
		Effect.gen(function* () {
			const tooLong = `0x${"ff".repeat(33)}`
			const result = yield* toBytes32Handler(tooLong).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ConversionError")
			}
		}),
	)
})

// ============================================================================
// fromRlpHandler
// ============================================================================

describe("fromRlpHandler", () => {
	it.effect("decodes RLP-encoded single byte value", () =>
		Effect.gen(function* () {
			// 0x83 followed by 3 bytes [1,2,3] is RLP for a 3-byte string
			const result = yield* fromRlpHandler("0x83010203")
			// Should decode to hex representation of the bytes
			expect(result).toMatch(/^0x/)
		}),
	)

	it.effect("decodes RLP-encoded single byte (short)", () =>
		Effect.gen(function* () {
			// Single byte 0x42 = "B" - in RLP, single bytes 0x00-0x7f are their own encoding
			const result = yield* fromRlpHandler("0x42")
			expect(result).toBe("0x42")
		}),
	)

	it.effect("fails on invalid hex", () =>
		Effect.gen(function* () {
			const result = yield* fromRlpHandler("notahex").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)
})

// ============================================================================
// toRlpHandler
// ============================================================================

describe("toRlpHandler", () => {
	it.effect("encodes single hex value", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x010203"])
			expect(result).toMatch(/^0x/)
			// Verify round-trip
			const decoded = yield* fromRlpHandler(result)
			expect(decoded).toBe("0x010203")
		}),
	)

	it.effect("encodes multiple hex values as list", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["0x01", "0x02"])
			expect(result).toMatch(/^0x/)
		}),
	)

	it.effect("fails on non-hex value", () =>
		Effect.gen(function* () {
			const result = yield* toRlpHandler(["hello"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
			}
		}),
	)
})

// ============================================================================
// shlHandler
// ============================================================================

describe("shlHandler", () => {
	it.effect("shifts 1 left by 8 bits", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "8")
			expect(result).toBe("0x100")
		}),
	)

	it.effect("shifts 0xff left by 4 bits", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("0xff", "4")
			expect(result).toBe("0xff0")
		}),
	)

	it.effect("shift by 0 is identity", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "0")
			expect(result).toBe("0x1")
		}),
	)

	it.effect("handles large shifts", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "256")
			expect(result).toMatch(/^0x1[0]{64}$/)
		}),
	)

	it.effect("fails on invalid value", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("not_a_number", "8").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on negative shift", () =>
		Effect.gen(function* () {
			const result = yield* shlHandler("1", "-1").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// shrHandler
// ============================================================================

describe("shrHandler", () => {
	it.effect("shifts 256 right by 8 bits", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("256", "8")
			expect(result).toBe("0x1")
		}),
	)

	it.effect("shifts 0xff00 right by 8 bits", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("0xff00", "8")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("shift 1 right by 1 results in 0", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("1", "1")
			expect(result).toBe("0x0")
		}),
	)

	it.effect("shift by 0 is identity", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("255", "0")
			expect(result).toBe("0xff")
		}),
	)

	it.effect("fails on invalid value", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("xyz", "8").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)

	it.effect("fails on negative shift", () =>
		Effect.gen(function* () {
			const result = yield* shrHandler("256", "-1").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidNumberError")
			}
		}),
	)
})

// ============================================================================
// Command Registration
// ============================================================================

describe("convertCommands", () => {
	it("exports 12 commands", () => {
		expect(convertCommands).toHaveLength(12)
	})
})

// ============================================================================
// E2E CLI Tests
// ============================================================================

describe("chop from-wei (E2E)", () => {
	it("converts 1e18 wei to 1 ether", () => {
		const result = runCli("from-wei 1000000000000000000")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("1.000000000000000000")
	})

	it("converts with gwei unit", () => {
		const result = runCli("from-wei 1000000000 gwei")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("1.000000000")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("from-wei 1000000000000000000 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "1.000000000000000000" })
	})

	it("exits non-zero on invalid number", () => {
		const result = runCli("from-wei abc")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop to-wei (E2E)", () => {
	it("converts 1.5 ether to wei", () => {
		const result = runCli("to-wei 1.5")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("1500000000000000000")
	})

	it("converts integer ether to wei", () => {
		const result = runCli("to-wei 1")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("1000000000000000000")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-wei 1.5 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "1500000000000000000" })
	})

	it("exits non-zero on invalid input", () => {
		const result = runCli("to-wei abc")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop to-hex (E2E)", () => {
	it("converts 255 to 0xff", () => {
		const result = runCli("to-hex 255")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xff")
	})

	it("converts 0 to 0x0", () => {
		const result = runCli("to-hex 0")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x0")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-hex 255 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "0xff" })
	})
})

describe("chop to-dec (E2E)", () => {
	it("converts 0xff to 255", () => {
		const result = runCli("to-dec 0xff")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("255")
	})

	it("converts 0x0 to 0", () => {
		const result = runCli("to-dec 0x0")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-dec 0xff --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "255" })
	})

	it("exits non-zero on missing 0x prefix", () => {
		const result = runCli("to-dec ff")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop to-base (E2E)", () => {
	it("converts 255 decimal to binary", () => {
		const result = runCli("to-base 255 --base-out 2")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("11111111")
	})

	it("converts with both base-in and base-out", () => {
		const result = runCli("to-base ff --base-in 16 --base-out 10")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("255")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-base 255 --base-out 2 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "11111111" })
	})
})

describe("chop from-utf8 (E2E)", () => {
	it("converts hello to hex", () => {
		const result = runCli("from-utf8 hello")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x68656c6c6f")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("from-utf8 hello --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "0x68656c6c6f" })
	})
})

describe("chop to-utf8 (E2E)", () => {
	it("converts hex to hello", () => {
		const result = runCli("to-utf8 0x68656c6c6f")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("hello")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-utf8 0x68656c6c6f --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "hello" })
	})
})

describe("chop to-bytes32 (E2E)", () => {
	it("pads hex to bytes32", () => {
		const result = runCli("to-bytes32 0xff")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x00000000000000000000000000000000000000000000000000000000000000ff")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("to-bytes32 0xff --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "0x00000000000000000000000000000000000000000000000000000000000000ff" })
	})
})

describe("chop to-rlp / from-rlp (E2E)", () => {
	it("RLP encodes and decodes round-trip", () => {
		const encodeResult = runCli("to-rlp 0x010203")
		expect(encodeResult.exitCode).toBe(0)
		const encoded = encodeResult.stdout.trim()

		const decodeResult = runCli(`from-rlp ${encoded}`)
		expect(decodeResult.exitCode).toBe(0)
		expect(decodeResult.stdout.trim()).toBe("0x010203")
	})

	it("to-rlp outputs JSON with --json flag", () => {
		const result = runCli("to-rlp 0x01 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toMatch(/^0x/)
	})
})

describe("chop shl (E2E)", () => {
	it("shifts 1 left by 8 bits", () => {
		const result = runCli("shl 1 8")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x100")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("shl 1 8 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "0x100" })
	})
})

describe("chop shr (E2E)", () => {
	it("shifts 256 right by 8 bits", () => {
		const result = runCli("shr 256 8")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x1")
	})

	it("outputs JSON with --json flag", () => {
		const result = runCli("shr 256 8 --json")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toEqual({ result: "0x1" })
	})
})
