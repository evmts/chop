import { Data } from "effect"

/**
 * Error returned when a block is not found by hash or number.
 *
 * @example
 * ```ts
 * import { BlockNotFoundError } from "#blockchain/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new BlockNotFoundError({ identifier: "0xdead" }))
 *
 * program.pipe(
 *   Effect.catchTag("BlockNotFoundError", (e) => Effect.log(e.identifier))
 * )
 * ```
 */
export class BlockNotFoundError extends Data.TaggedError("BlockNotFoundError")<{
	readonly identifier: string
}> {}

/**
 * Error returned when a block fails validation.
 *
 * @example
 * ```ts
 * import { InvalidBlockError } from "#blockchain/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new InvalidBlockError({ message: "gas limit out of bounds" }))
 *
 * program.pipe(
 *   Effect.catchTag("InvalidBlockError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class InvalidBlockError extends Data.TaggedError("InvalidBlockError")<{
	readonly message: string
}> {}

/**
 * Error returned when genesis block initialization fails.
 *
 * @example
 * ```ts
 * import { GenesisError } from "#blockchain/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new GenesisError({ message: "genesis already initialized" }))
 *
 * program.pipe(
 *   Effect.catchTag("GenesisError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class GenesisError extends Data.TaggedError("GenesisError")<{
	readonly message: string
}> {}

/**
 * Error returned when canonical chain operations fail.
 *
 * @example
 * ```ts
 * import { CanonicalChainError } from "#blockchain/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new CanonicalChainError({ message: "gap in canonical chain", blockNumber: 5n }))
 *
 * program.pipe(
 *   Effect.catchTag("CanonicalChainError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class CanonicalChainError extends Data.TaggedError("CanonicalChainError")<{
	readonly message: string
	readonly blockNumber?: bigint | undefined
}> {}
