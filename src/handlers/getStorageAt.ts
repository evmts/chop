import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

/** Parameters for getStorageAtHandler. */
export interface GetStorageAtParams {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** 0x-prefixed hex storage slot (32 bytes). */
	readonly slot: string
}

/**
 * Handler for eth_getStorageAt.
 * Returns the value at the given storage slot for the given address.
 * Returns 0n for unset slots and non-existent accounts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the storage value as bigint.
 */
export const getStorageAtHandler =
	(node: TevmNodeShape) =>
	(params: GetStorageAtParams): Effect.Effect<bigint> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const slotBytes = hexToBytes(params.slot)
			return yield* node.hostAdapter.getStorage(addrBytes, slotBytes)
		})
