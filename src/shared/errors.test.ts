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
