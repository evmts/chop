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
})
