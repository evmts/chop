import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for setCodeHandler. */
export interface SetCodeParams {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** 0x-prefixed hex bytecode to set. */
	readonly code: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_setCode.
 * Sets the bytecode at the given address.
 * Creates the account if it doesn't exist.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns true on success.
 */
export const setCodeHandler =
	(node: TevmNodeShape) =>
	(params: SetCodeParams): Effect.Effect<true> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const codeBytes = hexToBytes(params.code)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, {
				...account,
				code: codeBytes,
				// Update codeHash to indicate non-empty code
				codeHash: codeBytes.length > 0 ? new Uint8Array(32).fill(1) : new Uint8Array(32),
			})
			return true as const
		})
