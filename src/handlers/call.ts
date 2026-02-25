import { Effect } from "effect"
import { bigintToBytes32, hexToBytes } from "../evm/conversions.js"
import type { ExecuteParams } from "../evm/wasm.js"
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

/**
 * Build ExecuteParams, only including optional fields when they have values.
 * Uses conditional spreading to maintain type safety with exactOptionalPropertyTypes.
 */
const buildExecuteParams = (base: { bytecode: Uint8Array }, extras: CallParams): ExecuteParams => ({
	bytecode: base.bytecode,
	...(extras.from ? { caller: hexToBytes(extras.from) } : {}),
	...(extras.value !== undefined ? { value: bigintToBytes32(extras.value) } : {}),
	...(extras.gas !== undefined ? { gas: extras.gas } : {}),
	...(extras.to ? { address: hexToBytes(extras.to) } : {}),
	...(extras.data && extras.to ? { calldata: hexToBytes(extras.data) } : {}),
})

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
			// Resolve bytecode: from deployed contract or raw data
			let bytecode: Uint8Array

			if (params.to) {
				// Contract call: look up code at `to`, use `data` as calldata
				const toBytes = hexToBytes(params.to)
				const account = yield* node.hostAdapter.getAccount(toBytes)

				if (account.code.length === 0) {
					// No code at address — return success with empty output (like a transfer)
					return { success: true, output: new Uint8Array(0), gasUsed: 0n } satisfies CallResult
				}

				bytecode = account.code
			} else {
				// No `to` — treat `data` as raw bytecode
				if (!params.data) {
					return yield* Effect.fail(new HandlerError({ message: "call requires either 'to' or 'data'" }))
				}

				bytecode = hexToBytes(params.data)
			}

			// Execute once with resolved bytecode
			const executeParams = buildExecuteParams({ bytecode }, params)
			const result = yield* node.evm
				.executeAsync(executeParams, node.hostAdapter.hostCallbacks)
				.pipe(
					Effect.catchTag("WasmExecutionError", (e) => Effect.fail(new HandlerError({ message: e.message, cause: e }))),
				)

			return {
				success: result.success,
				output: result.output,
				gasUsed: result.gasUsed,
			} satisfies CallResult
		})
