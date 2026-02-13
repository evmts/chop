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
// Timeout — single request (lines 162-168)
// ---------------------------------------------------------------------------

describe("HttpTransportService — request timeout", () => {
	it.effect("returns ForkRpcError when single request times out", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, 10_000)
					if (init.signal) {
						init.signal.addEventListener("abort", () => {
							clearTimeout(timer)
							const err = new Error("The operation was aborted")
							err.name = "AbortError"
							reject(err)
						})
					}
				})
				return jsonResponse({ jsonrpc: "2.0", id: 1, result: "0x1" })
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport.request("eth_blockNumber", []).pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
				expect(error.message).toContain("timed out")
				expect(error.message).toContain("50ms")
				expect(error.method).toBe("eth_blockNumber")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer({ timeoutMs: 50, maxRetries: 0 }))),
	)
})

// ---------------------------------------------------------------------------
// Timeout — batch request (lines 197-203)
// ---------------------------------------------------------------------------

describe("HttpTransportService — batch request timeout", () => {
	it.effect("returns ForkRpcError when batch request times out", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async (_url, init) => {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, 10_000)
					if (init.signal) {
						init.signal.addEventListener("abort", () => {
							clearTimeout(timer)
							const err = new Error("The operation was aborted")
							err.name = "AbortError"
							reject(err)
						})
					}
				})
				return jsonResponse([])
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport
					.batchRequest([
						{ method: "eth_blockNumber", params: [] },
						{ method: "eth_chainId", params: [] },
					])
					.pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
				expect(error.message).toContain("Batch request timed out")
				expect(error.message).toContain("50ms")
				expect(error.method).toBe("batch")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer({ timeoutMs: 50, maxRetries: 0 }))),
	)
})

// ---------------------------------------------------------------------------
// Network error — fetch rejection
// ---------------------------------------------------------------------------

describe("HttpTransportService — network errors", () => {
	it.effect("returns ForkRpcError when fetch rejects with network error", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async () => {
				throw new Error("Network request failed: ECONNREFUSED")
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport.request("eth_blockNumber", []).pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
				expect(error.message).toContain("ECONNREFUSED")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer({ maxRetries: 0 }))),
	)

	it.effect("returns ForkRpcError when batch fetch rejects with network error", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async () => {
				throw new Error("Network request failed: ECONNREFUSED")
			})
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport
					.batchRequest([{ method: "eth_blockNumber", params: [] }])
					.pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
				expect(error.message).toContain("ECONNREFUSED")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer({ maxRetries: 0 }))),
	)
})

// ---------------------------------------------------------------------------
// Invalid JSON — batch response
// ---------------------------------------------------------------------------

describe("HttpTransportService — invalid JSON in batch response", () => {
	it.effect("returns ForkRpcError when batch response is invalid JSON", () =>
		Effect.gen(function* () {
			const cleanup = mockFetch(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: () => Promise.resolve("not valid json [}{"),
			}))
			try {
				const transport = yield* HttpTransportService
				const error = yield* transport
					.batchRequest([
						{ method: "eth_blockNumber", params: [] },
						{ method: "eth_chainId", params: [] },
					])
					.pipe(Effect.flip)
				expect(error._tag).toBe("ForkRpcError")
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer({ maxRetries: 0 }))),
	)
})

// ---------------------------------------------------------------------------
// ID counter increments
// ---------------------------------------------------------------------------

describe("HttpTransportService — id counter", () => {
	it.effect("increments id across sequential single requests", () =>
		Effect.gen(function* () {
			const capturedIds: number[] = []
			const cleanup = mockFetch(async (_url, init) => {
				const body = JSON.parse(init.body as string)
				capturedIds.push(body.id)
				return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "0x1" })
			})
			try {
				const transport = yield* HttpTransportService
				yield* transport.request("eth_blockNumber", [])
				yield* transport.request("eth_chainId", [])
				yield* transport.request("eth_getBalance", ["0xdead", "latest"])
				expect(capturedIds).toEqual([1, 2, 3])
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("increments id correctly for batch requests", () =>
		Effect.gen(function* () {
			const capturedIds: number[][] = []
			const cleanup = mockFetch(async (_url, init) => {
				const requests = JSON.parse(init.body as string) as Array<{ id: number; method: string }>
				capturedIds.push(requests.map((r) => r.id))
				const responses = requests.map((r) => ({
					jsonrpc: "2.0",
					id: r.id,
					result: "0x1",
				}))
				return jsonResponse(responses)
			})
			try {
				const transport = yield* HttpTransportService
				// First batch: 2 calls, ids should be 1, 2
				yield* transport.batchRequest([
					{ method: "eth_blockNumber", params: [] },
					{ method: "eth_chainId", params: [] },
				])
				// Second batch: 3 calls, ids should be 3, 4, 5
				yield* transport.batchRequest([
					{ method: "eth_getBalance", params: [] },
					{ method: "eth_getCode", params: [] },
					{ method: "eth_getStorageAt", params: [] },
				])
				expect(capturedIds).toEqual([
					[1, 2],
					[3, 4, 5],
				])
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)

	it.effect("id counter shared between single and batch requests", () =>
		Effect.gen(function* () {
			const capturedIds: number[] = []
			const cleanup = mockFetch(async (_url, init) => {
				const body = JSON.parse(init.body as string)
				if (Array.isArray(body)) {
					for (const req of body) capturedIds.push(req.id)
					const responses = body.map((r: { id: number }) => ({
						jsonrpc: "2.0",
						id: r.id,
						result: "0x1",
					}))
					return jsonResponse(responses)
				}
				capturedIds.push(body.id)
				return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "0x1" })
			})
			try {
				const transport = yield* HttpTransportService
				// Single request: id 1
				yield* transport.request("eth_blockNumber", [])
				// Batch: ids 2, 3
				yield* transport.batchRequest([
					{ method: "eth_chainId", params: [] },
					{ method: "eth_getBalance", params: [] },
				])
				// Single request: id 4
				yield* transport.request("eth_getCode", [])
				expect(capturedIds).toEqual([1, 2, 3, 4])
			} finally {
				cleanup()
			}
		}).pipe(Effect.provide(TestLayer())),
	)
})
