/**
 * Pure Effect functions that query TevmNodeShape for state inspector tree data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the state inspector view should never fail.
 */

import { Effect } from "effect"
import { hexToBytes } from "../../evm/conversions.js"
import type { TevmNodeShape } from "../../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single storage slot entry. */
export interface StorageSlotEntry {
	/** 0x-prefixed hex slot key. */
	readonly slot: string
	/** 0x-prefixed hex value. */
	readonly value: string
}

/** A tree node representing one account. */
export interface AccountTreeNode {
	/** 0x-prefixed hex address. */
	readonly address: string
	/** Account balance in wei. */
	readonly balance: bigint
	/** Transaction count (nonce). */
	readonly nonce: bigint
	/** Bytecode length in bytes (0 for EOAs). */
	readonly codeSize: number
	/** Storage slot entries. */
	readonly storage: readonly StorageSlotEntry[]
}

/** Root data structure for the state inspector. */
export interface StateInspectorData {
	/** All accounts from the world state dump. */
	readonly accounts: readonly AccountTreeNode[]
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all accounts and their storage from the node's world state dump.
 *
 * Uses `node.hostAdapter.dumpState()` to get a WorldStateDump
 * (Record<string, SerializedAccount>), then maps each entry to an AccountTreeNode.
 */
export const getStateInspectorData = (node: TevmNodeShape): Effect.Effect<StateInspectorData> =>
	Effect.gen(function* () {
		const dump = yield* node.hostAdapter.dumpState()

		const accounts: AccountTreeNode[] = []
		for (const [address, serialized] of Object.entries(dump)) {
			const balance = BigInt(serialized.balance || "0x0")
			const nonce = BigInt(serialized.nonce || "0x0")
			const codeHex = serialized.code || ""
			// Code hex is like "0x6080..." — each 2 hex chars = 1 byte
			const cleanCode = codeHex.startsWith("0x") ? codeHex.slice(2) : codeHex
			const codeSize = cleanCode.length / 2

			const storage: StorageSlotEntry[] = []
			if (serialized.storage) {
				for (const [slot, value] of Object.entries(serialized.storage)) {
					storage.push({ slot, value })
				}
			}

			accounts.push({
				address: address.startsWith("0x") ? address : `0x${address}`,
				balance,
				nonce,
				codeSize,
				storage,
			})
		}

		return { accounts }
	}).pipe(Effect.catchAll(() => Effect.succeed({ accounts: [] as readonly AccountTreeNode[] })))

// ---------------------------------------------------------------------------
// State mutations
// ---------------------------------------------------------------------------

/**
 * Set a storage value on an account.
 *
 * @param node - The TevmNode facade.
 * @param address - 0x-prefixed hex address.
 * @param slot - 0x-prefixed hex slot key.
 * @param value - The bigint value to write.
 */
export const setStorageValue = (
	node: TevmNodeShape,
	address: string,
	slot: string,
	value: bigint,
): Effect.Effect<true> =>
	Effect.gen(function* () {
		const addrBytes = hexToBytes(address)
		const slotBytes = hexToBytes(slot)
		yield* node.hostAdapter.setStorage(addrBytes, slotBytes, value).pipe(Effect.catchAll(() => Effect.void))
		return true as const
	})
