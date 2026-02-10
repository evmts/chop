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
