import { describe, it } from "@effect/vitest"
import { expect } from "vitest"
import { makeErrorResponse, makeSuccessResponse } from "./types.js"

describe("JSON-RPC Types", () => {
	// -----------------------------------------------------------------------
	// makeSuccessResponse
	// -----------------------------------------------------------------------

	it("makeSuccessResponse creates valid success response", () => {
		const res = makeSuccessResponse(1, "0x7a69")
		expect(res.jsonrpc).toBe("2.0")
		expect(res.result).toBe("0x7a69")
		expect(res.id).toBe(1)
	})

	it("makeSuccessResponse handles null id", () => {
		const res = makeSuccessResponse(null, "0x0")
		expect(res.id).toBeNull()
	})

	it("makeSuccessResponse handles string id", () => {
		const res = makeSuccessResponse("abc", true)
		expect(res.id).toBe("abc")
		expect(res.result).toBe(true)
	})

	// -----------------------------------------------------------------------
	// makeErrorResponse
	// -----------------------------------------------------------------------

	it("makeErrorResponse creates valid error response", () => {
		const res = makeErrorResponse(1, -32601, "Method not found")
		expect(res.jsonrpc).toBe("2.0")
		expect(res.error.code).toBe(-32601)
		expect(res.error.message).toBe("Method not found")
		expect(res.id).toBe(1)
	})

	it("makeErrorResponse handles null id for parse errors", () => {
		const res = makeErrorResponse(null, -32700, "Parse error")
		expect(res.id).toBeNull()
		expect(res.error.code).toBe(-32700)
	})
})
