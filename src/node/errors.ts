import { Data } from "effect"

/**
 * Error during node initialization.
 * Raised when the node fails to create its composed service layer
 * (e.g. genesis block initialization failure).
 *
 * @example
 * ```ts
 * import { NodeInitError } from "#node/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new NodeInitError({ message: "genesis failed" }))
 *
 * program.pipe(
 *   Effect.catchTag("NodeInitError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class NodeInitError extends Data.TaggedError("NodeInitError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
