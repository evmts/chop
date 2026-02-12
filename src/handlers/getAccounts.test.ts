import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getAccountsHandler } from "./getAccounts.js"

describe("getAccountsHandler", () => {
	it.effect("returns addresses for default 10 accounts", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addresses = yield* getAccountsHandler(node)()
			expect(addresses).toHaveLength(10)
			for (const addr of addresses) {
				expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns correct number when accounts option is 5", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addresses = yield* getAccountsHandler(node)()
			expect(addresses).toHaveLength(5)
		}).pipe(Effect.provide(TevmNode.LocalTest({ accounts: 5 }))),
	)

	it.effect("returns empty array when accounts option is 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addresses = yield* getAccountsHandler(node)()
			expect(addresses).toHaveLength(0)
		}).pipe(Effect.provide(TevmNode.LocalTest({ accounts: 0 }))),
	)

	it.effect("first address matches well-known Hardhat account #0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addresses = yield* getAccountsHandler(node)()
			expect(addresses[0]!.toLowerCase()).toBe("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns lowercase addresses", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addresses = yield* getAccountsHandler(node)()
			for (const addr of addresses) {
				expect(addr).toBe(addr.toLowerCase())
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
