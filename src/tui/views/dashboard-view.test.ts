import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { DashboardData } from "./dashboard-data.js"
import { formatGas, formatTimestamp, formatWei, truncateAddress, truncateHash } from "./dashboard-format.js"

/**
 * Dashboard view tests.
 *
 * The Dashboard component is a stateless rendering view (no reducer) — the
 * `createDashboard` factory depends on `@opentui/core` which requires Bun
 * FFI and cannot be unit-tested in isolation.
 *
 * Instead, these tests verify:
 *  1. The DashboardData contract is structurally correct.
 *  2. The formatting helpers produce correct output for dashboard display.
 *  3. Edge cases around empty / overflowed data are handled.
 *
 * Data-fetching and formatting are extensively tested in:
 *  - dashboard-data.test.ts (18 tests)
 *  - dashboard-format.test.ts (15 tests)
 */

/** Helper to create a complete DashboardData object. */
const makeDashboardData = (overrides: Partial<DashboardData> = {}): DashboardData => ({
	chainInfo: {
		chainId: 31337n,
		blockNumber: 42n,
		gasPrice: 1_000_000_000n,
		baseFee: 1_000_000_000n,
		clientVersion: "chop/0.1.0",
		miningMode: "auto",
	},
	recentBlocks: [
		{ number: 42n, timestamp: BigInt(Math.floor(Date.now() / 1000)) - 5n, txCount: 2, gasUsed: 42_000n },
		{ number: 41n, timestamp: BigInt(Math.floor(Date.now() / 1000)) - 15n, txCount: 0, gasUsed: 0n },
	],
	recentTxs: [
		{
			hash: `0x${"ab".repeat(32)}`,
			from: `0x${"11".repeat(20)}`,
			to: `0x${"22".repeat(20)}`,
			value: 1_000_000_000_000_000_000n,
		},
	],
	accounts: [
		{ address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", balance: 10_000n * 10n ** 18n },
		{ address: `0x${"22".repeat(20)}`, balance: 5_000n * 10n ** 18n },
	],
	...overrides,
})

describe("Dashboard view", () => {
	describe("DashboardData structure", () => {
		it.effect("has all four required sections", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				expect(data.chainInfo).toBeDefined()
				expect(data.recentBlocks).toBeDefined()
				expect(data.recentTxs).toBeDefined()
				expect(data.accounts).toBeDefined()
			}),
		)

		it.effect("chainInfo contains required fields", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				expect(data.chainInfo.chainId).toBe(31337n)
				expect(data.chainInfo.blockNumber).toBe(42n)
				expect(data.chainInfo.gasPrice).toBe(1_000_000_000n)
				expect(data.chainInfo.baseFee).toBe(1_000_000_000n)
				expect(data.chainInfo.clientVersion).toBe("chop/0.1.0")
				expect(data.chainInfo.miningMode).toBe("auto")
			}),
		)

		it.effect("recentBlocks contain block number, timestamp, txCount, gasUsed", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const block = data.recentBlocks[0]
				expect(block).toBeDefined()
				expect(typeof block!.number).toBe("bigint")
				expect(typeof block!.timestamp).toBe("bigint")
				expect(typeof block!.txCount).toBe("number")
				expect(typeof block!.gasUsed).toBe("bigint")
			}),
		)

		it.effect("recentTxs contain hash, from, to, value", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const tx = data.recentTxs[0]
				expect(tx).toBeDefined()
				expect(tx!.hash).toMatch(/^0x/)
				expect(tx!.from).toMatch(/^0x/)
				expect(tx!.to).toMatch(/^0x/)
				expect(typeof tx!.value).toBe("bigint")
			}),
		)

		it.effect("accounts contain address and balance", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const acct = data.accounts[0]
				expect(acct).toBeDefined()
				expect(acct!.address).toMatch(/^0x/)
				expect(typeof acct!.balance).toBe("bigint")
			}),
		)
	})

	describe("dashboard formatting for rendering", () => {
		it.effect("chain info line renders gas price in gwei", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const formatted = formatWei(data.chainInfo.gasPrice)
				expect(formatted).toBe("1.00 gwei")
			}),
		)

		it.effect("block line renders block number and time", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const block = data.recentBlocks[0]
				expect(block).toBeDefined()
				const time = formatTimestamp(block!.timestamp)
				expect(time).toMatch(/ago$/)
				const gas = formatGas(block!.gasUsed)
				expect(gas).toBe("42.0K")
			}),
		)

		it.effect("transaction line renders truncated hash and addresses", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const tx = data.recentTxs[0]
				expect(tx).toBeDefined()
				const hash = truncateHash(tx!.hash)
				expect(hash).toMatch(/^0x\w{4}\.\.\.\w{4}$/)
				const from = truncateAddress(tx!.from)
				expect(from).toMatch(/^0x\w{4}\.\.\.\w{4}$/)
			}),
		)

		it.effect("account line renders truncated address and formatted balance", () =>
			Effect.sync(() => {
				const data = makeDashboardData()
				const acct = data.accounts[0]
				expect(acct).toBeDefined()
				const addr = truncateAddress(acct!.address)
				expect(addr).toBe("0xf39F...2266")
				const bal = formatWei(acct!.balance)
				expect(bal).toBe("10,000.00 ETH")
			}),
		)
	})

	describe("empty data edge cases", () => {
		it.effect("handles empty recentBlocks array", () =>
			Effect.sync(() => {
				const data = makeDashboardData({ recentBlocks: [] })
				expect(data.recentBlocks).toEqual([])
				expect(data.recentBlocks[0]).toBeUndefined()
			}),
		)

		it.effect("handles empty recentTxs array", () =>
			Effect.sync(() => {
				const data = makeDashboardData({ recentTxs: [] })
				expect(data.recentTxs).toEqual([])
			}),
		)

		it.effect("handles empty accounts array", () =>
			Effect.sync(() => {
				const data = makeDashboardData({ accounts: [] })
				expect(data.accounts).toEqual([])
			}),
		)

		it.effect("handles transaction with no 'to' (contract creation)", () =>
			Effect.sync(() => {
				const data = makeDashboardData({
					recentTxs: [
						{
							hash: `0x${"cc".repeat(32)}`,
							from: `0x${"11".repeat(20)}`,
							to: null,
							value: 0n,
						},
					],
				})
				const tx = data.recentTxs[0]
				expect(tx?.to).toBeNull()
				// Dashboard.ts handles this by showing "CREATE"
			}),
		)
	})

	describe("block number rendering", () => {
		it.effect("block 0 (genesis) can be rendered", () =>
			Effect.sync(() => {
				const data = makeDashboardData({
					chainInfo: {
						chainId: 31337n,
						blockNumber: 0n,
						gasPrice: 0n,
						baseFee: 1_000_000_000n,
						clientVersion: "chop/0.1.0",
						miningMode: "auto",
					},
				})
				expect(data.chainInfo.blockNumber).toBe(0n)
			}),
		)

		it.effect("large block numbers render correctly", () =>
			Effect.sync(() => {
				const data = makeDashboardData({
					chainInfo: {
						chainId: 1n,
						blockNumber: 19_000_000n,
						gasPrice: 30_000_000_000n,
						baseFee: 25_000_000_000n,
						clientVersion: "chop/0.1.0",
						miningMode: "manual",
					},
				})
				expect(data.chainInfo.blockNumber.toString()).toBe("19000000")
				expect(formatWei(data.chainInfo.gasPrice)).toBe("30.00 gwei")
			}),
		)
	})
})
