import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import { type CallParams, callHandler } from "./call.js"
import { HandlerError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for estimateGasHandler. Same as CallParams. */
export type EstimateGasParams = CallParams

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_estimateGas.
 *
 * Executes the call and returns the gas used.
 * If no data/to is provided, returns the intrinsic gas cost (21000).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the estimated gas as bigint.
 */
export const estimateGasHandler =
	(node: TevmNodeShape) =>
	(params: EstimateGasParams): Effect.Effect<bigint, HandlerError> =>
		Effect.gen(function* () {
			// Simple transfer with no data
			if (!params.data && !params.to) {
				return 21000n
			}

			// If just sending to an address with no data, return intrinsic gas
			if (params.to && !params.data) {
				return 21000n
			}

			// Execute the call and use the gas consumed
			const result = yield* callHandler(node)(params)
			// Add buffer: at minimum the intrinsic gas cost
			const gasUsed = result.gasUsed > 0n ? result.gasUsed : 21000n
			return gasUsed
		})
