import { Data } from "effect"

/**
 * TUI-specific error type.
 * Used for renderer initialization failures, component errors, and runtime TUI issues.
 *
 * @example
 * ```ts
 * import { TuiError } from "#tui/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new TuiError({ message: "Renderer init failed" }))
 *
 * program.pipe(
 *   Effect.catchTag("TuiError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class TuiError extends Data.TaggedError("TuiError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
