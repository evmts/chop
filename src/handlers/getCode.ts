import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import type { TevmNodeShape } from "../node/index.js"

/** Parameters for getCodeHandler. */
export interface GetCodeParams {
	/** 0x-prefixed hex address. */
	readonly address: string
}

/**
 * Handler for eth_getCode.
 * Returns the bytecode deployed at the given address.
 * Returns empty Uint8Array for EOAs and non-existent accounts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns the bytecode.
 */
export const getCodeHandler =
	(node: TevmNodeShape) =>
	(params: GetCodeParams): Effect.Effect<Uint8Array> =>
		Effect.gen(function* () {
			const addrBytes = hexToBytes(params.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			return account.code
		})
