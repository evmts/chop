// Anvil-specific JSON-RPC procedures (anvil_* methods).

import { Effect } from "effect"
import {
	autoImpersonateAccountHandler,
	impersonateAccountHandler,
	stopImpersonatingAccountHandler,
} from "../handlers/impersonate.js"
import { mineHandler } from "../handlers/mine.js"
import { setBalanceHandler } from "../handlers/setBalance.js"
import { setCodeHandler } from "../handlers/setCode.js"
import { setNonceHandler } from "../handlers/setNonce.js"
import { setStorageAtHandler } from "../handlers/setStorageAt.js"
import type { TevmNodeShape } from "../node/index.js"
import { wrapErrors } from "./errors.js"
import type { Procedure } from "./eth.js"

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/**
 * anvil_mine → mine N blocks (default 1).
 * Params: [blockCount?, timestampDelta?]
 * Returns: null on success.
 */
export const anvilMine =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockCount = params[0] !== undefined ? Number(params[0]) : 1
				yield* mineHandler(node)({ blockCount })
				return null
			}),
		)

/**
 * anvil_setBalance → set account ETH balance.
 * Params: [address: hex string, balance: hex string]
 * Returns: null on success.
 */
export const anvilSetBalance =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const balance = BigInt(params[1] as string)
				yield* setBalanceHandler(node)({ address, balance })
				return null
			}),
		)

/**
 * anvil_setCode → set account bytecode.
 * Params: [address: hex string, code: hex string]
 * Returns: null on success.
 */
export const anvilSetCode =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const code = params[1] as string
				yield* setCodeHandler(node)({ address, code })
				return null
			}),
		)

/**
 * anvil_setNonce → set account nonce.
 * Params: [address: hex string, nonce: hex string]
 * Returns: null on success.
 */
export const anvilSetNonce =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const nonce = BigInt(params[1] as string)
				yield* setNonceHandler(node)({ address, nonce })
				return null
			}),
		)

/**
 * anvil_setStorageAt → set individual storage slot.
 * Params: [address: hex string, slot: hex string, value: hex string]
 * Returns: true on success.
 */
export const anvilSetStorageAt =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const slot = params[1] as string
				const value = params[2] as string
				yield* setStorageAtHandler(node)({ address, slot, value })
				return true
			}),
		)

/**
 * anvil_impersonateAccount → start impersonating an address.
 * Params: [address: hex string]
 * Returns: null on success.
 */
export const anvilImpersonateAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				yield* impersonateAccountHandler(node)(address)
				return null
			}),
		)

/**
 * anvil_stopImpersonatingAccount → stop impersonating an address.
 * Params: [address: hex string]
 * Returns: null on success.
 */
export const anvilStopImpersonatingAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				yield* stopImpersonatingAccountHandler(node)(address)
				return null
			}),
		)

/**
 * anvil_autoImpersonateAccount → toggle auto-impersonation.
 * Params: [enabled: boolean]
 * Returns: null on success.
 */
export const anvilAutoImpersonateAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const enabled = Boolean(params[0])
				yield* autoImpersonateAccountHandler(node)(enabled)
				return null
			}),
		)
