import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import type { TransactionReceipt } from "../node/tx-pool.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for getTransactionReceiptHandler. */
export interface GetTransactionReceiptParams {
	/** Transaction hash (0x-prefixed hex). */
	readonly hash: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_getTransactionReceipt.
 *
 * Looks up the receipt in the TxPool by hash.
 * Returns null if the transaction is not found (Ethereum convention).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the receipt or null.
 */
export const getTransactionReceiptHandler =
	(node: TevmNodeShape) =>
	(params: GetTransactionReceiptParams): Effect.Effect<TransactionReceipt | null> =>
		node.txPool.getReceipt(params.hash).pipe(
			Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)),
		)
