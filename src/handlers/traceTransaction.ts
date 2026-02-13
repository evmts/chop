import { Effect } from "effect"
import type { TraceResult } from "../evm/trace-types.js"
import type { TevmNodeShape } from "../node/index.js"
import { TransactionNotFoundError } from "./errors.js"
import { traceCallHandler } from "./traceCall.js"
import type { TraceCallParams } from "./traceCall.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for traceTransactionHandler. */
export interface TraceTransactionParams {
	/** Transaction hash (0x-prefixed, 32 bytes). */
	readonly hash: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for debug_traceTransaction.
 * Looks up a transaction by hash, reconstructs call params, and re-executes
 * with tracing to produce structLog entries.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the trace result.
 */
export const traceTransactionHandler =
	(node: TevmNodeShape) =>
	(params: TraceTransactionParams): Effect.Effect<TraceResult, TransactionNotFoundError> =>
		Effect.gen(function* () {
			// 1. Look up the transaction by hash
			const tx = yield* node.txPool.getTransaction(params.hash)

			// 2. Reconstruct TraceCallParams from the stored transaction
			const traceParams: TraceCallParams = {
				from: tx.from,
				...(tx.to !== undefined ? { to: tx.to } : {}),
				...(tx.data !== undefined && tx.data !== "0x" ? { data: tx.data } : {}),
				value: tx.value,
				gas: tx.gas,
			}

			// 3. Delegate to traceCallHandler for the actual execution + tracing
			const result = yield* traceCallHandler(node)(traceParams).pipe(
				Effect.catchTag("HandlerError", () =>
					Effect.succeed({
						gas: 0n,
						failed: true,
						returnValue: "0x",
						structLogs: [],
					} satisfies TraceResult),
				),
			)

			return result
		})
