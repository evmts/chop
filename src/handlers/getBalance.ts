import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

/** Parameters for getBalanceHandler. */
export interface GetBalanceParams {
	/** 0x-prefixed hex address. */
	readonly address: string
}

/**
 * Handler for eth_getBalance.
 * Returns the balance of the account at the given address.
 * Returns 0n for non-existent accounts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the balance as bigint.
 */
export const getBalanceHandler =
	(node: TevmNodeShape) =>
	(params: GetBalanceParams): Effect.Effect<bigint> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			return account.balance
		})
