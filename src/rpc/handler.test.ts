import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { handleRequest } from "./handler.js"

describe("handleRequest", () => {
	// -----------------------------------------------------------------------
	// Valid single requests
	// -----------------------------------------------------------------------

	it.effect("eth_chainId returns correct result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { jsonrpc: string; result: string; id: number }
			expect(res.jsonrpc).toBe("2.0")
			expect(res.result).toBe("0x7a69")
			expect(res.id).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("eth_blockNumber returns correct result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string; id: number }
			expect(res.result).toBe("0x0")
			expect(res.id).toBe(2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// ID propagation
	// -----------------------------------------------------------------------

	it.effect("propagates string id", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: "abc" })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { id: string }
			expect(res.id).toBe("abc")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("propagates null id", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: null })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { id: null }
			expect(res.id).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Parse error — invalid JSON (-32700)
	// -----------------------------------------------------------------------

	it.effect("returns -32700 for invalid JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const raw = yield* handleRequest(node)("not json at all {{{")
			const res = JSON.parse(raw) as { error: { code: number; message: string }; id: null }
			expect(res.error.code).toBe(-32700)
			expect(res.id).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Invalid request (-32600)
	// -----------------------------------------------------------------------

	it.effect("returns -32600 for missing jsonrpc field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ method: "eth_chainId", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number }; id: number }
			expect(res.error.code).toBe(-32600)
			expect(res.id).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns -32600 for missing method field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number }; id: number }
			expect(res.error.code).toBe(-32600)
			expect(res.id).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns -32600 for non-object body", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify("just a string")
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number }; id: null }
			expect(res.error.code).toBe(-32600)
			expect(res.id).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Method not found (-32601)
	// -----------------------------------------------------------------------

	it.effect("returns -32601 for unknown method", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_unknownMethod", params: [], id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number; message: string }; id: number }
			expect(res.error.code).toBe(-32601)
			expect(res.error.message).toContain("eth_unknownMethod")
			expect(res.id).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Batch requests
	// -----------------------------------------------------------------------

	it.effect("handles batch request", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
				{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
			])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ result: string; id: number }>
			expect(Array.isArray(res)).toBe(true)
			expect(res).toHaveLength(2)
			expect(res[0]?.result).toBe("0x7a69")
			expect(res[0]?.id).toBe(1)
			expect(res[1]?.result).toBe("0x0")
			expect(res[1]?.id).toBe(2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns error for empty batch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number } }
			expect(res.error.code).toBe(-32600)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles mixed batch with valid and invalid requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify([
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
				{ jsonrpc: "2.0", method: "eth_unknownMethod", params: [], id: 2 },
				{ invalid: true },
			])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{ result?: string; error?: { code: number }; id: number | null }>
			expect(res).toHaveLength(3)
			// First: success
			expect(res[0]?.result).toBe("0x7a69")
			// Second: method not found
			expect(res[1]?.error?.code).toBe(-32601)
			// Third: invalid request
			expect(res[2]?.error?.code).toBe(-32600)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Params default to empty array
	// -----------------------------------------------------------------------

	it.effect("defaults params to empty array when omitted", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", id: 1 })
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { result: string }
			expect(res.result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
