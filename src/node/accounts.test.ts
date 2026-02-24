import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { HostAdapterService, HostAdapterTest } from "../evm/host-adapter.js"
import { DEFAULT_BALANCE, fundAccounts, getTestAccounts } from "./accounts.js"

// ---------------------------------------------------------------------------
// getTestAccounts — pure function
// ---------------------------------------------------------------------------

describe("getTestAccounts", () => {
	it("returns 10 accounts by default", () => {
		const accounts = getTestAccounts()
		expect(accounts).toHaveLength(10)
	})

	it("returns requested number of accounts", () => {
		expect(getTestAccounts(5)).toHaveLength(5)
		expect(getTestAccounts(1)).toHaveLength(1)
		expect(getTestAccounts(3)).toHaveLength(3)
	})

	it("returns 0 accounts when requested", () => {
		expect(getTestAccounts(0)).toHaveLength(0)
	})

	it("clamps to max 10 accounts", () => {
		expect(getTestAccounts(20)).toHaveLength(10)
	})

	it("each account has address and privateKey", () => {
		const accounts = getTestAccounts(3)
		for (const acct of accounts) {
			expect(acct.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
			expect(acct.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
		}
	})

	it("accounts are deterministic (same every call)", () => {
		const a = getTestAccounts(5)
		const b = getTestAccounts(5)
		for (let i = 0; i < 5; i++) {
			expect(a[i]?.address).toBe(b[i]?.address)
			expect(a[i]?.privateKey).toBe(b[i]?.privateKey)
		}
	})

	it("first account matches well-known Hardhat account #0", () => {
		const [first] = getTestAccounts(1)
		// Hardhat/Anvil default account #0
		expect(first?.address.toLowerCase()).toBe("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
		expect(first?.privateKey).toBe("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
	})
})

// ---------------------------------------------------------------------------
// DEFAULT_BALANCE
// ---------------------------------------------------------------------------

describe("DEFAULT_BALANCE", () => {
	it("is 10000 ETH in wei", () => {
		expect(DEFAULT_BALANCE).toBe(10_000n * 10n ** 18n)
	})
})

// ---------------------------------------------------------------------------
// fundAccounts — Effect function
// ---------------------------------------------------------------------------

describe("fundAccounts", () => {
	it.effect("funds accounts with DEFAULT_BALANCE", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const accounts = getTestAccounts(3)
			yield* fundAccounts(hostAdapter, accounts)

			for (const acct of accounts) {
				const { address } = acct
				// HostAdapter uses Uint8Array addresses — read back via getAccount
				const addrBytes = hexToBytes(address)
				const account = yield* hostAdapter.getAccount(addrBytes)
				expect(account.balance).toBe(DEFAULT_BALANCE)
				expect(account.nonce).toBe(0n)
			}
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("does not fund when given empty array", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			yield* fundAccounts(hostAdapter, [])
			// No error means success
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})
