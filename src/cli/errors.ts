import { Data } from "effect"

/**
 * CLI-specific error type.
 * Used for argument validation, flag parsing, and command-level errors.
 *
 * @example
 * ```ts
 * import { CliError } from "#cli/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new CliError({ message: "Invalid argument" }))
 *
 * program.pipe(
 *   Effect.catchTag("CliError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class CliError extends Data.TaggedError("CliError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
