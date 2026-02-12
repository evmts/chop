import { Data } from "effect"

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 error codes
// ---------------------------------------------------------------------------

/** Standard JSON-RPC 2.0 error codes. */
export const RpcErrorCode = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
} as const

// ---------------------------------------------------------------------------
// Error types — one per JSON-RPC error code
// ---------------------------------------------------------------------------

/** JSON could not be parsed. Code: -32700. */
export class ParseError extends Data.TaggedError("ParseError")<{
	readonly message: string
}> {}

/** Request is not a valid JSON-RPC 2.0 request. Code: -32600. */
export class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<{
	readonly message: string
}> {}

/** Method does not exist. Code: -32601. */
export class MethodNotFoundError extends Data.TaggedError("MethodNotFoundError")<{
	readonly method: string
}> {}

/** Invalid method parameters. Code: -32602. */
export class InvalidParamsError extends Data.TaggedError("InvalidParamsError")<{
	readonly message: string
}> {}

/** Internal error during procedure execution. Code: -32603. */
export class InternalError extends Data.TaggedError("InternalError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

/** Union of all JSON-RPC error types. */
export type RpcError = ParseError | InvalidRequestError | MethodNotFoundError | InvalidParamsError | InternalError

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map an RpcError to its numeric JSON-RPC error code. */
export const rpcErrorCode = (error: RpcError): number => {
	switch (error._tag) {
		case "ParseError":
			return RpcErrorCode.PARSE_ERROR
		case "InvalidRequestError":
			return RpcErrorCode.INVALID_REQUEST
		case "MethodNotFoundError":
			return RpcErrorCode.METHOD_NOT_FOUND
		case "InvalidParamsError":
			return RpcErrorCode.INVALID_PARAMS
		case "InternalError":
			return RpcErrorCode.INTERNAL_ERROR
	}
}

/** Map an RpcError to a human-readable message string. */
export const rpcErrorMessage = (error: RpcError): string => {
	switch (error._tag) {
		case "ParseError":
			return error.message
		case "InvalidRequestError":
			return error.message
		case "MethodNotFoundError":
			return `Method not found: ${error.method}`
		case "InvalidParamsError":
			return error.message
		case "InternalError":
			return error.message
	}
}
