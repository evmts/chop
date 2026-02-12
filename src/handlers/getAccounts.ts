import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"

/**
 * Handler for eth_accounts.
 * Returns the addresses of the node's pre-funded test accounts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the account addresses as lowercase hex strings.
 */
export const getAccountsHandler =
	(node: TevmNodeShape) =>
	(): Effect.Effect<readonly string[]> =>
		Effect.succeed(node.accounts.map((a) => a.address.toLowerCase()))
