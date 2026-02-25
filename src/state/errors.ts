import { Data } from "effect"

/**
 * Error returned when a storage operation targets a non-existent account.
 *
 * @example
 * ```ts
 * import { MissingAccountError } from "#state/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new MissingAccountError({ address: "0xdead" }))
 *
 * program.pipe(
 *   Effect.catchTag("MissingAccountError", (e) => Effect.log(e.address))
 * )
 * ```
 */
export class MissingAccountError extends Data.TaggedError("MissingAccountError")<{
	readonly address: string
}> {}

/**
 * Error returned when restoring or committing an invalid snapshot.
 *
 * @example
 * ```ts
 * import { InvalidSnapshotError } from "#state/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new InvalidSnapshotError({ snapshotId: 42, message: "not found" }))
 *
 * program.pipe(
 *   Effect.catchTag("InvalidSnapshotError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class InvalidSnapshotError extends Data.TaggedError("InvalidSnapshotError")<{
	readonly snapshotId: number
	readonly message: string
}> {}
