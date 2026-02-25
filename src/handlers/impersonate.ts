import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_impersonateAccount.
 * Marks an address as impersonated, allowing transactions
 * to be sent from it without a private key.
 */
export const impersonateAccountHandler =
	(node: TevmNodeShape) =>
	(address: string): Effect.Effect<true> =>
		Effect.gen(function* () {
			yield* node.impersonationManager.impersonate(address)
			return true as const
		})

/**
 * Handler for anvil_stopImpersonatingAccount.
 * Removes an address from the impersonated set.
 */
export const stopImpersonatingAccountHandler =
	(node: TevmNodeShape) =>
	(address: string): Effect.Effect<true> =>
		Effect.gen(function* () {
			yield* node.impersonationManager.stopImpersonating(address)
			return true as const
		})

/**
 * Handler for anvil_autoImpersonateAccount.
 * Toggles auto-impersonation — when enabled, all addresses
 * are treated as impersonated.
 */
export const autoImpersonateAccountHandler =
	(node: TevmNodeShape) =>
	(enabled: boolean): Effect.Effect<true> =>
		Effect.gen(function* () {
			yield* node.impersonationManager.setAutoImpersonate(enabled)
			return true as const
		})
