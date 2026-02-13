import { Effect, Ref } from "effect"
import type { TevmNodeShape } from "../node/index.js"

/**
 * Handler for eth_chainId.
 * Returns the chain ID configured on the node (reads mutable nodeConfig).
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the chain ID as bigint.
 */
export const chainIdHandler = (node: TevmNodeShape) => (): Effect.Effect<bigint> => Ref.get(node.nodeConfig.chainId)
