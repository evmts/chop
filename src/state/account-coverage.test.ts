import { describe, it } from "vitest"
import { expect } from "vitest"
import { EMPTY_ACCOUNT, EMPTY_CODE_HASH, accountEquals, isEmptyAccount } from "./account.js"

// ---------------------------------------------------------------------------
// EMPTY_CODE_HASH — previously untested
// ---------------------------------------------------------------------------

describe("EMPTY_CODE_HASH", () => {
	it("is a 32-byte Uint8Array", () => {
		expect(EMPTY_CODE_HASH).toBeInstanceOf(Uint8Array)
		expect(EMPTY_CODE_HASH.length).toBe(32)
	})

	it("is all zeros", () => {
		for (let i = 0; i < 32; i++) {
			expect(EMPTY_CODE_HASH[i]).toBe(0)
		}
	})

	it("is the same reference used in EMPTY_ACCOUNT", () => {
		expect(EMPTY_ACCOUNT.codeHash).toBe(EMPTY_CODE_HASH)
	})
})

// ---------------------------------------------------------------------------
// accountEquals — codeHash length mismatch (line 35 branch)
// ---------------------------------------------------------------------------

describe("accountEquals — codeHash length mismatch", () => {
	it("returns false when codeHash arrays have different lengths", () => {
		const a = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(32) }
		const b = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(0) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns false when codeHash is 64 bytes vs 32 bytes", () => {
		const a = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(64) }
		const b = { ...EMPTY_ACCOUNT, codeHash: new Uint8Array(32) }
		expect(accountEquals(a, b)).toBe(false)
	})

	it("returns true for identity check (same reference)", () => {
		const account = {
			nonce: 1n,
			balance: 100n,
			codeHash: new Uint8Array(32).fill(0xaa),
			code: new Uint8Array([0x60, 0x80]),
		}
		expect(accountEquals(account, account)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// isEmptyAccount — edge cases
// ---------------------------------------------------------------------------

describe("isEmptyAccount — additional edge cases", () => {
	it("returns true when codeHash is non-zero but code is empty", () => {
		// isEmptyAccount does NOT check codeHash
		const account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(32).fill(0xff),
			code: new Uint8Array(0),
		}
		expect(isEmptyAccount(account)).toBe(true)
	})

	it("returns true when codeHash length is 0", () => {
		const account = {
			nonce: 0n,
			balance: 0n,
			codeHash: new Uint8Array(0),
			code: new Uint8Array(0),
		}
		expect(isEmptyAccount(account)).toBe(true)
	})

	it("returns false for code of length 1", () => {
		const account = {
			nonce: 0n,
			balance: 0n,
			codeHash: EMPTY_CODE_HASH,
			code: new Uint8Array([0x00]),
		}
		expect(isEmptyAccount(account)).toBe(false)
	})
})
