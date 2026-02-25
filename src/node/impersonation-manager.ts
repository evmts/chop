// Impersonation manager — tracks which addresses are impersonated
// for anvil_impersonateAccount / anvil_stopImpersonatingAccount / anvil_autoImpersonateAccount.
// Follows the same plain factory pattern as snapshot-manager.ts.

import { Effect } from "effect"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the ImpersonationManager API. */
export interface ImpersonationManagerApi {
	/** Mark an address as impersonated. */
	readonly impersonate: (address: string) => Effect.Effect<void>
	/** Remove an address from the impersonated set. */
	readonly stopImpersonating: (address: string) => Effect.Effect<void>
	/** Check if an address is impersonated (explicit or auto). */
	readonly isImpersonated: (address: string) => boolean
	/** Toggle auto-impersonation (all addresses are treated as impersonated). */
	readonly setAutoImpersonate: (enabled: boolean) => Effect.Effect<void>
	/** Check if auto-impersonation is enabled. */
	readonly isAutoImpersonated: () => boolean
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an ImpersonationManager.
 *
 * Tracks a mutable set of impersonated addresses (case-insensitive) and
 * an auto-impersonate flag. When auto-impersonate is on, all addresses
 * are considered impersonated.
 */
export const makeImpersonationManager = (): ImpersonationManagerApi => {
	const impersonated = new Set<string>()
	let autoImpersonate = false

	return {
		impersonate: (address) =>
			Effect.sync(() => {
				impersonated.add(address.toLowerCase())
			}),

		stopImpersonating: (address) =>
			Effect.sync(() => {
				impersonated.delete(address.toLowerCase())
			}),

		isImpersonated: (address) => {
			if (autoImpersonate) return true
			return impersonated.has(address.toLowerCase())
		},

		setAutoImpersonate: (enabled) =>
			Effect.sync(() => {
				autoImpersonate = enabled
			}),

		isAutoImpersonated: () => autoImpersonate,
	} satisfies ImpersonationManagerApi
}
