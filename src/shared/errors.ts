import { Data } from "effect"

/**
 * Base error type for all chop domain errors.
 * All specific errors should extend this or use it directly.
 *
 * @example
 * ```ts
 * import { ChopError } from "#shared/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new ChopError({ message: "something went wrong" }))
 *
 * // Recover with catchTag
 * program.pipe(
 *   Effect.catchTag("ChopError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class ChopError extends Data.TaggedError("ChopError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
