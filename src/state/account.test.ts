import { describe, it } from "@effect/vitest"
import { expect } from "vitest"
import { type Account, EMPTY_ACCOUNT, accountEquals, isEmptyAccount } from "./account.js"

// ---------------------------------------------------------------------------
// EMPTY_ACCOUNT
// ---------------------------------------------------------------------------

describe("EMPTY_ACCOUNT", () => {
	it("has zero nonce", () => {
		expect(EMPTY_ACCOUNT.nonce).toBe(0n)
	})

	it("has zero balance", () => {
		expect(EMPTY_ACCOUNT.balance).toBe(0n)
	})

	it("has empty code", () => {
		expect(EMPTY_ACCOUNT.code.length).toBe(0)
	})

	it("has 32-byte codeHash", () => {
		expect(EMPTY_ACCOUNT.codeHash.length).toBe(32)
	})
})

// ---------------------------------------------------------------------------
// isEmptyAccount
// ---------------------------------------------------------------------------

describe("isEmptyAccount", () => {
	it("returns true for EMPTY_ACCOUNT", () => {
		expect(isEmptyAccount(EMPTY_ACCOUNT)).toBe(true)
	})

	it("returns true for manually constructed empty account", () => {
		const account: Account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32),
			code: new Uint8Array(0),
		}
		expect(isEmptyAccount(account)).toBe(true)
	})

	it("returns false for account with balance", () => {
		const account: Account = {
			...EMPTY_ACCOUNT,
			balance: 1n,
		}
		expect(isEmptyAccount(account)).toBe(false)
	})

	it("returns false for account with nonce", () => {
		const account: Account = {
			...EMPTY_ACCOUNT,
			nonce: 1n,
		}
		expect(isEmptyAccount(account)).toBe(false)
	})

	it("returns false for account with code", () => {
		const account: Account = {
			...EMPTY_ACCOUNT,
			code: new Uint8Array([0x60, 0x00]),
		}
		expect(isEmptyAccount(account)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// accountEquals
// ---------------------------------------------------------------------------

describe("accountEquals", () => {
	it("returns true for two EMPTY_ACCOUNTs", () => {
		expect(accountEquals(EMPTY_ACCOUNT, EMPTY_ACCOUNT)).toBe(true)
	})

	it("returns true for structurally equal accounts", () => {
		const a: Account = {
			nonce: 5n,
			balance: 1000n,
			codeHash: new Uint8Array(32).fill(0xab),
			code: new Uint8Array([0x60, 0x00]),
		}
		const b: Account = {
			nonce: 5n,
			balance: 1000n,
			codeHash: new Uint8Array(32).fill(0xab),
			code: new Uint8Array([0x60, 0x00]),
		}
		expect(accountEquals(a, b)).toBe(true)
	})

	it("returns false when nonces differ", () => {
		const a: Account = { ...EMPTY_ACCOUNT, nonce: 1n }
		const b: Account = { ...EMPTY_ACCOUNT, nonce: 2n }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns false when balances differ", () => {
		const a: Account = { ...EMPTY_ACCOUNT, balance: 100n }
		const b: Account = { ...EMPTY_ACCOUNT, balance: 200n }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns false when codeHash differs", () => {
		const a: Account = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(32).fill(0x01) }
		const b: Account = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(32).fill(0x02) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns false when code differs", () => {
		const a: Account = { ...EMPTY_ACCOUNT, code: new Uint8Array([0x60]) }
		const b: Account = { ...EMPTY_ACCOUNT, code: new Uint8Array([0x61]) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns false when code lengths differ", () => {
		const a: Account = { ...EMPTY_ACCOUNT, code: new Uint8Array([0x60]) }
		const b: Account = { ...EMPTY_ACCOUNT, code: new Uint8Array([0x60, 0x00]) }
		expect(accountEquals(a, b)).toBe(false)
	})
})
