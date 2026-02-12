/**
 * Pure intrinsic gas calculator for Ethereum transactions.
 *
 * Computes the minimum gas required before EVM execution begins.
 * Supports all EIPs up to Prague hardfork:
 *   - EIP-2028: Reduced calldata cost (16 gas per non-zero byte vs 68 pre-EIP)
 *   - EIP-2930: Access list costs
 *   - EIP-3860: Initcode size cost for CREATE
 *   - EIP-7623: Floor calldata cost
 *   - EIP-7702: Authorization tuple cost
 *
 * No Effect dependencies — all functions are pure and synchronous.
 */

import type { ReleaseSpecShape } from "./release-spec.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base cost for any transaction. */
const TX_BASE_COST = 21000n

/** Additional cost for contract creation (CREATE). */
const TX_CREATE_COST = 32000n

/** Gas per zero byte in calldata. */
const TX_DATA_ZERO_GAS = 4n

/** Gas per non-zero byte in calldata (EIP-2028). */
const TX_DATA_NON_ZERO_GAS_EIP2028 = 16n

/** Gas per non-zero byte in calldata (pre-EIP-2028, Frontier). */
const TX_DATA_NON_ZERO_GAS_FRONTIER = 68n

/** Gas per access list address entry (EIP-2930). */
const ACCESS_LIST_ADDRESS_GAS = 2400n

/** Gas per access list storage key (EIP-2930). */
const ACCESS_LIST_STORAGE_KEY_GAS = 1900n

/** Gas per 32-byte word of initcode (EIP-3860). */
const INITCODE_WORD_GAS = 2n

/** Size of a word for initcode cost calculation. */
const INITCODE_WORD_SIZE = 32n

/** Floor cost multiplier for calldata (EIP-7623). */
const FLOOR_COST_MULTIPLIER = 10n

/** Gas per authorization tuple (EIP-7702). */
const AUTHORIZATION_GAS = 12500n

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Access list entry for EIP-2930. */
export interface AccessListEntry {
	readonly address: string
	readonly storageKeys: readonly string[]
}

/** Parameters for intrinsic gas calculation. */
export interface IntrinsicGasParams {
	/** Transaction calldata (or initcode for CREATE). */
	readonly data: Uint8Array
	/** Whether this is a contract creation transaction. */
	readonly isCreate: boolean
	/** Optional EIP-2930 access list. */
	readonly accessList?: readonly AccessListEntry[]
	/** Number of EIP-7702 authorization tuples. */
	readonly authorizationCount?: number
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

/**
 * Calculate the intrinsic gas cost for a transaction.
 *
 * Pure function — no side effects, no Effect dependency.
 *
 * @param params - Transaction parameters for gas calculation.
 * @param spec - Release spec with hardfork feature flags.
 * @returns The intrinsic gas cost as a bigint.
 */
export const calculateIntrinsicGas = (params: IntrinsicGasParams, spec: ReleaseSpecShape): bigint => {
	let gas = TX_BASE_COST

	// Contract creation cost
	if (params.isCreate) {
		gas += TX_CREATE_COST
	}

	// Calldata cost — zero vs non-zero byte pricing
	const nonZeroGas = spec.isEip2028Enabled ? TX_DATA_NON_ZERO_GAS_EIP2028 : TX_DATA_NON_ZERO_GAS_FRONTIER

	let calldataGas = 0n
	for (let i = 0; i < params.data.length; i++) {
		calldataGas += params.data[i] === 0 ? TX_DATA_ZERO_GAS : nonZeroGas
	}
	gas += calldataGas

	// Access list cost (EIP-2930)
	if (spec.isEip2930Enabled && params.accessList) {
		for (const entry of params.accessList) {
			gas += ACCESS_LIST_ADDRESS_GAS
			gas += BigInt(entry.storageKeys.length) * ACCESS_LIST_STORAGE_KEY_GAS
		}
	}

	// Initcode word cost (EIP-3860) — only for CREATE transactions
	if (spec.isEip3860Enabled && params.isCreate && params.data.length > 0) {
		const wordCount = (BigInt(params.data.length) + INITCODE_WORD_SIZE - 1n) / INITCODE_WORD_SIZE
		gas += wordCount * INITCODE_WORD_GAS
	}

	// Authorization tuple cost (EIP-7702)
	if (spec.isEip7702Enabled && params.authorizationCount) {
		gas += BigInt(params.authorizationCount) * AUTHORIZATION_GAS
	}

	// EIP-7623: Floor calldata cost
	if (spec.isEip7623Enabled) {
		const floorGas = TX_BASE_COST + FLOOR_COST_MULTIPLIER * calldataGas
		if (floorGas > gas) {
			gas = floorGas
		}
	}

	return gas
}
