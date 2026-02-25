/**
 * Boundary condition tests for rpc/handler.ts.
 *
 * Covers:
 * - handleRequest with null body
 * - handleRequest with numeric JSON (not object)
 * - handleRequest with array body (not object)
 * - Request with missing id field (defaults to null)
 * - Large batch request
 * - Batch with all invalid items
 * - Request with extra fields (ignored)
 * - Request with non-string params (defaults to [])
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { handleRequest } from "./handler.js"

// ---------------------------------------------------------------------------
// Parse edge cases
// ---------------------------------------------------------------------------

describe("handleRequest — parse edge cases", () => {
	it.effect("handles null JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("null")
			const res = JSON.parse(raw) as { error: { code: number }; id: null }
			expect(res.error.code).toBe(-32600) // null is not an object
			expect(res.id).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles numeric JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("42")
			const res = JSON.parse(raw) as { error: { code: number }; id: null }
			expect(res.error.code).toBe(-32600) // number is not an object
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles boolean JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("true")
			const res = JSON.parse(raw) as { error: { code: number }; id: null }
			expect(res.error.code).toBe(-32600)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles empty string as invalid JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("")
			const res = JSON.parse(raw) as { error: { code: number } }
			expect(res.error.code).toBe(-32700) // parse error
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles whitespace-only string as invalid JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("   ")
			const res = JSON.parse(raw) as { error: { code: number } }
			expect(res.error.code).toBe(-32700) // parse error
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Request structure edge cases
// ---------------------------------------------------------------------------

describe("handleRequest — request structure edge cases", () => {
	it.effect("handles request without id (defaults to null)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId" })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string; id: null }
			expect(res.result).toBe("0x7a69")
			expect(res.id).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with extra fields (ignored)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: [],
				id: 1,
				extraField: "should be ignored",
				anotherExtra: 42,
			})
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string; id: number }
			expect(res.result).toBe("0x7a69")
			expect(res.id).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with non-array params (defaults to [])", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: "not-an-array",
				id: 1,
			})
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string }
			expect(res.result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with wrong jsonrpc version", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "1.0", method: "eth_chainId", id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number; message: string }; id: number }
			expect(res.error.code).toBe(-32600)
			expect(res.error.message).toContain("jsonrpc")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with numeric method (invalid)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: 42, id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number }; id: number }
			expect(res.error.code).toBe(-32600)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with zero id", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 0 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string; id: number }
			expect(res.id).toBe(0)
			expect(res.result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles request with negative id", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: -1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string; id: number }
			expect(res.id).toBe(-1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Batch edge cases
// ---------------------------------------------------------------------------

describe("handleRequest — batch edge cases", () => {
	it.effect("handles batch with single item", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ result: string; id: number }>
			expect(Array.isArray(res)).toBe(true)
			expect(res.length).toBe(1)
			expect(res[0]?.result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles batch with all invalid requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([{ invalid: true }, { also: "invalid" }, 42])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ error: { code: number } }>
			expect(res.length).toBe(3)
			expect(res.every((r) => r.error.code === -32600)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles batch with all unknown methods", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([
				{ jsonrpc: "2.0", method: "eth_foo", params: [], id: 1 },
				{ jsonrpc: "2.0", method: "eth_bar", params: [], id: 2 },
			])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ error: { code: number } }>
			expect(res.length).toBe(2)
			expect(res.every((r) => r.error.code === -32601)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("batch preserves order of responses", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 10 },
				{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 20 },
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 30 },
			])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ id: number; result: string }>
			expect(res[0]?.id).toBe(10)
			expect(res[1]?.id).toBe(20)
			expect(res[2]?.id).toBe(30)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Response structure validation
// ---------------------------------------------------------------------------

describe("handleRequest — response structure", () => {
	it.effect("success response always has jsonrpc 2.0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { jsonrpc: string }
			expect(res.jsonrpc).toBe("2.0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("error response always has jsonrpc 2.0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("not json")
			const res = JSON.parse(raw) as { jsonrpc: string }
			expect(res.jsonrpc).toBe("2.0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("error response has error.code and error.message", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_unknown", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number; message: string } }
			expect(typeof res.error.code).toBe("number")
			expect(typeof res.error.message).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
