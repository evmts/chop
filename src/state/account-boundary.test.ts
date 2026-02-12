/**
 * Boundary condition tests for state/account.ts.
 *
 * Covers:
 * - EMPTY_ACCOUNT shape and properties
 * - isEmptyAccount with various edge cases
 * - accountEquals with boundary values
 * - Account with max uint256 balance/nonce
 * - Account with very large code arrays
 */

import { describe, expect, it } from "vitest"
import { EMPTY_ACCOUNT, type Account, accountEquals, isEmptyAccount } from "./account.js"

// ---------------------------------------------------------------------------
// EMPTY_ACCOUNT — shape validation
// ---------------------------------------------------------------------------

describe("EMPTY_ACCOUNT — shape validation", () => {
	it("has zero nonce", () => {
		expect(EMPTY_ACCOUNT.nonce).toBe(0n)
	})

	it("has zero balance", () => {
		expect(EMPTY_ACCOUNT.balance).toBe(0n)
	})

	it("has 32-byte zero codeHash", () => {
		expect(EMPTY_ACCOUNT.codeHash).toBeInstanceOf(Uint8Array)
		expect(EMPTY_ACCOUNT.codeHash.length).toBe(32)
		expect(EMPTY_ACCOUNT.codeHash.every((b) => b === 0)).toBe(true)
	})

	it("has empty code", () => {
		expect(EMPTY_ACCOUNT.code).toBeInstanceOf(Uint8Array)
		expect(EMPTY_ACCOUNT.code.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// isEmptyAccount — boundary conditions
// ---------------------------------------------------------------------------

describe("isEmptyAccount — boundary conditions", () => {
	it("EMPTY_ACCOUNT is empty", () => {
		expect(isEmptyAccount(EMPTY_ACCOUNT)).toBe(true)
	})

	it("account with nonce = 1n is not empty", () => {
		expect(isEmptyAccount({ ...EMPTY_ACCOUNT, nonce: 1n })).toBe(false)
	})

	it("account with balance = 1n is not empty", () => {
		expect(isEmptyAccount({ ...EMPTY_ACCOUNT, balance: 1n })).toBe(false)
	})

	it("account with non-empty code is not empty", () => {
		expect(isEmptyAccount({ ...EMPTY_ACCOUNT, code: new Uint8Array([0x60]) })).toBe(false)
	})

	it("account with max uint256 balance is not empty", () => {
		const maxBalance = 2n ** 256n - 1n
		expect(isEmptyAccount({ ...EMPTY_ACCOUNT, balance: maxBalance })).toBe(false)
	})

	it("account with max uint256 nonce is not empty", () => {
		const maxNonce = 2n ** 256n - 1n
		expect(isEmptyAccount({ ...EMPTY_ACCOUNT, nonce: maxNonce })).toBe(false)
	})

	it("account with code but zero nonce and balance is not empty", () => {
		const acct: Account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32),
			code: new Uint8Array([0x00]), // STOP opcode
		}
		expect(isEmptyAccount(acct)).toBe(false)
	})

	it("account with all-zero codeHash and empty code is empty", () => {
		const acct: Account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32),
			code: new Uint8Array(0),
		}
		expect(isEmptyAccount(acct)).toBe(true)
	})

	it("account with non-zero codeHash but empty code is empty (by nonce/balance/code check)", () => {
		const acct: Account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32).fill(0xff),
			code: new Uint8Array(0),
		}
		// isEmptyAccount only checks nonce, balance, code.length
		expect(isEmptyAccount(acct)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// accountEquals — boundary conditions
// ---------------------------------------------------------------------------

describe("accountEquals — boundary conditions", () => {
	it("two EMPTY_ACCOUNTs are equal", () => {
		expect(accountEquals(EMPTY_ACCOUNT, EMPTY_ACCOUNT)).toBe(true)
	})

	it("same-shaped accounts are equal", () => {
		const a: Account = { nonce: 1n, balance: 100n, codeHash: new Uint8Array(32), code: new Uint8Array([0x60]) }
		const b: Account = { nonce: 1n, balance: 100n, codeHash: new Uint8Array(32), code: new Uint8Array([0x60]) }
		expect(accountEquals(a, b)).toBe(true)
	})

	it("accounts with different nonce are not equal", () => {
		const a: Account = { nonce: 1n, balance: 0n, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		const b: Account = { nonce: 2n, balance: 0n, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("accounts with different balance are not equal", () => {
		const a: Account = { nonce: 0n, balance: 100n, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		const b: Account = { nonce: 0n, balance: 200n, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("accounts with different code are not equal", () => {
		const a: Account = { nonce: 0n, balance: 0n, codeHash: new Uint8Array(32), code: new Uint8Array([0x60]) }
		const b: Account = { nonce: 0n, balance: 0n, codeHash: new Uint8Array(32), code: new Uint8Array([0x61]) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("accounts with different code lengths are not equal", () => {
		const a: Account = { nonce: 0n, balance: 0n, codeHash: new Uint8Array(32), code: new Uint8Array([0x60]) }
		const b: Account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32),
			code: new Uint8Array([0x60, 0x61]),
		}
		expect(accountEquals(a, b)).toBe(false)
	})

	it("accounts with different codeHash are not equal", () => {
		const hash1 = new Uint8Array(32)
		const hash2 = new Uint8Array(32)
		hash2[0] = 0xff
		const a: Account = { nonce: 0n, balance: 0n, codeHash: hash1, code: new Uint8Array(0) }
		const b: Account = { nonce: 0n, balance: 0n, codeHash: hash2, code: new Uint8Array(0) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("accounts with max uint256 balance are equal", () => {
		const max = 2n ** 256n - 1n
		const a: Account = { nonce: 0n, balance: max, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		const b: Account = { nonce: 0n, balance: max, codeHash: new Uint8Array(32), code: new Uint8Array(0) }
		expect(accountEquals(a, b)).toBe(true)
	})

	it("accounts with large code arrays are equal when matching", () => {
		const code = new Uint8Array(1024).fill(0x60)
		const a: Account = { nonce: 0n, balance: 0n, codeHash: new Uint8Array(32), code: code.slice() }
		const b: Account = { nonce: 0n, balance: 0n, codeHash: new Uint8Array(32), code: code.slice() }
		expect(accountEquals(a, b)).toBe(true)
	})
})
