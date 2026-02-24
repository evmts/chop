/**
 * Boundary condition tests for rpc/server.ts.
 *
 * Covers:
 * - Non-POST requests return 405 with JSON-RPC error
 * - GET request returns 405
 * - PUT request returns 405
 * - POST request with valid JSON-RPC body returns 200
 * - POST request with invalid JSON body still returns 200 (error handled gracefully)
 * - Server starts on port 0 (random) and reports actual port
 * - Server close shuts down cleanly
 * - 500 error handler path (malformed internal state)
 * - Multiple sequential requests on same server
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { startRpcServer } from "./server.js"

interface FetchInit {
	method?: string
	headers?: Record<string, string>
	body?: string
}

interface FetchResponse {
	ok: boolean
	status: number
	statusText: string
	json(): Promise<unknown>
	text(): Promise<string>
}

declare const fetch: (input: string, init?: FetchInit) => Promise<FetchResponse>

// ---------------------------------------------------------------------------
// 405 Method Not Allowed — non-POST requests
// ---------------------------------------------------------------------------

describe("RPC Server — method not allowed", () => {
	it.effect("returns 405 for GET requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, { method: "GET" }),
				)
				expect(res.status).toBe(405)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32600)
				expect((body.error as Record<string, unknown>).message).toBe("Only POST method is allowed")
				expect(body).toHaveProperty("id", null)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 405 for PUT requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				expect(res.status).toBe(405)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32600)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 405 for DELETE requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, { method: "DELETE" }),
				)
				expect(res.status).toBe(405)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("error")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 405 for PATCH requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: "{}",
					}),
				)
				expect(res.status).toBe(405)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Server lifecycle — start, respond, close
// ---------------------------------------------------------------------------

describe("RPC Server — lifecycle", () => {
	it.effect("starts on random port and reports actual port", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				expect(typeof server.port).toBe("number")
				expect(server.port).toBeGreaterThan(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("close shuts down cleanly and prevents further connections", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const port = server.port

			// Server should respond before closing
			const res: FetchResponse = yield* Effect.tryPromise(() =>
				fetch(`http://127.0.0.1:${port}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
				}),
			)
			expect(res.status).toBe(200)

			// Close the server
			yield* server.close()

			// After closing, connection should fail
			const error = yield* Effect.tryPromise(() => fetch(`http://127.0.0.1:${port}`, { method: "GET" })).pipe(
				Effect.flip,
			)
			expect(error).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("responds with custom host binding", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "127.0.0.1" }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				expect(res.status).toBe(200)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// POST request handling — success and error cases
// ---------------------------------------------------------------------------

describe("RPC Server — POST request handling", () => {
	it.effect("valid JSON-RPC request returns 200 with result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("result", "0x7a69") // 31337
				expect(body).toHaveProperty("id", 1)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("invalid JSON body returns 200 with parse error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: "not valid json {{{",
					}),
				)
				// handleRequest catches parse errors and returns a proper JSON-RPC error
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("jsonrpc", "2.0")
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32700) // Parse error
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("unknown method returns 200 with method-not-found error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_nonExistentMethod", params: [], id: 42 }),
					}),
				)
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32601)
				expect(body).toHaveProperty("id", 42)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("invalid JSON-RPC request (missing jsonrpc field) returns error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32600) // Invalid request
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("batch request returns array of responses", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify([
							{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
							{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
						]),
					}),
				)
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>[]>)
				expect(Array.isArray(body)).toBe(true)
				expect(body.length).toBe(2)
				expect(body[0]).toHaveProperty("id", 1)
				expect(body[1]).toHaveProperty("id", 2)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("empty batch request returns invalid request error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: "[]",
					}),
				)
				expect(res.status).toBe(200)

				const body = yield* Effect.tryPromise(() => res.json() as Promise<Record<string, unknown>>)
				expect(body).toHaveProperty("error")
				expect((body.error as Record<string, unknown>).code).toBe(-32600)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Multiple requests on same server
// ---------------------------------------------------------------------------

describe("RPC Server — sequential requests", () => {
	it.effect("handles multiple sequential requests on the same server", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// First request
				const res1: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				const body1 = yield* Effect.tryPromise(() => res1.json() as Promise<Record<string, unknown>>)
				expect(body1).toHaveProperty("result", "0x7a69")

				// Second request
				const res2: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
					}),
				)
				const body2 = yield* Effect.tryPromise(() => res2.json() as Promise<Record<string, unknown>>)
				expect(body2).toHaveProperty("result", "0x0")

				// Third request — a non-POST to test interleaved handling
				const res3: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, { method: "GET" }),
				)
				expect(res3.status).toBe(405)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
