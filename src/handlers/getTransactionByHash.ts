import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import type { PoolTransaction } from "../node/tx-pool.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for getTransactionByHashHandler. */
export interface GetTransactionByHashParams {
	/** Transaction hash (0x-prefixed). */
	readonly hash: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_getTransactionByHash.
 *
 * Looks up a transaction by hash in the TxPool.
 * Returns null if not found (Ethereum convention).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the transaction or null.
 */
export const getTransactionByHashHandler =
	(node: TevmNodeShape) =>
	(params: GetTransactionByHashParams): Effect.Effect<PoolTransaction | null> =>
		node.txPool.getTransaction(params.hash).pipe(
			Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null as PoolTransaction | null)),
		)
