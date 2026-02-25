import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for setBalanceHandler. */
export interface SetBalanceParams {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** New balance in wei. */
	readonly balance: bigint
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_setBalance.
 * Sets the balance of the given address.
 * Creates the account if it doesn't exist.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns true on success.
 */
export const setBalanceHandler =
	(node: TevmNodeShape) =>
	(params: SetBalanceParams): Effect.Effect<true> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, {
				...account,
				balance: params.balance,
			})
			return true as const
		})
