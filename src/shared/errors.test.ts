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
})
