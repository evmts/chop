/**
 * Additional coverage tests for rpc/server.ts.
 *
 * Covers:
 * - Custom host parameter "0.0.0.0" binding (exercises the config.host path)
 * - Default host fallback (exercises the `config.host ?? "127.0.0.1"` path)
 * - Server bound to 0.0.0.0 handles POST, non-POST, and multiple requests
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
// Custom host binding — 0.0.0.0
// ---------------------------------------------------------------------------

describe("RPC Server — custom host 0.0.0.0", () => {
	it.effect("starts and responds when bound to 0.0.0.0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "0.0.0.0" }, node)
			try {
				expect(server.port).toBeGreaterThan(0)

				// 0.0.0.0 binds all interfaces, so 127.0.0.1 should work
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
				expect(body).toHaveProperty("result", "0x7a69")
				expect(body).toHaveProperty("id", 1)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles multiple requests on 0.0.0.0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "0.0.0.0" }, node)
			try {
				// First request — eth_chainId
				const res1: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
					}),
				)
				const body1 = yield* Effect.tryPromise(() => res1.json() as Promise<Record<string, unknown>>)
				expect(body1).toHaveProperty("result", "0x7a69")

				// Second request — eth_blockNumber
				const res2: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
					}),
				)
				const body2 = yield* Effect.tryPromise(() => res2.json() as Promise<Record<string, unknown>>)
				expect(body2).toHaveProperty("result", "0x0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 405 for GET on 0.0.0.0 host", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "0.0.0.0" }, node)
			try {
				const res: FetchResponse = yield* Effect.tryPromise(() =>
					fetch(`http://127.0.0.1:${server.port}`, { method: "GET" }),
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

	it.effect("close shuts down cleanly on 0.0.0.0 host", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "0.0.0.0" }, node)
			const port = server.port

			// Verify it responds before close
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

			// After close, connection should fail
			const error = yield* Effect.tryPromise(() => fetch(`http://127.0.0.1:${port}`, { method: "GET" })).pipe(
				Effect.flip,
			)
			expect(error).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Default host fallback — no host provided
// ---------------------------------------------------------------------------

describe("RPC Server — default host fallback", () => {
	it.effect("uses 127.0.0.1 when no host is specified", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// No host config — exercises the `config.host ?? "127.0.0.1"` fallback
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
				expect(body).toHaveProperty("result", "0x7a69")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
