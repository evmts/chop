import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

/** Parameters for getTransactionCountHandler. */
export interface GetTransactionCountParams {
	/** 0x-prefixed hex address. */
	readonly address: string
}

/**
 * Handler for eth_getTransactionCount (nonce).
 * Returns the nonce of the account at the given address.
 * Returns 0n for non-existent accounts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the nonce as bigint.
 */
export const getTransactionCountHandler =
	(node: TevmNodeShape) =>
	(params: GetTransactionCountParams): Effect.Effect<bigint> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			return account.nonce
		})
