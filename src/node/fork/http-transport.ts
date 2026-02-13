/**
 * HttpTransportService — sends JSON-RPC requests to a remote Ethereum node.
 *
 * Features: retry with exponential backoff, per-request timeout, batch RPC.
 * Uses globalThis.fetch for portability.
 */

import { Context, Effect, Layer, Schedule } from "effect"
import { ForkRpcError, TransportTimeoutError } from "./errors.js"

// ---------------------------------------------------------------------------
// Minimal fetch types (no DOM lib available)
// ---------------------------------------------------------------------------

interface FetchInit {
	method?: string
	headers?: Record<string, string>
	body?: string
	signal?: AbortSignal
}

interface FetchResponse {
	ok: boolean
	status: number
	statusText: string
	text(): Promise<string>
}

declare const fetch: (input: string, init?: FetchInit) => Promise<FetchResponse>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** JSON-RPC request shape. */
export interface JsonRpcRequest {
	readonly jsonrpc: "2.0"
	readonly method: string
	readonly params: readonly unknown[]
	readonly id: number
}

/** JSON-RPC response shape. */
export interface JsonRpcResponse {
	readonly jsonrpc: "2.0"
	readonly id: number
	readonly result?: unknown
	readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown }
}

/** Configuration for the HTTP transport. */
export interface HttpTransportConfig {
	/** The upstream RPC URL. */
	readonly url: string
	/** Per-request timeout in milliseconds (default: 10_000). */
	readonly timeoutMs?: number
	/** Maximum number of retries (default: 3). */
	readonly maxRetries?: number
}

/** Shape of the HttpTransport service API. */
export interface HttpTransportApi {
	/** Send a single JSON-RPC request. */
	readonly request: (method: string, params: readonly unknown[]) => Effect.Effect<unknown, ForkRpcError>
	/** Send a batch of JSON-RPC requests. Returns results in order. */
	readonly batchRequest: (
		calls: readonly { readonly method: string; readonly params: readonly unknown[] }[],
	) => Effect.Effect<readonly unknown[], ForkRpcError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for HttpTransportService. */
export class HttpTransportService extends Context.Tag("HttpTransport")<HttpTransportService, HttpTransportApi>() {}

// ---------------------------------------------------------------------------
// Internal — raw fetch with timeout
// ---------------------------------------------------------------------------

const fetchWithTimeout = (
	url: string,
	body: string,
	timeoutMs: number,
): Effect.Effect<string, ForkRpcError | TransportTimeoutError> =>
	Effect.tryPromise({
		try: () => {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), timeoutMs)
			return fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
				signal: controller.signal,
			})
				.then(async (res: FetchResponse) => {
					clearTimeout(timer)
					if (!res.ok) {
						throw new Error(`HTTP ${res.status}: ${res.statusText}`)
					}
					return res.text()
				})
				.catch((err: unknown) => {
					clearTimeout(timer)
					throw err
				})
		},
		catch: (error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return new TransportTimeoutError({ url, timeoutMs })
			}
			return new ForkRpcError({
				method: "fetch",
				message: error instanceof Error ? error.message : String(error),
				cause: error,
			})
		},
	})

// ---------------------------------------------------------------------------
// Internal — parse JSON-RPC response
// ---------------------------------------------------------------------------

const parseResponse = (text: string, method: string): Effect.Effect<JsonRpcResponse, ForkRpcError> =>
	Effect.try({
		try: () => JSON.parse(text) as JsonRpcResponse,
		catch: (e) => new ForkRpcError({ method, message: `Invalid JSON response: ${e}` }),
	})

const parseBatchResponse = (text: string): Effect.Effect<readonly JsonRpcResponse[], ForkRpcError> =>
	Effect.try({
		try: () => JSON.parse(text) as JsonRpcResponse[],
		catch: (e) => new ForkRpcError({ method: "batch", message: `Invalid JSON batch response: ${e}` }),
	})

// ---------------------------------------------------------------------------
// Layer — factory function
// ---------------------------------------------------------------------------

/** Create an HttpTransportService layer. */
export const HttpTransportLive = (config: HttpTransportConfig): Layer.Layer<HttpTransportService> => {
	const timeoutMs = config.timeoutMs ?? 10_000
	const maxRetries = config.maxRetries ?? 3
	let idCounter = 1

	const retrySchedule = Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(maxRetries)))

	return Layer.succeed(HttpTransportService, {
		request: (method, params) =>
			Effect.gen(function* () {
				const id = idCounter++
				const body = JSON.stringify({ jsonrpc: "2.0", method, params, id })
				const text = yield* fetchWithTimeout(config.url, body, timeoutMs).pipe(
					Effect.retry(retrySchedule),
					Effect.catchTag("TransportTimeoutError", (e) =>
						Effect.fail(
							new ForkRpcError({
								method,
								message: `Request timed out after ${e.timeoutMs}ms`,
							}),
						),
					),
				)
				const response = yield* parseResponse(text, method)
				if (response.error) {
					return yield* Effect.fail(
						new ForkRpcError({
							method,
							message: `RPC error ${response.error.code}: ${response.error.message}`,
						}),
					)
				}
				return response.result
			}),

		batchRequest: (calls) =>
			Effect.gen(function* () {
				if (calls.length === 0) return []
				const requests = calls.map((c, i) => ({
					jsonrpc: "2.0" as const,
					method: c.method,
					params: c.params,
					id: idCounter + i,
				}))
				idCounter += calls.length

				const body = JSON.stringify(requests)
				const text = yield* fetchWithTimeout(config.url, body, timeoutMs).pipe(
					Effect.retry(retrySchedule),
					Effect.catchTag("TransportTimeoutError", (e) =>
						Effect.fail(
							new ForkRpcError({
								method: "batch",
								message: `Batch request timed out after ${e.timeoutMs}ms`,
							}),
						),
					),
				)

				const responses = yield* parseBatchResponse(text)

				// Sort responses by id to match request order
				const sorted = [...responses].sort((a, b) => a.id - b.id)

				// Check for errors in any response
				for (const r of sorted) {
					if (r.error) {
						return yield* Effect.fail(
							new ForkRpcError({
								method: "batch",
								message: `RPC error in batch: ${r.error.code}: ${r.error.message}`,
							}),
						)
					}
				}

				return sorted.map((r) => r.result)
			}),
	} satisfies HttpTransportApi)
}
