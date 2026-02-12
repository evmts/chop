/**
 * RPC HTTP Client — makes JSON-RPC 2.0 calls to a remote Ethereum node.
 *
 * Uses @effect/platform HttpClient for HTTP transport.
 * Each call requires HttpClient.HttpClient in context (provided by FetchHttpClient.layer).
 */

import { HttpClient, HttpClientRequest } from "@effect/platform"
import { Data, Effect } from "effect"

// ============================================================================
// Error Types
// ============================================================================

/** Error for RPC HTTP client failures (connection, parse, RPC error). */
export class RpcClientError extends Data.TaggedError("RpcClientError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

// ============================================================================
// Types
// ============================================================================

/** JSON-RPC 2.0 response shape. */
export interface JsonRpcResponseShape {
	readonly jsonrpc: "2.0"
	readonly id: number | string | null
	readonly result?: unknown
	readonly error?: {
		readonly code: number
		readonly message: string
		readonly data?: unknown
	}
}

// ============================================================================
// RPC Call
// ============================================================================

/**
 * Make a JSON-RPC 2.0 call to a remote Ethereum node.
 *
 * @param url - The JSON-RPC endpoint URL
 * @param method - The RPC method name (e.g. "eth_chainId")
 * @param params - The RPC method parameters
 * @returns The `result` field from the JSON-RPC response
 *
 * Requires HttpClient.HttpClient in context.
 */
export const rpcCall = (
	url: string,
	method: string,
	params: readonly unknown[] = [],
): Effect.Effect<unknown, RpcClientError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient

		const request = HttpClientRequest.post(url).pipe(
			HttpClientRequest.bodyUnsafeJson({
				jsonrpc: "2.0",
				method,
				params,
				id: 1,
			}),
		)

		const response = yield* client
			.execute(request)
			.pipe(Effect.mapError((e) => new RpcClientError({ message: `RPC request failed: ${e.message}`, cause: e })))

		const json = (yield* response.json.pipe(
			Effect.mapError(
				(e) =>
					new RpcClientError({
						message: `Failed to parse RPC response: ${e instanceof Error ? e.message : String(e)}`,
						cause: e,
					}),
			),
		)) as JsonRpcResponseShape

		if (json.error) {
			return yield* Effect.fail(
				new RpcClientError({
					message: `RPC error (${json.error.code}): ${json.error.message}`,
					cause: json.error,
				}),
			)
		}

		return json.result
	})
