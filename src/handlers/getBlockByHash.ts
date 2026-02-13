import { Effect } from "effect"
import type { Block } from "../blockchain/block-store.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for getBlockByHashHandler. */
export interface GetBlockByHashParams {
	/** Block hash (0x-prefixed). */
	readonly hash: string
	/** Whether to include full transaction objects (vs just hashes). */
	readonly includeFullTxs: boolean
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_getBlockByHash.
 *
 * Looks up a block by hash, returns null if not found (Ethereum convention).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the block or null.
 */
export const getBlockByHashHandler =
	(node: TevmNodeShape) =>
	(params: GetBlockByHashParams): Effect.Effect<Block | null> =>
		node.blockchain.getBlock(params.hash).pipe(
			Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null as Block | null)),
		)
