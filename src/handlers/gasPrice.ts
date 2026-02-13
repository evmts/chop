import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_gasPrice.
 *
 * Returns the current base fee per gas from the latest block.
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the current gas price as bigint.
 */
export const gasPriceHandler =
	(node: TevmNodeShape) =>
	(): Effect.Effect<bigint> =>
		Effect.gen(function* () {
			const head = yield* node.blockchain.getHead().pipe(
				Effect.catchTag("GenesisError", () => Effect.succeed({ baseFeePerGas: 1_000_000_000n })),
			)
			return head.baseFeePerGas
		})
