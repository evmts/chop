/**
 * Tests for the 500 error handler path in rpc/server.ts (lines 69-79).
 *
 * The server has a rejection handler on `Effect.runPromise(handleRequest(...))`.
 * Normally handleRequest catches all errors and defects, so the promise never
 * rejects. We exercise this defensive 500 path by mocking `handleRequest` to
 * return an Effect that dies (an unrecoverable defect), which causes
 * `Effect.runPromise` to reject.
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect, vi } from "vitest"
import type { TevmNodeShape } from "../node/index.js"
import { startRpcServer } from "./server.js"

// ---------------------------------------------------------------------------
// Mock handler.js so handleRequest returns an Effect that dies (defect).
// vi.mock is hoisted by vitest, so it runs before imports are resolved.
// ---------------------------------------------------------------------------

vi.mock("./handler.js", () => ({
	handleRequest: (_node: TevmNodeShape) => (_body: string) => Effect.die("simulated unrecoverable defect"),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RPC Server - 500 error handler path", () => {
	it.effect("returns 500 with JSON-RPC error when handleRequest rejects", () =>
		Effect.gen(function* () {
			// The node is not used by the mocked handleRequest, so a stub suffices
			const stubNode = {} as TevmNodeShape
			const server = yield* startRpcServer({ port: 0 }, stubNode)

			try {
				const res = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)

				expect(res.status).toBe(500)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32603)
				expect((body.error as Record<string, unknown>).message).toBe("Unexpected server error")
				expect(body).toHaveProperty("id", null)
			} finally {
				yield* server.close()
			}
		}),
	)

	it.effect("500 path works for batch requests too", () =>
		Effect.gen(function* () {
			const stubNode = {} as TevmNodeShape
			const server = yield* startRpcServer({ port: 0 }, stubNode)

			try {
				const res = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify([
							{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
							{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
						]),
					}),
				)

				// The mocked handleRequest dies regardless of body content
				expect(res.status).toBe(500)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32603)
				expect((body.error as Record<string, unknown>).message).toBe("Unexpected server error")
				expect(body).toHaveProperty("id", null)
			} finally {
				yield* server.close()
			}
		}),
	)

	it.effect("non-POST requests still return 405 even when handler is broken", () =>
		Effect.gen(function* () {
			const stubNode = {} as TevmNodeShape
			const server = yield* startRpcServer({ port: 0 }, stubNode)

			try {
				// GET request should be rejected before handleRequest is ever called
				const res = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, { method: "GET" }),
				)

				expect(res.status).toBe(405)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32600)
				expect((body.error as Record<string, unknown>).message).toBe("Only POST method is allowed")
			} finally {
				yield* server.close()
			}
		}),
	)

	it.effect("server remains functional after 500 error (handles subsequent requests)", () =>
		Effect.gen(function* () {
			const stubNode = {} as TevmNodeShape
			const server = yield* startRpcServer({ port: 0 }, stubNode)

			try {
				// First request triggers 500
				const res1 = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				expect(res1.status).toBe(500)

				// Second request also triggers 500 (server did not crash)
				const res2 = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
					}),
				)
				expect(res2.status).toBe(500)

				const body2 = yield* Effect.tryPromise(() => res2.json() as Promise<Record<string, unknown>>)
				expect(body2).toHaveProperty("jsonrpc", "2.0")
				expect((body2.error as Record<string, unknown>).code).toBe(-32603)
			} finally {
				yield* server.close()
			}
		}),
	)
})
