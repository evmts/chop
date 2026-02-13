import { describe, it } from "vitest"
import { expect } from "vitest"
import type { Account } from "../../state/account.js"
import { makeForkCache } from "./fork-cache.js"

const addr1 = "0x0000000000000000000000000000000000000001"
const addr2 = "0x0000000000000000000000000000000000000002"
const slot1 = "0x0000000000000000000000000000000000000000000000000000000000000001"
const slot2 = "0x0000000000000000000000000000000000000000000000000000000000000002"

const makeAccount = (balance: bigint): Account => ({
	nonce: 0n,
	balance,
	codeHash: new Uint8Array(32),
	code: new Uint8Array(0),
})

describe("ForkCache — accounts", () => {
	it("hasAccount returns false for uncached address", () => {
		const cache = makeForkCache()
		expect(cache.hasAccount(addr1)).toBe(false)
	})

	it("hasAccount returns true after setAccount", () => {
		const cache = makeForkCache()
		cache.setAccount(addr1, makeAccount(100n))
		expect(cache.hasAccount(addr1)).toBe(true)
	})

	it("getAccount returns undefined for uncached address", () => {
		const cache = makeForkCache()
		expect(cache.getAccount(addr1)).toBeUndefined()
	})

	it("getAccount returns cached account", () => {
		const cache = makeForkCache()
		const acct = makeAccount(42n)
		cache.setAccount(addr1, acct)
		expect(cache.getAccount(addr1)?.balance).toBe(42n)
	})

	it("accounts are isolated by address", () => {
		const cache = makeForkCache()
		cache.setAccount(addr1, makeAccount(100n))
		cache.setAccount(addr2, makeAccount(200n))
		expect(cache.getAccount(addr1)?.balance).toBe(100n)
		expect(cache.getAccount(addr2)?.balance).toBe(200n)
	})

	it("accountCount tracks cached accounts", () => {
		const cache = makeForkCache()
		expect(cache.accountCount()).toBe(0)
		cache.setAccount(addr1, makeAccount(1n))
		expect(cache.accountCount()).toBe(1)
		cache.setAccount(addr2, makeAccount(2n))
		expect(cache.accountCount()).toBe(2)
	})
})

describe("ForkCache — storage", () => {
	it("hasStorage returns false for uncached slot", () => {
		const cache = makeForkCache()
		expect(cache.hasStorage(addr1, slot1)).toBe(false)
	})

	it("hasStorage returns true after setStorage", () => {
		const cache = makeForkCache()
		cache.setStorage(addr1, slot1, 42n)
		expect(cache.hasStorage(addr1, slot1)).toBe(true)
	})

	it("getStorage returns undefined for uncached slot", () => {
		const cache = makeForkCache()
		expect(cache.getStorage(addr1, slot1)).toBeUndefined()
	})

	it("getStorage returns cached value", () => {
		const cache = makeForkCache()
		cache.setStorage(addr1, slot1, 999n)
		expect(cache.getStorage(addr1, slot1)).toBe(999n)
	})

	it("storage is isolated by address and slot", () => {
		const cache = makeForkCache()
		cache.setStorage(addr1, slot1, 100n)
		cache.setStorage(addr1, slot2, 200n)
		cache.setStorage(addr2, slot1, 300n)
		expect(cache.getStorage(addr1, slot1)).toBe(100n)
		expect(cache.getStorage(addr1, slot2)).toBe(200n)
		expect(cache.getStorage(addr2, slot1)).toBe(300n)
	})

	it("storageCount tracks all cached slots", () => {
		const cache = makeForkCache()
		expect(cache.storageCount()).toBe(0)
		cache.setStorage(addr1, slot1, 1n)
		expect(cache.storageCount()).toBe(1)
		cache.setStorage(addr1, slot2, 2n)
		expect(cache.storageCount()).toBe(2)
		cache.setStorage(addr2, slot1, 3n)
		expect(cache.storageCount()).toBe(3)
	})
})
