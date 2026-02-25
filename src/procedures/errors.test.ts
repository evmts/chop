import { describe, it } from "@effect/vitest"
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
} from "./errors.js"

describe("RPC Errors", () => {
	// -----------------------------------------------------------------------
	// Error codes
	// -----------------------------------------------------------------------

	it("RpcErrorCode constants match JSON-RPC spec", () => {
		expect(RpcErrorCode.PARSE_ERROR).toBe(-32700)
		expect(RpcErrorCode.INVALID_REQUEST).toBe(-32600)
		expect(RpcErrorCode.METHOD_NOT_FOUND).toBe(-32601)
		expect(RpcErrorCode.INVALID_PARAMS).toBe(-32602)
		expect(RpcErrorCode.INTERNAL_ERROR).toBe(-32603)
	})

	// -----------------------------------------------------------------------
	// ParseError
	// -----------------------------------------------------------------------

	it("ParseError has correct tag and maps to -32700", () => {
		const err = new ParseError({ message: "bad json" })
		expect(err._tag).toBe("ParseError")
		expect(rpcErrorCode(err)).toBe(-32700)
		expect(rpcErrorMessage(err)).toBe("bad json")
	})

	// -----------------------------------------------------------------------
	// InvalidRequestError
	// -----------------------------------------------------------------------

	it("InvalidRequestError has correct tag and maps to -32600", () => {
		const err = new InvalidRequestError({ message: "missing jsonrpc" })
		expect(err._tag).toBe("InvalidRequestError")
		expect(rpcErrorCode(err)).toBe(-32600)
		expect(rpcErrorMessage(err)).toBe("missing jsonrpc")
	})

	// -----------------------------------------------------------------------
	// MethodNotFoundError
	// -----------------------------------------------------------------------

	it("MethodNotFoundError has correct tag and maps to -32601", () => {
		const err = new MethodNotFoundError({ method: "eth_foo" })
		expect(err._tag).toBe("MethodNotFoundError")
		expect(rpcErrorCode(err)).toBe(-32601)
		expect(rpcErrorMessage(err)).toBe("Method not found: eth_foo")
	})

	// -----------------------------------------------------------------------
	// InvalidParamsError
	// -----------------------------------------------------------------------

	it("InvalidParamsError has correct tag and maps to -32602", () => {
		const err = new InvalidParamsError({ message: "wrong params" })
		expect(err._tag).toBe("InvalidParamsError")
		expect(rpcErrorCode(err)).toBe(-32602)
		expect(rpcErrorMessage(err)).toBe("wrong params")
	})

	// -----------------------------------------------------------------------
	// InternalError
	// -----------------------------------------------------------------------

	it("InternalError has correct tag and maps to -32603", () => {
		const err = new InternalError({ message: "kaboom" })
		expect(err._tag).toBe("InternalError")
		expect(rpcErrorCode(err)).toBe(-32603)
		expect(rpcErrorMessage(err)).toBe("kaboom")
	})

	it("InternalError accepts optional cause", () => {
		const cause = new Error("root")
		const err = new InternalError({ message: "wrapped", cause })
		expect(err.cause).toBe(cause)
	})
})
