import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { ExecuteParams, ExecuteResult } from "../evm/wasm.js"
import type { TevmNodeShape } from "../node/index.js"
import { HandlerError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for callHandler. */
export interface CallParams {
	/** Target contract address (0x-prefixed hex). If omitted, `data` is treated as raw bytecode. */
	readonly to?: string
	/** Caller address (0x-prefixed hex). Defaults to zero address. */
	readonly from?: string
	/** Calldata or bytecode (0x-prefixed hex). */
	readonly data?: string
	/** Value to send in wei. */
	readonly value?: bigint
	/** Gas limit. Defaults to 10_000_000. */
	readonly gas?: bigint
}

/** Result of a call execution. */
export interface CallResult {
	/** Whether execution completed successfully. */
	readonly success: boolean
	/** Output data from RETURN. */
	readonly output: Uint8Array
	/** Gas consumed. */
	readonly gasUsed: bigint
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a bigint to 32-byte big-endian Uint8Array. */
const bigintToBytes32Simple = (n: bigint): Uint8Array => {
	const bytes = new Uint8Array(32)
	let val = n < 0n ? 0n : n
	for (let i = 31; i >= 0; i--) {
		bytes[i] = Number(val & 0xffn)
		val >>= 8n
	}
	return bytes
}

/**
 * Build ExecuteParams, only including optional fields when they have values.
 * This is needed because exactOptionalPropertyTypes disallows assigning undefined
 * to optional properties.
 */
const buildExecuteParams = (base: { bytecode: Uint8Array }, extras: CallParams): ExecuteParams => {
	const params: Record<string, unknown> = { bytecode: base.bytecode }
	if (extras.from) params["caller"] = hexToBytes(extras.from)
	if (extras.value !== undefined) params["value"] = bigintToBytes32Simple(extras.value)
	if (extras.gas !== undefined) params["gas"] = extras.gas
	if (extras.to) params["address"] = hexToBytes(extras.to)
	if (extras.data && extras.to) params["calldata"] = hexToBytes(extras.data)
	return params as unknown as ExecuteParams
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_call.
 * Executes EVM bytecode against the current state without modifying it.
 *
 * If `to` is provided, looks up the code at that address and uses `data` as calldata.
 * If `to` is omitted, uses `data` as raw bytecode directly.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes call params and returns the execution result.
 */
export const callHandler =
	(node: TevmNodeShape) =>
	(params: CallParams): Effect.Effect<CallResult, HandlerError> =>
		Effect.gen(function* () {
			let result: ExecuteResult

			if (params.to) {
				// Contract call: look up code at `to`, use `data` as calldata
				const toBytes = hexToBytes(params.to)
				const account = yield* node.hostAdapter.getAccount(toBytes)
				const bytecode = account.code

				if (bytecode.length === 0) {
					// No code at address — return success with empty output (like a transfer)
					return { success: true, output: new Uint8Array(0), gasUsed: 0n } satisfies CallResult
				}

				const executeParams = buildExecuteParams({ bytecode }, params)

				result = yield* node.evm
					.executeAsync(executeParams, node.hostAdapter.hostCallbacks)
					.pipe(
						Effect.catchTag("WasmExecutionError", (e) =>
							Effect.fail(new HandlerError({ message: e.message, cause: e })),
						),
					)
			} else {
				// No `to` — treat `data` as raw bytecode
				if (!params.data) {
					return yield* Effect.fail(new HandlerError({ message: "call requires either 'to' or 'data'" }))
				}

				const bytecode = hexToBytes(params.data)
				const executeParams = buildExecuteParams({ bytecode }, params)

				result = yield* node.evm
					.executeAsync(executeParams, node.hostAdapter.hostCallbacks)
					.pipe(
						Effect.catchTag("WasmExecutionError", (e) =>
							Effect.fail(new HandlerError({ message: e.message, cause: e })),
						),
					)
			}

			return {
				success: result.success,
				output: result.output,
				gasUsed: result.gasUsed,
			} satisfies CallResult
		})
