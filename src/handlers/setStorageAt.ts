import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for setStorageAtHandler. */
export interface SetStorageAtParams {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** 0x-prefixed hex storage slot (32 bytes). */
	readonly slot: string
	/** 0x-prefixed hex value (32 bytes). */
	readonly value: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_setStorageAt.
 * Sets the storage value at the given slot for the given address.
 * Creates the account if it doesn't exist (ensures account exists
 * before setting storage, since setStorage requires the account to exist).
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns true on success.
 */
export const setStorageAtHandler =
	(node: TevmNodeShape) =>
	(params: SetStorageAtParams): Effect.Effect<true> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const slotBytes = hexToBytes(params.slot)

			// Ensure account exists — setStorage requires the account to exist
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			yield* node.hostAdapter.setAccount(addrBytes, account)

			// Parse hex value to bigint
			const valueBigint = BigInt(params.value)

			yield* node.hostAdapter.setStorage(addrBytes, slotBytes, valueBigint)
			return true as const
		})
