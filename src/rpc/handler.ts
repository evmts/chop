import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import { InvalidRequestError, ParseError, type RpcError, rpcErrorCode, rpcErrorMessage } from "../procedures/errors.js"
import { methodRouter } from "../procedures/router.js"
import { type JsonRpcResponse, makeErrorResponse, makeSuccessResponse } from "../procedures/types.js"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse raw JSON string, failing with ParseError on invalid input. */
const parseJson = (body: string): Effect.Effect<unknown, ParseError> =>
	Effect.try({
		try: () => JSON.parse(body) as unknown,
		catch: () => new ParseError({ message: "Parse error: invalid JSON" }),
	})

/** Validate that a parsed value conforms to JSON-RPC 2.0 request structure. */
const validateRequest = (
	json: unknown,
): Effect.Effect<{ method: string; params: readonly unknown[]; id: number | string | null }, InvalidRequestError> => {
	if (typeof json !== "object" || json === null) {
		return Effect.fail(new InvalidRequestError({ message: "Invalid request: not an object" }))
	}
	const obj = json as Record<string, unknown>
	if (obj.jsonrpc !== "2.0") {
		return Effect.fail(new InvalidRequestError({ message: "Invalid request: missing or invalid jsonrpc field" }))
	}
	if (typeof obj.method !== "string") {
		return Effect.fail(new InvalidRequestError({ message: "Invalid request: missing or invalid method field" }))
	}
	const params = Array.isArray(obj.params) ? (obj.params as readonly unknown[]) : []
	const id = (obj.id !== undefined ? obj.id : null) as number | string | null
	return Effect.succeed({ method: obj.method, params, id })
}

/** Extract the `id` field from a raw parsed value, defaulting to null. */
const extractId = (json: unknown): number | string | null => {
	if (typeof json === "object" && json !== null && "id" in json) {
		return (json as { id: unknown }).id as number | string | null
	}
	return null
}

// ---------------------------------------------------------------------------
// Single request handler
// ---------------------------------------------------------------------------

/** Handle a single JSON-RPC request (already parsed from JSON). */
const handleSingleRequest =
	(node: TevmNodeShape) =>
	(json: unknown): Effect.Effect<JsonRpcResponse> =>
		Effect.gen(function* () {
			const request = yield* validateRequest(json)
			const result = yield* methodRouter(node)(request.method, request.params)
			return makeSuccessResponse(request.id, result)
		}).pipe(
			Effect.catchAll((error: RpcError) =>
				Effect.succeed(makeErrorResponse(extractId(json), rpcErrorCode(error), rpcErrorMessage(error))),
			),
			// Catch defects (unexpected throws) to prevent server crashes
			Effect.catchAllDefect((defect) =>
				Effect.succeed(makeErrorResponse(extractId(json), -32603, `Internal error: ${String(defect)}`)),
			),
		)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle a raw JSON-RPC request body string.
 * Supports both single and batch requests.
 * Always returns a JSON string (never fails).
 */
export const handleRequest =
	(node: TevmNodeShape) =>
	(body: string): Effect.Effect<string> =>
		Effect.gen(function* () {
			const parsed = yield* parseJson(body)

			if (Array.isArray(parsed)) {
				// Batch request
				if (parsed.length === 0) {
					return JSON.stringify(makeErrorResponse(null, -32600, "Invalid request: empty batch"))
				}
				const responses = yield* Effect.all(
					parsed.map((item: unknown) => handleSingleRequest(node)(item)),
					{ concurrency: "unbounded" },
				)
				return JSON.stringify(responses)
			}

			// Single request
			const response = yield* handleSingleRequest(node)(parsed)
			return JSON.stringify(response)
		}).pipe(
			Effect.catchAll((error: ParseError) =>
				Effect.succeed(JSON.stringify(makeErrorResponse(null, rpcErrorCode(error), rpcErrorMessage(error)))),
			),
		)
