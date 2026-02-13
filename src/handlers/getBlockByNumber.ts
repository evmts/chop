import { Effect } from "effect"
import type { Block } from "../blockchain/block-store.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for getBlockByNumberHandler. */
export interface GetBlockByNumberParams {
	/** Block tag: hex number or "latest"/"earliest"/"pending". */
	readonly blockTag: string
	/** Whether to include full transaction objects (vs just hashes). */
	readonly includeFullTxs: boolean
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_getBlockByNumber.
 *
 * Resolves block tag to a block, returns null if not found (Ethereum convention).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the block or null.
 */
export const getBlockByNumberHandler =
	(node: TevmNodeShape) =>
	(params: GetBlockByNumberParams): Effect.Effect<Block | null> =>
		Effect.gen(function* () {
			const { blockTag } = params

			switch (blockTag) {
				case "latest":
				case "pending":
				case "safe":
				case "finalized":
					return yield* node.blockchain.getHead().pipe(
						Effect.catchTag("GenesisError", () => Effect.succeed(null as Block | null)),
					)

				case "earliest":
					return yield* node.blockchain.getBlockByNumber(0n).pipe(
						Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null as Block | null)),
					)

				default: {
					const blockNumber = BigInt(blockTag)
					return yield* node.blockchain.getBlockByNumber(blockNumber).pipe(
						Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null as Block | null)),
					)
				}
			}
		})
