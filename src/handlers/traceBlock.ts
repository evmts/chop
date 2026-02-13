import { Effect } from "effect"
import type { Block } from "../blockchain/block-store.js"
import type { TraceResult } from "../evm/trace-types.js"
import type { TevmNodeShape } from "../node/index.js"
import { HandlerError } from "./errors.js"
import { traceTransactionHandler } from "./traceTransaction.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result entry for each traced transaction in a block. */
export interface BlockTraceResult {
	/** Transaction hash. */
	readonly txHash: string
	/** Trace result for this transaction. */
	readonly result: TraceResult
}

/** Parameters for traceBlockByNumberHandler. */
export interface TraceBlockByNumberParams {
	/** Block number. */
	readonly blockNumber: bigint
}

/** Parameters for traceBlockByHashHandler. */
export interface TraceBlockByHashParams {
	/** Block hash (0x-prefixed). */
	readonly blockHash: string
}

// ---------------------------------------------------------------------------
// Internal — shared trace-all-txs-in-block logic
// ---------------------------------------------------------------------------

/**
 * Trace all transactions in a block.
 * Iterates over transactionHashes and delegates to traceTransactionHandler.
 */
const traceBlockTransactions =
	(node: TevmNodeShape) =>
	(block: Block): Effect.Effect<readonly BlockTraceResult[], HandlerError> =>
		Effect.gen(function* () {
			const hashes = block.transactionHashes ?? []
			const results: BlockTraceResult[] = []

			for (const txHash of hashes) {
				const result = yield* traceTransactionHandler(node)({ hash: txHash }).pipe(
					Effect.catchTag("TransactionNotFoundError", (e) =>
						Effect.fail(new HandlerError({ message: `Transaction ${e.hash} not found in pool` })),
					),
				)
				results.push({ txHash, result })
			}

			return results
		})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handler for debug_traceBlockByNumber.
 * Resolves a block by number and traces all its transactions.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns an array of trace results.
 */
export const traceBlockByNumberHandler =
	(node: TevmNodeShape) =>
	(params: TraceBlockByNumberParams): Effect.Effect<readonly BlockTraceResult[], HandlerError> =>
		Effect.gen(function* () {
			const block = yield* node.blockchain
				.getBlockByNumber(params.blockNumber)
				.pipe(
					Effect.catchTag("BlockNotFoundError", () =>
						Effect.fail(new HandlerError({ message: `Block ${params.blockNumber} not found` })),
					),
				)

			return yield* traceBlockTransactions(node)(block)
		})

/**
 * Handler for debug_traceBlockByHash.
 * Resolves a block by hash and traces all its transactions.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns an array of trace results.
 */
export const traceBlockByHashHandler =
	(node: TevmNodeShape) =>
	(params: TraceBlockByHashParams): Effect.Effect<readonly BlockTraceResult[], HandlerError> =>
		Effect.gen(function* () {
			const block = yield* node.blockchain
				.getBlock(params.blockHash)
				.pipe(
					Effect.catchTag("BlockNotFoundError", () =>
						Effect.fail(new HandlerError({ message: `Block ${params.blockHash} not found` })),
					),
				)

			return yield* traceBlockTransactions(node)(block)
		})
