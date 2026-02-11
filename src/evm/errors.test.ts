import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { WasmExecutionError, WasmLoadError } from "./errors.js"

// ---------------------------------------------------------------------------
// WasmLoadError
// ---------------------------------------------------------------------------

describe("WasmLoadError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new WasmLoadError({ message: "file not found" })
			expect(error._tag).toBe("WasmLoadError")
			expect(error.message).toBe("file not found")
		}),
	)

	it.effect("can be constructed with cause", () =>
		Effect.sync(() => {
			const cause = new Error("ENOENT")
			const error = new WasmLoadError({ message: "load failed", cause })
			expect(error.message).toBe("load failed")
			expect(error.cause).toBe(cause)
		}),
	)

	it("has undefined cause when not provided", () => {
		const error = new WasmLoadError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new WasmLoadError({ message: "caught" })).pipe(
				Effect.catchTag("WasmLoadError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("caught")
		}),
	)

	it.effect("catchAll catches WasmLoadError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new WasmLoadError({ message: "test" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.message}`)),
			)
			expect(result).toBe("WasmLoadError: test")
		}),
	)

	it("preserves cause chain", () => {
		const inner = new Error("disk error")
		const outer = new WasmLoadError({ message: "load failed", cause: inner })
		expect(outer.cause).toBe(inner)
		expect((outer.cause as Error).message).toBe("disk error")
	})
})

// ---------------------------------------------------------------------------
// WasmExecutionError
// ---------------------------------------------------------------------------

describe("WasmExecutionError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new WasmExecutionError({ message: "out of gas" })
			expect(error._tag).toBe("WasmExecutionError")
			expect(error.message).toBe("out of gas")
		}),
	)

	it.effect("can be constructed with cause", () =>
		Effect.sync(() => {
			const cause = new Error("stack overflow")
			const error = new WasmExecutionError({ message: "execution failed", cause })
			expect(error.message).toBe("execution failed")
			expect(error.cause).toBe(cause)
		}),
	)

	it("has undefined cause when not provided", () => {
		const error = new WasmExecutionError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new WasmExecutionError({ message: "reverted" })).pipe(
				Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("reverted")
		}),
	)

	it.effect("catchAll catches WasmExecutionError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new WasmExecutionError({ message: "bad opcode" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.message}`)),
			)
			expect(result).toBe("WasmExecutionError: bad opcode")
		}),
	)

	it("preserves non-Error cause", () => {
		const error = new WasmExecutionError({ message: "test", cause: 42 })
		expect(error.cause).toBe(42)
	})
})

// ---------------------------------------------------------------------------
// Discriminated union — both error types coexist
// ---------------------------------------------------------------------------

describe("WasmLoadError + WasmExecutionError discrimination", () => {
	it.effect("catchTag selects correct error type", () =>
		Effect.gen(function* () {
			const program = Effect.fail(new WasmExecutionError({ message: "exec" })) as Effect.Effect<
				string,
				WasmLoadError | WasmExecutionError
			>

			const result = yield* program.pipe(
				Effect.catchTag("WasmLoadError", (e) => Effect.succeed(`load: ${e.message}`)),
				Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(`exec: ${e.message}`)),
			)
			expect(result).toBe("exec: exec")
		}),
	)

	it.effect("mapError can transform between error types", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new WasmLoadError({ message: "init" })).pipe(
				Effect.mapError((e) => new WasmExecutionError({ message: `wrapped: ${e.message}`, cause: e })),
				Effect.catchTag("WasmExecutionError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("wrapped: init")
		}),
	)

	it("_tag values are distinct", () => {
		const load = new WasmLoadError({ message: "a" })
		const exec = new WasmExecutionError({ message: "b" })
		expect(load._tag).not.toBe(exec._tag)
		expect(load._tag).toBe("WasmLoadError")
		expect(exec._tag).toBe("WasmExecutionError")
	})
})
