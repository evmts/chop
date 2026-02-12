import { Data } from "effect"

/**
 * Error raised by handler-layer business logic.
 * Wraps lower-level errors (e.g. WasmExecutionError) into a handler-level tag.
 *
 * @example
 * ```ts
 * import { HandlerError } from "#handlers/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new HandlerError({ message: "call reverted" }))
 *
 * program.pipe(
 *   Effect.catchTag("HandlerError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class HandlerError extends Data.TaggedError("HandlerError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
