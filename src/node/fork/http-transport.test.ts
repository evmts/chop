import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect, vi } from "vitest"
import { HttpTransportLive, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Minimal types for mock fetch (no DOM lib)
// ---------------------------------------------------------------------------

interface MinimalFetchInit {
	method?: string
	headers?: Record<string, string>
	body?: string
	signal?: AbortSignal
}

interface MinimalFetchResponse {
	ok: boolean
	status: number
	statusText: string
	text(): Promise<string>
}

// ---------------------------------------------------------------------------
// Mock fetch helper
// ---------------------------------------------------------------------------

const mockFetch = (handler: (url: string, init: MinimalFetchInit) => Promise<MinimalFetchResponse>) => {
	const g = globalThis as unknown as Record<string, unknown>
	const original = g.fetch
	g.fetch = vi.fn(handler as (...args: unknown[]) => unknown)
	return () => {
		g.fetch = original
	}
}

const jsonResponse = (data: unknown, status = 200): MinimalFetchResponse => ({
	ok: status >= 200 && status < 300,
	status,
	statusText: status === 200 ? "OK" : "Error",
	text: () => Promise.resolve(JSON.stringify(data)),
})

// ---------------------------------------------------------------------------
// Test layer factory
// ---------------------------------------------------------------------------

const TestLayer = (config?: { timeoutMs?: number; maxRetries?: number }) =>
	HttpTransportLive({
		url: "http://localhost:8545",
		timeoutMs: config?.timeoutMs ?? 5000,
		maxRetries: config?.maxRetries ?? 0,
	})

// ---------------------------------------------------------------------------
// Single request
// ---------------------------------------------------------------------------

describe("HttpTransportService — request", () => {
	it.effect("sends a JSON-RPC request and returns result", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				const body = JSON.parse(init.body as string)
				expect(body.method).toBe("eth_blockNumber")
				expect(body.jsonrpc).toBe("2.0")
				return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "0x42" })
			})
			try {
				const transport = yield* HttpTransportService
				const result = yield* transport.request("eth_blockNumber", [])
				expect(result).toBe("0x42")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("returns ForkRpcError on RPC error response", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				const body = JSON.parse(init.body as string)
				return jsonResponse({
					jsonrpc: "2.0",
					id: body.id,
					error: { code: -32601, message: "Method not found" },
				})
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport.request("eth_foo", []).pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
				expect(error.method).toBe("eth_foo")
				expect(error.message).toContain("-32601")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("returns ForkRpcError on HTTP error", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async () => ({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("Internal Server Error"),
			}))
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport.request("eth_blockNumber", []).pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("returns ForkRpcError on invalid JSON response", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: () => Promise.resolve("not json"),
			}))
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport.request("eth_blockNumber", []).pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("passes params correctly", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				const body = JSON.parse(init.body as string)
				expect(body.params).toEqual(["0xdead", "latest"])
				return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "0x100" })
			})
			try {
				const transport = yield* HttpTransportService
				const result = yield* transport.request("eth_getBalance", ["0xdead", "latest"])
				expect(result).toBe("0x100")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)
})

// ---------------------------------------------------------------------------
// Batch request
// ---------------------------------------------------------------------------

describe("HttpTransportService — batchRequest", () => {
	it.effect("sends batch and returns results in order", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				const requests = JSON.parse(init.body as string) as Array<{ id: number; method: string }>
				expect(requests).toHaveLength(2)
				const responses = requests.map((r) => ({
					jsonrpc: "2.0",
					id: r.id,
					result: r.method === "eth_blockNumber" ? "0x1" : "0x7a69",
				}))
				// Return in reverse order to test sorting
				return jsonResponse(responses.reverse())
			})
			try {
				const transport = yield* HttpTransportService
				const results = yield* transport.batchRequest([
					{ method: "eth_blockNumber", params: [] },
					{ method: "eth_chainId", params: [] },
				])
				expect(results).toHaveLength(2)
				expect(results[0]).toBe("0x1")
				expect(results[1]).toBe("0x7a69")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("empty batch returns empty array", () =>
		Effect.gen(function* () {
			const transport = yield* HttpTransportService
			const results = yield* transport.batchRequest([])
			expect(results).toHaveLength(0)
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("returns ForkRpcError if any batch response has error", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				const requests = JSON.parse(init.body as string) as Array<{ id: number }>
				return jsonResponse([
					{ jsonrpc: "2.0", id: requests[0]?.id, result: "0x1" },
					{
						jsonrpc: "2.0",
						id: requests[1]?.id,
						error: { code: -32602, message: "Invalid params" },
					},
				])
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport
					.batchRequest([
						{ method: "eth_blockNumber", params: [] },
						{ method: "eth_badMethod", params: [] },
					])
					.pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)
})

// ---------------------------------------------------------------------------
// Tag identity
// ---------------------------------------------------------------------------

describe("HttpTransportService — tag", () => {
	it("has correct tag key", () => {
		expect(HttpTransportService.key).toBe("HttpTransport")
	})
})
