import { Data } from "effect"

/**
 * Error converting between EVM byte representations and string/bigint.
 * Raised when hex strings are malformed or conversion inputs are invalid.
 *
 * @example
 * ```ts
 * import { ConversionError } from "#evm/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new ConversionError({ message: "odd-length hex" }))
 *
 * program.pipe(
 *   Effect.catchTag("ConversionError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class ConversionError extends Data.TaggedError("ConversionError")<{
	readonly message: string
}> {}

/**
 * Error loading or initializing the WASM EVM module.
 * Raised when the .wasm file can't be read, compiled, or instantiated.
 *
 * @example
 * ```ts
 * import { WasmLoadError } from "#evm/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new WasmLoadError({ message: "file not found" }))
 *
 * program.pipe(
 *   Effect.catchTag("WasmLoadError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class WasmLoadError extends Data.TaggedError("WasmLoadError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

/**
 * Error during EVM bytecode execution.
 * Raised when the WASM EVM encounters a fatal error while running bytecode.
 *
 * @example
 * ```ts
 * import { WasmExecutionError } from "#evm/errors"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(new WasmExecutionError({ message: "out of gas" }))
 *
 * program.pipe(
 *   Effect.catchTag("WasmExecutionError", (e) => Effect.log(e.message))
 * )
 * ```
 */
export class WasmExecutionError extends Data.TaggedError("WasmExecutionError")<{
	readonly message: string
	readonly cause?: unknown
}> {}
