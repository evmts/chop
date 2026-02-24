import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { getStateInspectorData, setStorageValue } from "./state-inspector-data.js"

describe("state-inspector-data", () => {
	describe("getStateInspectorData", () => {
		it.effect("returns accounts from dumpState", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				// Fresh node has 10 funded test accounts
				expect(data.accounts.length).toBeGreaterThanOrEqual(10)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("each account has a 0x-prefixed address", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				for (const account of data.accounts) {
					expect(account.address.startsWith("0x")).toBe(true)
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("test accounts have correct 10,000 ETH balance", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				const expectedBalance = 10_000n * 10n ** 18n
				// Find a test account (has 10,000 ETH)
				const funded = data.accounts.filter((a) => a.balance === expectedBalance)
				expect(funded.length).toBe(10)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("test accounts have 0 nonce on fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				const expectedBalance = 10_000n * 10n ** 18n
				const funded = data.accounts.find((a) => a.balance === expectedBalance)
				expect(funded?.nonce).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("test accounts have codeSize 0 (EOAs)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				const expectedBalance = 10_000n * 10n ** 18n
				const funded = data.accounts.find((a) => a.balance === expectedBalance)
				expect(funded?.codeSize).toBe(0)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("test accounts have empty storage arrays", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getStateInspectorData(node)
				const expectedBalance = 10_000n * 10n ** 18n
				const funded = data.accounts.find((a) => a.balance === expectedBalance)
				expect(funded?.storage).toEqual([])
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("setStorageValue", () => {
		it.effect("writes storage that can be read back via dumpState", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				// Use the first test account
				const addr = node.accounts[0]!.address

				// Write a storage value
				const slot = `0x${"00".repeat(32)}`
				yield* setStorageValue(node, addr, slot, 42n)

				// Read back via dumpState
				const data = yield* getStateInspectorData(node)
				const account = data.accounts.find((a) => a.address.toLowerCase() === addr.toLowerCase())
				expect(account).toBeDefined()
				expect(account!.storage.length).toBeGreaterThanOrEqual(1)
				// Find slot 0
				const slotEntry = account!.storage.find((s) => BigInt(s.slot) === 0n)
				expect(slotEntry).toBeDefined()
				expect(BigInt(slotEntry!.value)).toBe(42n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
