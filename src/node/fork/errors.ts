import { Data } from "effect"

/**
 * Error from a JSON-RPC call to the fork upstream.
 *
 * @example
 * ```ts
 * import { ForkRpcError } from "#node/fork/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new ForkRpcError({ method: "eth_getBalance", message: "timeout" }))
 *
 * program.pipe(
 *   Effect.catchTag("ForkRpcError", (e) => Effect.log(`${e.method}: ${e.message}`))
 * )
 * ```
 */
export class ForkRpcError extends Data.TaggedError("ForkRpcError")<{
	readonly method: string
	readonly message: string
	readonly cause?: unknown
}> {}

/**
 * Error parsing or validating data returned from fork upstream.
 *
 * @example
 * ```ts
 * import { ForkDataError } from "#node/fork/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new ForkDataError({ message: "invalid hex balance" }))
 *
 * program.pipe(
 *   Effect.catchTag("ForkDataError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class ForkDataError extends Data.TaggedError("ForkDataError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

/**
 * HTTP transport timeout error.
 *
 * @example
 * ```ts
 * import { TransportTimeoutError } from "#node/fork/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new TransportTimeoutError({ url: "http://localhost:8545", timeoutMs: 10000 }))
 *
 * program.pipe(
 *   Effect.catchTag("TransportTimeoutError", (e) => Effect.log(`timeout after ${e.timeoutMs}ms`))
 * )
 * ```
 */
export class TransportTimeoutError extends Data.TaggedError("TransportTimeoutError")<{
	readonly url: string
	readonly timeoutMs: number
}> {}
