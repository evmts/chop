import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { ChopError } from "./errors.js"

describe("ChopError", () => {
	it.effect("can be constructed with a message", () =>
		Effect.sync(() => {
			const error = new ChopError({ message: "test error" })
			expect(error.message).toBe("test error")
			expect(error._tag).toBe("ChopError")
		}),
	)

	it.effect("can be constructed with a message and cause", () =>
		Effect.sync(() => {
			const cause = new Error("underlying")
			const error = new ChopError({ message: "wrapped", cause })
			expect(error.message).toBe("wrapped")
			expect(error.cause).toBe(cause)
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ChopError({ message: "caught" })).pipe(
				Effect.catchTag("ChopError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("caught")
		}),
	)

	it("has undefined cause when not provided", () => {
		const error = new ChopError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})

	it("preserves non-Error cause objects", () => {
		const error = new ChopError({ message: "with cause", cause: "string cause" })
		expect(error.cause).toBe("string cause")
	})

	it("preserves null cause", () => {
		const error = new ChopError({ message: "null cause", cause: null })
		expect(error.cause).toBeNull()
	})

	it("handles empty message", () => {
		const error = new ChopError({ message: "" })
		expect(error.message).toBe("")
		expect(error._tag).toBe("ChopError")
	})

	it("handles message with unicode", () => {
		const error = new ChopError({ message: "Error: 🚨 Invalid état 日本語" })
		expect(error.message).toBe("Error: 🚨 Invalid état 日本語")
	})

	it("handles very long message", () => {
		const longMsg = "x".repeat(10_000)
		const error = new ChopError({ message: longMsg })
		expect(error.message.length).toBe(10_000)
	})

	it.effect("catchAll catches ChopError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ChopError({ message: "test" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`caught: ${e._tag} - ${e.message}`)),
			)
			expect(result).toBe("caught: ChopError - test")
		}),
	)

	it("is an instance of Data.TaggedError", () => {
		const error = new ChopError({ message: "test" })
		// Data.TaggedError instances have _tag property
		expect("_tag" in error).toBe(true)
		expect(error._tag).toBe("ChopError")
	})

	it("nested Error cause preserves stack", () => {
		const inner = new Error("inner")
		const outer = new ChopError({ message: "outer", cause: inner })
		expect(outer.cause).toBe(inner)
		expect((outer.cause as Error).stack).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// ChopError — structural equality (Data.TaggedError)
// ---------------------------------------------------------------------------

describe("ChopError — structural equality", () => {
	it("two errors with same fields share the same _tag", () => {
		const a = new ChopError({ message: "same" })
		const b = new ChopError({ message: "same" })
		expect(a._tag).toBe(b._tag)
		expect(a.message).toBe(b.message)
	})

	it("two errors with different messages have different message properties", () => {
		const a = new ChopError({ message: "one" })
		const b = new ChopError({ message: "two" })
		expect(a.message).not.toBe(b.message)
		expect(a._tag).toBe(b._tag)
	})

	it("error with cause differs from error without cause by .cause", () => {
		const a = new ChopError({ message: "msg", cause: new Error("x") })
		const b = new ChopError({ message: "msg" })
		expect(a.cause).toBeDefined()
		expect(b.cause).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// ChopError — Effect pipeline patterns
// ---------------------------------------------------------------------------

describe("ChopError — Effect pipeline patterns", () => {
	it.effect("mapError can transform ChopError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ChopError({ message: "original" })).pipe(
				Effect.mapError((e) => new ChopError({ message: `wrapped: ${e.message}` })),
				Effect.catchTag("ChopError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("wrapped: original")
		}),
	)

	it.effect("flatMap after recovery succeeds", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ChopError({ message: "fail" })).pipe(
				Effect.catchTag("ChopError", () => Effect.succeed(42)),
				Effect.flatMap((n) => Effect.succeed(n * 2)),
			)
			expect(result).toBe(84)
		}),
	)

	it.effect("tap does not alter the error", () =>
		Effect.gen(function* () {
			let tapped = false
			const result = yield* Effect.fail(new ChopError({ message: "tapped" })).pipe(
				Effect.tapError(() => {
					tapped = true
					return Effect.void
				}),
				Effect.catchTag("ChopError", (e) => Effect.succeed(e.message)),
			)
			expect(tapped).toBe(true)
			expect(result).toBe("tapped")
		}),
	)

	it.effect("orElse provides fallback", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ChopError({ message: "primary" })).pipe(
				Effect.orElse(() => Effect.succeed("fallback")),
			)
			expect(result).toBe("fallback")
		}),
	)

	it.effect("multiple catchTags only match the correct tag", () =>
		Effect.gen(function* () {
			const program = Effect.fail(new ChopError({ message: "chop" })) as Effect.Effect<
				string,
				ChopError | { readonly _tag: "OtherError"; readonly message: string }
			>

			const result = yield* program.pipe(Effect.catchTag("ChopError", (e) => Effect.succeed(`chop: ${e.message}`)))
			expect(result).toBe("chop: chop")
		}),
	)
})

// ---------------------------------------------------------------------------
// ChopError — special cause types
// ---------------------------------------------------------------------------

describe("ChopError — special cause types", () => {
	it("cause can be a number", () => {
		const error = new ChopError({ message: "num", cause: 42 })
		expect(error.cause).toBe(42)
	})

	it("cause can be an array", () => {
		const cause = [1, 2, 3]
		const error = new ChopError({ message: "arr", cause })
		expect(error.cause).toEqual([1, 2, 3])
	})

	it("cause can be a deeply nested error", () => {
		const level3 = new Error("level3")
		const level2 = new ChopError({ message: "level2", cause: level3 })
		const level1 = new ChopError({ message: "level1", cause: level2 })
		expect(level1.cause).toBe(level2)
		expect((level1.cause as ChopError).cause).toBe(level3)
	})

	it("cause can be undefined explicitly", () => {
		const error = new ChopError({ message: "explicit", cause: undefined })
		expect(error.cause).toBeUndefined()
	})

	it("message with newlines is preserved", () => {
		const msg = "line1\nline2\nline3"
		const error = new ChopError({ message: msg })
		expect(error.message).toBe("line1\nline2\nline3")
	})

	it("message with tabs is preserved", () => {
		const msg = "col1\tcol2\tcol3"
		const error = new ChopError({ message: msg })
		expect(error.message).toBe("col1\tcol2\tcol3")
	})
})
