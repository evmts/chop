import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { getAccountDetails, fundAccount, impersonateAccount } from "./accounts-data.js"

describe("accounts-data", () => {
	describe("getAccountDetails", () => {
		it.effect("returns 10 test accounts", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				expect(data.accounts.length).toBe(10)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("accounts have correct 10,000 ETH balance", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				const expectedBalance = 10_000n * 10n ** 18n
				expect(data.accounts[0]?.balance).toBe(expectedBalance)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("accounts have 0x-prefixed addresses", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				for (const account of data.accounts) {
					expect(account.address.startsWith("0x")).toBe(true)
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("accounts have zero nonce for fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				expect(data.accounts[0]?.nonce).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("test accounts are EOAs (no code)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				expect(data.accounts[0]?.isContract).toBe(false)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("account code is empty for EOAs", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				expect(data.accounts[0]?.code.length).toBe(0)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("fundAccount", () => {
		it.effect("increases account balance", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const before = yield* getAccountDetails(node)
				const addr = before.accounts[0]!.address
				const originalBalance = before.accounts[0]!.balance

				yield* fundAccount(node, addr, 5n * 10n ** 18n) // fund 5 ETH

				const after = yield* getAccountDetails(node)
				const newBalance = after.accounts[0]!.balance
				expect(newBalance).toBe(originalBalance + 5n * 10n ** 18n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns true on success", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				const addr = data.accounts[0]!.address
				const result = yield* fundAccount(node, addr, 1n * 10n ** 18n)
				expect(result).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("impersonateAccount", () => {
		it.effect("returns true on success", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getAccountDetails(node)
				const addr = data.accounts[0]!.address
				const result = yield* impersonateAccount(node, addr)
				expect(result).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
