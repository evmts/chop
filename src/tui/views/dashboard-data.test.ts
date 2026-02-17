import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { getAccountSummaries, getChainInfo, getDashboardData, getRecentBlocks, getRecentTransactions } from "./dashboard-data.js"

describe("dashboard-data", () => {
	describe("getChainInfo", () => {
		it.effect("returns chain ID 31337 for default local node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const info = yield* getChainInfo(node)
				expect(info.chainId).toBe(31337n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns block number 0 for fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const info = yield* getChainInfo(node)
				expect(info.blockNumber).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns client version chop/0.1.0", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const info = yield* getChainInfo(node)
				expect(info.clientVersion).toBe("chop/0.1.0")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns baseFee from genesis block", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const info = yield* getChainInfo(node)
				expect(info.baseFee).toBe(1_000_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns mining mode", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const info = yield* getChainInfo(node)
				expect(info.miningMode).toBe("auto")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("reflects updated block number after mining", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(2)
				const info = yield* getChainInfo(node)
				expect(info.blockNumber).toBe(2n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("getRecentBlocks", () => {
		it.effect("returns genesis block for fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const blocks = yield* getRecentBlocks(node)
				expect(blocks.length).toBeGreaterThanOrEqual(1)
				expect(blocks[0]?.number).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns blocks in descending order (newest first)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(3)
				const blocks = yield* getRecentBlocks(node)
				expect(blocks[0]?.number).toBe(3n)
				expect(blocks[1]?.number).toBe(2n)
				expect(blocks[2]?.number).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("limits to 5 blocks by default", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(10)
				const blocks = yield* getRecentBlocks(node)
				expect(blocks.length).toBe(5)
				expect(blocks[0]?.number).toBe(10n)
				expect(blocks[4]?.number).toBe(6n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("respects custom count parameter", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(5)
				const blocks = yield* getRecentBlocks(node, 2)
				expect(blocks.length).toBe(2)
				expect(blocks[0]?.number).toBe(5n)
				expect(blocks[1]?.number).toBe(4n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns gasUsed and timestamp for each block", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(1)
				const blocks = yield* getRecentBlocks(node)
				const block = blocks[0]!
				expect(typeof block.gasUsed).toBe("bigint")
				expect(typeof block.timestamp).toBe("bigint")
				expect(typeof block.txCount).toBe("number")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("getRecentTransactions", () => {
		it.effect("returns empty array for fresh node with no transactions", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const txs = yield* getRecentTransactions(node)
				expect(txs).toEqual([])
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns transactions after mining a block with txs", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				// Add a transaction to the pool
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 1000n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const txs = yield* getRecentTransactions(node)
				expect(txs.length).toBe(1)
				expect(txs[0]?.from).toContain("0x")
				expect(txs[0]?.value).toBe(1000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("getAccountSummaries", () => {
		it.effect("returns 10 test accounts", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const accounts = yield* getAccountSummaries(node)
				expect(accounts.length).toBe(10)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("accounts have 10,000 ETH balance", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const accounts = yield* getAccountSummaries(node)
				const expectedBalance = 10_000n * 10n ** 18n
				expect(accounts[0]?.balance).toBe(expectedBalance)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("accounts have truncated addresses", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const accounts = yield* getAccountSummaries(node)
				// Address should start with 0x
				expect(accounts[0]?.address.startsWith("0x")).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("getDashboardData", () => {
		it.effect("returns all four data sections", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getDashboardData(node)
				expect(data.chainInfo.chainId).toBe(31337n)
				expect(data.recentBlocks.length).toBeGreaterThanOrEqual(1)
				expect(data.accounts.length).toBe(10)
				expect(Array.isArray(data.recentTxs)).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("updates after mining a block", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.mine(1)
				const data = yield* getDashboardData(node)
				expect(data.chainInfo.blockNumber).toBe(1n)
				expect(data.recentBlocks[0]?.number).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
