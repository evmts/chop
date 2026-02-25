// ---------------------------------------------------------------------------
// JSON-RPC 2.0 request/response interfaces
// ---------------------------------------------------------------------------

/** A valid JSON-RPC 2.0 request object. */
export interface JsonRpcRequest {
	readonly jsonrpc: string
	readonly method: string
	readonly params?: readonly unknown[]
	readonly id: number | string | null
}

/** A successful JSON-RPC 2.0 response. */
export interface JsonRpcSuccessResponse {
	readonly jsonrpc: "2.0"
	readonly result: unknown
	readonly id: number | string | null
}

/** An error JSON-RPC 2.0 response. */
export interface JsonRpcErrorResponse {
	readonly jsonrpc: "2.0"
	readonly error: {
		readonly code: number
		readonly message: string
		readonly data?: unknown
	}
	readonly id: number | string | null
}

/** Either a success or error JSON-RPC 2.0 response. */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/** Create a JSON-RPC 2.0 success response. */
export const makeSuccessResponse = (id: number | string | null, result: unknown): JsonRpcSuccessResponse => ({
	jsonrpc: "2.0",
	result,
	id,
})

/** Create a JSON-RPC 2.0 error response. */
export const makeErrorResponse = (id: number | string | null, code: number, message: string): JsonRpcErrorResponse => ({
	jsonrpc: "2.0",
	error: { code, message },
	id,
})
