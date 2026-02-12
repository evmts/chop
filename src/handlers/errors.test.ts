import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { HandlerError } from "./errors.js"

describe("HandlerError", () => {
	it("has correct _tag", () => {
		const err = new HandlerError({ message: "test" })
		expect(err._tag).toBe("HandlerError")
	})

	it("carries message", () => {
		const err = new HandlerError({ message: "call reverted" })
		expect(err.message).toBe("call reverted")
	})

	it("carries optional cause", () => {
		const cause = new Error("root cause")
		const err = new HandlerError({ message: "wrapped", cause })
		expect(err.cause).toBe(cause)
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new HandlerError({ message: "oops" })).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("oops")
		}),
	)
})
