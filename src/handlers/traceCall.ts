import { Effect } from "effect"
import { bigintToBytes32, bytesToHex, hexToBytes } from "../evm/conversions.js"
import type { TraceResult, TracerConfig } from "../evm/trace-types.js"
import type { ExecuteParams } from "../evm/wasm.js"
import type { TevmNodeShape } from "../node/index.js"
import { HandlerError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for traceCallHandler. */
export interface TraceCallParams {
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
	/** Optional tracer configuration. */
	readonly tracerConfig?: TracerConfig
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build ExecuteParams, only including optional fields when they have values.
 * Uses conditional spreading to maintain type safety with exactOptionalPropertyTypes.
 */
const buildExecuteParams = (base: { bytecode: Uint8Array }, extras: TraceCallParams): ExecuteParams => ({
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
 * Handler for debug_traceCall.
 * Executes EVM bytecode with tracing, collecting structLog entries for each opcode.
 *
 * If `to` is provided, looks up the code at that address and uses `data` as calldata.
 * If `to` is omitted, uses `data` as raw bytecode directly.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes trace call params and returns the trace result.
 */
export const traceCallHandler =
	(node: TevmNodeShape) =>
	(params: TraceCallParams): Effect.Effect<TraceResult, HandlerError> =>
		Effect.gen(function* () {
			// Resolve bytecode: from deployed contract or raw data
			let bytecode: Uint8Array

			if (params.to) {
				// Contract call: look up code at `to`, use `data` as calldata
				const toBytes = hexToBytes(params.to)
				const account = yield* node.hostAdapter.getAccount(toBytes)

				if (account.code.length === 0) {
					// No code at address — return empty trace (like a transfer)
					return {
						gas: 0n,
						failed: false,
						returnValue: "0x",
						structLogs: [],
					} satisfies TraceResult
				}

				bytecode = account.code
			} else {
				// No `to` — treat `data` as raw bytecode
				if (!params.data) {
					return yield* Effect.fail(new HandlerError({ message: "traceCall requires either 'to' or 'data'" }))
				}

				bytecode = hexToBytes(params.data)
			}

			// Execute with tracing
			const executeParams = buildExecuteParams({ bytecode }, params)
			const result = yield* node.evm
				.executeWithTrace(executeParams, node.hostAdapter.hostCallbacks)
				.pipe(
					Effect.catchTag("WasmExecutionError", (e) => Effect.fail(new HandlerError({ message: e.message, cause: e }))),
				)

			return {
				gas: result.gasUsed,
				failed: !result.success,
				returnValue: bytesToHex(result.output),
				structLogs: result.structLogs,
			} satisfies TraceResult
		})
