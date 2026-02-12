import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"

/**
 * Handler for eth_chainId.
 * Returns the chain ID configured on the node.
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the chain ID as bigint.
 */
export const chainIdHandler =
	(node: TevmNodeShape) =>
	(): Effect.Effect<bigint> =>
		Effect.succeed(node.chainId)
