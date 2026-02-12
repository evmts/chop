import type { Effect } from "effect"
import type { GenesisError } from "../blockchain/errors.js"
import type { TevmNodeShape } from "../node/index.js"

/**
 * Handler for eth_blockNumber.
 * Returns the current head block number from the blockchain.
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the latest block number as bigint.
 */
export const blockNumberHandler =
	(node: TevmNodeShape) =>
	(): Effect.Effect<bigint, GenesisError> =>
		node.blockchain.getHeadBlockNumber()
