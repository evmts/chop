import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	InternalError,
	InvalidParamsError,
	InvalidRequestError,
	MethodNotFoundError,
	ParseError,
	RpcErrorCode,
	rpcErrorCode,
	rpcErrorMessage,
	wrapErrors,
} from "./errors.js"

// ---------------------------------------------------------------------------
// wrapErrors — previously untested
// ---------------------------------------------------------------------------

describe("wrapErrors", () => {
	it.effect("passes through successful effects", () =>
		Effect.gen(function* () {
			const result = yield* wrapErrors(Effect.succeed(42))
			expect(result).toBe(42)
		}),
	)

	it.effect("wraps expected errors as InternalError", () =>
		Effect.gen(function* () {
			const program = wrapErrors(Effect.fail(new Error("something went wrong")))
			const result = yield* program.pipe(Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("something went wrong")
		}),
	)

	it.effect("wraps string errors as InternalError", () =>
		Effect.gen(function* () {
			const program = wrapErrors(Effect.fail("string error"))
			const result = yield* program.pipe(Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)))
			expect(result).toBe("string error")
		}),
	)

	it.effect("wraps defects as InternalError", () =>
		Effect.gen(function* () {
			const program = wrapErrors(Effect.die("kaboom"))
			const result = yield* program.pipe(Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)))
			expect(result).toBe("kaboom")
		}),
	)

	it.effect("wraps Error defects with message", () =>
		Effect.gen(function* () {
			const program = wrapErrors(Effect.die(new Error("defect error")))
			const result = yield* program.pipe(Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("defect error")
		}),
	)
})

// ---------------------------------------------------------------------------
// rpcErrorCode — all branches
// ---------------------------------------------------------------------------

describe("rpcErrorCode", () => {
	it("maps ParseError to -32700", () => {
		expect(rpcErrorCode(new ParseError({ message: "test" }))).toBe(RpcErrorCode.PARSE_ERROR)
	})

	it("maps InvalidRequestError to -32600", () => {
		expect(rpcErrorCode(new InvalidRequestError({ message: "test" }))).toBe(RpcErrorCode.INVALID_REQUEST)
	})

	it("maps MethodNotFoundError to -32601", () => {
		expect(rpcErrorCode(new MethodNotFoundError({ method: "eth_foo" }))).toBe(RpcErrorCode.METHOD_NOT_FOUND)
	})

	it("maps InvalidParamsError to -32602", () => {
		expect(rpcErrorCode(new InvalidParamsError({ message: "test" }))).toBe(RpcErrorCode.INVALID_PARAMS)
	})

	it("maps InternalError to -32603", () => {
		expect(rpcErrorCode(new InternalError({ message: "test" }))).toBe(RpcErrorCode.INTERNAL_ERROR)
	})
})

// ---------------------------------------------------------------------------
// rpcErrorMessage — all branches
// ---------------------------------------------------------------------------

describe("rpcErrorMessage", () => {
	it("returns message for ParseError", () => {
		expect(rpcErrorMessage(new ParseError({ message: "bad json" }))).toBe("bad json")
	})

	it("returns message for InvalidRequestError", () => {
		expect(rpcErrorMessage(new InvalidRequestError({ message: "no method" }))).toBe("no method")
	})

	it("formats MethodNotFoundError with method name", () => {
		expect(rpcErrorMessage(new MethodNotFoundError({ method: "eth_foo" }))).toBe("Method not found: eth_foo")
	})

	it("returns message for InvalidParamsError", () => {
		expect(rpcErrorMessage(new InvalidParamsError({ message: "wrong params" }))).toBe("wrong params")
	})

	it("returns message for InternalError", () => {
		expect(rpcErrorMessage(new InternalError({ message: "internal error" }))).toBe("internal error")
	})
})

// ---------------------------------------------------------------------------
// InternalError — cause field
// ---------------------------------------------------------------------------

describe("InternalError", () => {
	it("has correct _tag", () => {
		const err = new InternalError({ message: "test" })
		expect(err._tag).toBe("InternalError")
	})

	it("carries optional cause", () => {
		const cause = new Error("root")
		const err = new InternalError({ message: "wrapped", cause })
		expect(err.cause).toBe(cause)
	})

	it("has undefined cause when not provided", () => {
		const err = new InternalError({ message: "no cause" })
		expect(err.cause).toBeUndefined()
	})
})
