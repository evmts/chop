import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import { type InternalError, MethodNotFoundError } from "./errors.js"
import {
	type Procedure,
	ethBlockNumber,
	ethCall,
	ethChainId,
	ethGetBalance,
	ethGetCode,
	ethGetStorageAt,
	ethGetTransactionCount,
} from "./eth.js"

// ---------------------------------------------------------------------------
// Method → Procedure mapping
// ---------------------------------------------------------------------------

/** Factory map: method name → (node) => Procedure. */
const methods: Record<string, (node: TevmNodeShape) => Procedure> = {
	eth_chainId: ethChainId,
	eth_blockNumber: ethBlockNumber,
	eth_call: ethCall,
	eth_getBalance: ethGetBalance,
	eth_getCode: ethGetCode,
	eth_getStorageAt: ethGetStorageAt,
	eth_getTransactionCount: ethGetTransactionCount,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route a JSON-RPC method name + params to the appropriate procedure.
 * Returns the procedure result (hex string) or fails with MethodNotFoundError.
 */
export const methodRouter =
	(node: TevmNodeShape) =>
	(method: string, params: readonly unknown[]): Effect.Effect<string, MethodNotFoundError | InternalError> => {
		const factory = methods[method]
		if (!factory) {
			return Effect.fail(new MethodNotFoundError({ method }))
		}
		return factory(node)(params)
	}
