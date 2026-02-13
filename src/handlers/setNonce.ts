import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for setNonceHandler. */
export interface SetNonceParams {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** New nonce value. */
	readonly nonce: bigint
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_setNonce.
 * Sets the nonce of the given address.
 * Creates the account if it doesn't exist.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns true on success.
 */
export const setNonceHandler =
	(node: TevmNodeShape) =>
	(params: SetNonceParams): Effect.Effect<true> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, {
				...account,
				nonce: params.nonce,
			})
			return true as const
		})
