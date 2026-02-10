import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { handleCommandErrors, jsonOption, validateHexData } from "./shared"

class TestError {
	constructor(
		public message: string,
		public data: string,
	) {}
}

const mkTestError = (msg: string, data: string) => new TestError(msg, data)

describe("jsonOption", () => {
	it("should have correct configuration", () => {
		expect(jsonOption).toBeDefined()
		// The jsonOption is an Options object with alias "j" and description
		// We can't easily test Options directly without the full CLI context
	})
})

describe("validateHexData", () => {
	describe("valid hex strings", () => {
		it.effect("accepts valid lowercase hex 0xdeadbeef", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0xdeadbeef", mkTestError)
				expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
			}),
		)

		it.effect("accepts valid empty hex 0x", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0x", mkTestError)
				expect(result).toEqual(new Uint8Array([]))
			}),
		)

		it.effect("accepts valid uppercase hex 0xDEADBEEF", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0xDEADBEEF", mkTestError)
				expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
			}),
		)

		it.effect("accepts valid mixed case hex 0xDeAdBeEf", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0xDeAdBeEf", mkTestError)
				expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
			}),
		)

		it.effect("accepts valid single byte 0xff", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0xff", mkTestError)
				expect(result).toEqual(new Uint8Array([0xff]))
			}),
		)

		it.effect("accepts valid long hex (64 chars)", () =>
			Effect.gen(function* () {
				const longHex = "0x" + "a".repeat(64)
				const result = yield* validateHexData(longHex, mkTestError)
				expect(result.length).toBe(32)
				expect(result).toEqual(new Uint8Array(32).fill(0xaa))
			}),
		)

		it.effect("preserves leading zeros 0x0000ff", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0x0000ff", mkTestError)
				expect(result).toEqual(new Uint8Array([0x00, 0x00, 0xff]))
			}),
		)

		it.effect("accepts single zero byte 0x00", () =>
			Effect.gen(function* () {
				const result = yield* validateHexData("0x00", mkTestError)
				expect(result).toEqual(new Uint8Array([0x00]))
			}),
		)
	})

	describe("invalid hex strings", () => {
		it.effect("rejects hex without 0x prefix", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("deadbeef", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("must start with 0x")
				expect(result.data).toBe("deadbeef")
			}),
		)

		it.effect("rejects invalid hex chars 0xGGGG", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("0xGGGG", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("Invalid hex characters")
				expect(result.data).toBe("0xGGGG")
			}),
		)

		it.effect("rejects odd-length hex 0xabc", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("0xabc", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("Odd-length hex string")
				expect(result.data).toBe("0xabc")
			}),
		)

		it.effect("rejects special chars 0x!@#$", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("0x!@#$", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("Invalid hex characters")
				expect(result.data).toBe("0x!@#$")
			}),
		)

		it.effect("rejects empty string", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("must start with 0x")
				expect(result.data).toBe("")
			}),
		)

		it.effect("rejects hex with spaces 0xde ad", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("0xde ad", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("Invalid hex characters")
				expect(result.data).toBe("0xde ad")
			}),
		)

		it.effect("rejects just 0 without x", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(validateHexData("0", mkTestError))
				expect(result).toBeInstanceOf(TestError)
				expect(result.message).toContain("Invalid hex data")
				expect(result.message).toContain("must start with 0x")
				expect(result.data).toBe("0")
			}),
		)
	})
})

describe("handleCommandErrors", () => {
	it.effect("passes through successful effect unchanged", () =>
		Effect.gen(function* () {
			const effect = Effect.succeed(42)
			const result = yield* handleCommandErrors(effect)
			expect(result).toBe(42)
		}),
	)

	it.effect("taps error and still propagates it", () =>
		Effect.gen(function* () {
			const error = { message: "Test error message" }
			const effect = Effect.fail(error)

			const result = yield* Effect.flip(handleCommandErrors(effect))
			expect(result).toEqual(error)
		}),
	)

	it.effect("handles error with empty message", () =>
		Effect.gen(function* () {
			const error = { message: "" }
			const effect = Effect.fail(error)

			const result = yield* Effect.flip(handleCommandErrors(effect))
			expect(result).toEqual(error)
		}),
	)

	it.effect("handles multiple errors in sequence", () =>
		Effect.gen(function* () {
			const error1 = { message: "First error" }
			const error2 = { message: "Second error" }

			const r1 = yield* Effect.flip(handleCommandErrors(Effect.fail(error1)))
			const r2 = yield* Effect.flip(handleCommandErrors(Effect.fail(error2)))

			expect(r1).toEqual(error1)
			expect(r2).toEqual(error2)
		}),
	)
})
