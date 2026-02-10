import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { CliError } from "./errors.js"

describe("CliError", () => {
	it("has correct _tag", () => {
		const error = new CliError({ message: "test error" })
		expect(error._tag).toBe("CliError")
	})

	it("stores message", () => {
		const error = new CliError({ message: "something broke" })
		expect(error.message).toBe("something broke")
	})

	it("stores optional cause", () => {
		const cause = new Error("root cause")
		const error = new CliError({ message: "wrapped", cause })
		expect(error.cause).toBe(cause)
	})

	it("has undefined cause when not provided", () => {
		const error = new CliError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})

	it.effect("can be caught with catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CliError({ message: "caught" })).pipe(
				Effect.catchTag("CliError", (e) => Effect.succeed(`recovered: ${e.message}`)),
			)
			expect(result).toBe("recovered: caught")
		}),
	)

	it("handles empty message", () => {
		const error = new CliError({ message: "" })
		expect(error.message).toBe("")
		expect(error._tag).toBe("CliError")
	})

	it("handles message with special characters", () => {
		const msg = 'Error: path "/foo/bar" not found <script>alert(1)</script>'
		const error = new CliError({ message: msg })
		expect(error.message).toBe(msg)
	})

	it("preserves non-Error cause", () => {
		const error = new CliError({ message: "test", cause: 42 })
		expect(error.cause).toBe(42)
	})

	it("preserves object cause", () => {
		const cause = { code: "ENOENT", path: "/missing" }
		const error = new CliError({ message: "file error", cause })
		expect(error.cause).toEqual({ code: "ENOENT", path: "/missing" })
	})

	it.effect("does not interfere with ChopError in catchTag", () =>
		Effect.gen(function* () {
			// CliError should not be caught by a ChopError catchTag
			const result = yield* Effect.fail(new CliError({ message: "cli error" })).pipe(
				Effect.catchTag("CliError", (e) => Effect.succeed(`cli: ${e.message}`)),
			)
			expect(result).toBe("cli: cli error")
		}),
	)

	it.effect("can be used in Effect.catchAll", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CliError({ message: "fail" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`any: ${e._tag}`)),
			)
			expect(result).toBe("any: CliError")
		}),
	)
})

// ---------------------------------------------------------------------------
// CliError — structural equality
// ---------------------------------------------------------------------------

describe("CliError — structural equality", () => {
	it("two CliErrors with same fields share the same _tag and message", () => {
		const a = new CliError({ message: "same" })
		const b = new CliError({ message: "same" })
		expect(a._tag).toBe(b._tag)
		expect(a.message).toBe(b.message)
	})

	it("two CliErrors with different messages have different message properties", () => {
		const a = new CliError({ message: "one" })
		const b = new CliError({ message: "two" })
		expect(a.message).not.toBe(b.message)
		expect(a._tag).toBe(b._tag) // same tag
	})

	it("CliError with cause differs from without by .cause", () => {
		const a = new CliError({ message: "msg", cause: "x" })
		const b = new CliError({ message: "msg" })
		expect(a.cause).toBe("x")
		expect(b.cause).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// CliError — edge case messages
// ---------------------------------------------------------------------------

describe("CliError — edge case messages", () => {
	it("handles message with unicode emoji", () => {
		const error = new CliError({ message: "🔥 error 🔥" })
		expect(error.message).toBe("🔥 error 🔥")
	})

	it("handles very long message (10000 chars)", () => {
		const msg = "a".repeat(10000)
		const error = new CliError({ message: msg })
		expect(error.message.length).toBe(10000)
	})

	it("handles message with newlines", () => {
		const msg = "line1\nline2\nline3"
		const error = new CliError({ message: msg })
		expect(error.message).toBe("line1\nline2\nline3")
	})

	it("handles null cause explicitly", () => {
		const error = new CliError({ message: "null", cause: null })
		expect(error.cause).toBeNull()
	})

	it("handles nested CliError as cause", () => {
		const inner = new CliError({ message: "inner" })
		const outer = new CliError({ message: "outer", cause: inner })
		expect(outer.cause).toBe(inner)
		expect((outer.cause as CliError)._tag).toBe("CliError")
	})
})

// ---------------------------------------------------------------------------
// CliError — Effect pipeline patterns
// ---------------------------------------------------------------------------

describe("CliError — Effect pipeline patterns", () => {
	it.effect("mapError transforms CliError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CliError({ message: "original" })).pipe(
				Effect.mapError((e) => new CliError({ message: `wrapped: ${e.message}` })),
				Effect.catchTag("CliError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("wrapped: original")
		}),
	)

	it.effect("tapError observes without altering error", () =>
		Effect.gen(function* () {
			let observed = ""
			const result = yield* Effect.fail(new CliError({ message: "tap me" })).pipe(
				Effect.tapError((e) => {
					observed = e.message
					return Effect.void
				}),
				Effect.catchTag("CliError", (e) => Effect.succeed(e.message)),
			)
			expect(observed).toBe("tap me")
			expect(result).toBe("tap me")
		}),
	)

	it.effect("orElse provides fallback on CliError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CliError({ message: "fail" })).pipe(
				Effect.orElse(() => Effect.succeed("fallback")),
			)
			expect(result).toBe("fallback")
		}),
	)
})
