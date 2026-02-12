import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { ConversionError, WasmExecutionError, WasmLoadError } from "./errors.js"

// ---------------------------------------------------------------------------
// ConversionError — previously untested
// ---------------------------------------------------------------------------

describe("ConversionError", () => {
	it("has correct _tag", () => {
		const error = new ConversionError({ message: "odd-length hex" })
		expect(error._tag).toBe("ConversionError")
		expect(error.message).toBe("odd-length hex")
	})

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ConversionError({ message: "bad hex" })).pipe(
				Effect.catchTag("ConversionError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("bad hex")
		}),
	)

	it.effect("catchAll catches ConversionError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ConversionError({ message: "test" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.message}`)),
			)
			expect(result).toBe("ConversionError: test")
		}),
	)

	it("does not have a cause field", () => {
		const error = new ConversionError({ message: "test" })
		// ConversionError only has message, no cause field
		expect("cause" in error).toBe(false)
	})

	it("_tag is distinct from WasmLoadError and WasmExecutionError", () => {
		const conv = new ConversionError({ message: "a" })
		const load = new WasmLoadError({ message: "b" })
		const exec = new WasmExecutionError({ message: "c" })
		expect(conv._tag).not.toBe(load._tag)
		expect(conv._tag).not.toBe(exec._tag)
	})
})

// ---------------------------------------------------------------------------
// Discrimination with all three error types
// ---------------------------------------------------------------------------

describe("ConversionError + WasmLoadError + WasmExecutionError discrimination", () => {
	it.effect("catchTag selects ConversionError from union", () =>
		Effect.gen(function* () {
			const program = Effect.fail(new ConversionError({ message: "conv" })) as Effect.Effect<
				string,
				ConversionError | WasmLoadError | WasmExecutionError
			>

			const result = yield* program.pipe(
				Effect.catchTag("ConversionError", (e) => Effect.succeed(`conv: ${e.message}`)),
				Effect.catchTag("WasmLoadError", (e) => Effect.succeed(`load: ${e.message}`)),
				Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(`exec: ${e.message}`)),
			)
			expect(result).toBe("conv: conv")
		}),
	)

	it.effect("empty message is allowed", () =>
		Effect.gen(function* () {
			const error = new ConversionError({ message: "" })
			expect(error.message).toBe("")
			expect(error._tag).toBe("ConversionError")
		}),
	)

	it.effect("unicode message is preserved", () =>
		Effect.gen(function* () {
			const error = new ConversionError({ message: "invalid hex: 0x🦄" })
			expect(error.message).toBe("invalid hex: 0x🦄")
		}),
	)
})
