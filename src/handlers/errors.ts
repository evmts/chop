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

// ---------------------------------------------------------------------------
// Transaction-specific errors
// ---------------------------------------------------------------------------

/** Sender does not have enough ETH to cover value + gas * gasPrice. */
export class InsufficientBalanceError extends Data.TaggedError("InsufficientBalanceError")<{
	readonly message: string
	readonly required: bigint
	readonly available: bigint
}> {}

/** Transaction nonce is lower than the account's current nonce. */
export class NonceTooLowError extends Data.TaggedError("NonceTooLowError")<{
	readonly message: string
	readonly expected: bigint
	readonly actual: bigint
}> {}

/** Gas limit is below the intrinsic gas cost for the transaction. */
export class IntrinsicGasTooLowError extends Data.TaggedError("IntrinsicGasTooLowError")<{
	readonly message: string
	readonly required: bigint
	readonly provided: bigint
}> {}

/** maxFeePerGas is below the block's baseFee. */
export class MaxFeePerGasTooLowError extends Data.TaggedError("MaxFeePerGasTooLowError")<{
	readonly message: string
	readonly maxFeePerGas: bigint
	readonly baseFee: bigint
}> {}

/** Transaction not found in the pool or chain. */
export class TransactionNotFoundError extends Data.TaggedError("TransactionNotFoundError")<{
	readonly hash: string
}> {}
