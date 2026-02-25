/**
 * Pure Effect functions that query TevmNodeShape for accounts view data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the accounts view should never fail.
 */

import { Effect } from "effect"
import { hexToBytes } from "../../evm/conversions.js"
import type { TevmNodeShape } from "../../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detail for a single account. */
export interface AccountDetail {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** Account balance in wei. */
	readonly balance: bigint
	/** Transaction count (nonce). */
	readonly nonce: bigint
	/** Deployed bytecode (empty for EOAs). */
	readonly code: Uint8Array
	/** Whether this is a contract (has code). */
	readonly isContract: boolean
}

/** Aggregated data for the accounts view. */
export interface AccountsViewData {
	/** All test accounts with their details. */
	readonly accounts: readonly AccountDetail[]
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/** Fetch details for all test accounts on the node. */
export const getAccountDetails = (node: TevmNodeShape): Effect.Effect<AccountsViewData> =>
	Effect.gen(function* () {
		const accounts: AccountDetail[] = []

		for (const testAccount of node.accounts) {
			const addrBytes = hexToBytes(testAccount.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			accounts.push({
				address: testAccount.address,
				balance: account.balance,
				nonce: account.nonce,
				code: account.code,
				isContract: account.code.length > 0,
			})
		}

		return { accounts }
	}).pipe(Effect.catchAll(() => Effect.succeed({ accounts: [] as readonly AccountDetail[] })))

// ---------------------------------------------------------------------------
// Account actions
// ---------------------------------------------------------------------------

/**
 * Fund an account by adding amountWei to its current balance.
 *
 * @param node - The TevmNode facade.
 * @param address - 0x-prefixed hex address to fund.
 * @param amountWei - Amount in wei to add to the current balance.
 */
export const fundAccount = (node: TevmNodeShape, address: string, amountWei: bigint): Effect.Effect<true> =>
	Effect.gen(function* () {
		const addrBytes = hexToBytes(address)
		const account = yield* node.hostAdapter.getAccount(addrBytes)
		yield* node.hostAdapter.setAccount(addrBytes, {
			...account,
			balance: account.balance + amountWei,
		})
		return true as const
	})

/**
 * Impersonate an account (mark it for transactions without private key).
 *
 * @param node - The TevmNode facade.
 * @param address - 0x-prefixed hex address to impersonate.
 */
export const impersonateAccount = (node: TevmNodeShape, address: string): Effect.Effect<true> =>
	Effect.gen(function* () {
		yield* node.impersonationManager.impersonate(address)
		return true as const
	})
