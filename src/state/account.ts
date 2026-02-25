/**
 * Pure data type for EVM accounts.
 * No Effect services needed — just types, constants, and helpers.
 */

/** Representation of an EVM account. */
export interface Account {
	readonly nonce: bigint
	readonly balance: bigint
	/** keccak256 hash of the account's code (32 bytes). */
	readonly codeHash: Uint8Array
	/** The account's bytecode. Empty for EOAs. */
	readonly code: Uint8Array
}

/** keccak256 of empty bytes — used as codeHash for EOAs / empty accounts. */
export const EMPTY_CODE_HASH: Uint8Array = new Uint8Array(32)

/** Canonical empty account — returned for non-existent addresses (EVM convention). */
export const EMPTY_ACCOUNT: Account = {
	nonce: 0n,
	balance: 0n,
	codeHash: EMPTY_CODE_HASH,
	code: new Uint8Array(0),
}

/** Check whether an account is semantically empty (zero nonce, zero balance, no code). */
export const isEmptyAccount = (account: Account): boolean =>
	account.nonce === 0n && account.balance === 0n && account.code.length === 0

/** Structural equality check for two accounts. */
export const accountEquals = (a: Account, b: Account): boolean => {
	if (a.nonce !== b.nonce) return false
	if (a.balance !== b.balance) return false
	if (a.codeHash.length !== b.codeHash.length) return false
	if (a.code.length !== b.code.length) return false
	for (let i = 0; i < a.codeHash.length; i++) {
		if (a.codeHash[i] !== b.codeHash[i]) return false
	}
	for (let i = 0; i < a.code.length; i++) {
		if (a.code[i] !== b.code[i]) return false
	}
	return true
}
