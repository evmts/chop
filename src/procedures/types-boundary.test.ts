/**
 * Boundary condition tests for procedures/types.ts.
 *
 * Covers:
 * - makeSuccessResponse with various result types
 * - makeErrorResponse with various error codes
 * - Edge cases for id field
 * - Response shape validation
 */

import { describe, expect, it } from "vitest"
import { makeErrorResponse, makeSuccessResponse } from "./types.js"

// ---------------------------------------------------------------------------
// makeSuccessResponse — boundary conditions
// ---------------------------------------------------------------------------

describe("makeSuccessResponse — boundary conditions", () => {
	it("handles numeric id 0", () => {
		const res = makeSuccessResponse(0, "0x0")
		expect(res.id).toBe(0)
	})

	it("handles negative numeric id", () => {
		const res = makeSuccessResponse(-1, "0x0")
		expect(res.id).toBe(-1)
	})

	it("handles very large numeric id", () => {
		const res = makeSuccessResponse(Number.MAX_SAFE_INTEGER, "0x0")
		expect(res.id).toBe(Number.MAX_SAFE_INTEGER)
	})

	it("handles empty string id", () => {
		const res = makeSuccessResponse("", "0x0")
		expect(res.id).toBe("")
	})

	it("handles result that is null", () => {
		const res = makeSuccessResponse(1, null)
		expect(res.result).toBeNull()
	})

	it("handles result that is an object", () => {
		const result = { foo: "bar", nested: { a: 1 } }
		const res = makeSuccessResponse(1, result)
		expect(res.result).toEqual(result)
	})

	it("handles result that is an array", () => {
		const res = makeSuccessResponse(1, [1, 2, 3])
		expect(res.result).toEqual([1, 2, 3])
	})

	it("handles result that is a boolean", () => {
		const res = makeSuccessResponse(1, false)
		expect(res.result).toBe(false)
	})

	it("handles result that is a number", () => {
		const res = makeSuccessResponse(1, 42)
		expect(res.result).toBe(42)
	})

	it("always includes jsonrpc 2.0", () => {
		const res = makeSuccessResponse(1, "test")
		expect(res.jsonrpc).toBe("2.0")
	})
})

// ---------------------------------------------------------------------------
// makeErrorResponse — boundary conditions
// ---------------------------------------------------------------------------

describe("makeErrorResponse — boundary conditions", () => {
	it("handles all standard error codes", () => {
		const codes = [-32700, -32600, -32601, -32602, -32603]
		for (const code of codes) {
			const res = makeErrorResponse(1, code, `error ${code}`)
			expect(res.error.code).toBe(code)
			expect(res.error.message).toBe(`error ${code}`)
		}
	})

	it("handles custom error code", () => {
		const res = makeErrorResponse(1, -32000, "Custom error")
		expect(res.error.code).toBe(-32000)
	})

	it("handles positive error code", () => {
		const res = makeErrorResponse(1, 42, "Positive")
		expect(res.error.code).toBe(42)
	})

	it("handles empty message", () => {
		const res = makeErrorResponse(1, -32603, "")
		expect(res.error.message).toBe("")
	})

	it("handles very long error message", () => {
		const longMsg = "x".repeat(10_000)
		const res = makeErrorResponse(1, -32603, longMsg)
		expect(res.error.message.length).toBe(10_000)
	})

	it("handles unicode in error message", () => {
		const msg = "Error: 🚨 Invalid état"
		const res = makeErrorResponse(1, -32603, msg)
		expect(res.error.message).toBe(msg)
	})

	it("handles null id", () => {
		const res = makeErrorResponse(null, -32700, "Parse error")
		expect(res.id).toBeNull()
	})

	it("always includes jsonrpc 2.0", () => {
		const res = makeErrorResponse(1, -32603, "test")
		expect(res.jsonrpc).toBe("2.0")
	})

	it("response error has no data property by default", () => {
		const res = makeErrorResponse(1, -32603, "test")
		expect(res.error.data).toBeUndefined()
	})
})
