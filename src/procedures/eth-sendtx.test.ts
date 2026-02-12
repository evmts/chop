import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import type { TransactionReceipt } from "../node/tx-pool.js"
import { ethAccounts, ethGetTransactionReceipt, ethSendTransaction } from "./eth.js"

// ============================================================================
// ethSendTransaction — maxPriorityFeePerGas branch (line 140)
// ============================================================================

describe("ethSendTransaction — EIP-1559 fields", () => {
	it.effect("includes maxPriorityFeePerGas when provided", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const result = yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
					maxFeePerGas: "0x3B9ACA00", // 1 gwei (matches baseFee)
					maxPriorityFeePerGas: "0x0", // 0 priority fee
				},
			])

			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("works with gasPrice (legacy tx)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const result = yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
					gasPrice: "0x3B9ACA00", // 1 gwei
				},
			])

			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("includes explicit nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const result = yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
					nonce: "0x0",
				},
			])

			expect(typeof result).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("sends with data field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const result = yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
					data: "0xdeadbeef",
				},
			])

			expect(typeof result).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("sends with gas field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const result = yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0xDE0B6B3A7640000", // 1 ETH
					gas: "0x5208", // 21000
				},
			])

			expect(typeof result).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ============================================================================
// ethGetTransactionReceipt — log serialization (lines 170-178)
// ============================================================================

describe("ethGetTransactionReceipt — receipt fields", () => {
	it.effect("receipt has all required fields with correct types", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			// Send a transaction first
			const txHash = (yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0xDE0B6B3A7640000",
				},
			])) as string

			// Get the receipt
			const receipt = (yield* ethGetTransactionReceipt(node)([txHash])) as Record<string, unknown>
			expect(receipt).not.toBeNull()

			// Check all serialized fields are hex strings
			expect(typeof receipt.transactionHash).toBe("string")
			expect(typeof receipt.transactionIndex).toBe("string")
			expect((receipt.transactionIndex as string).startsWith("0x")).toBe(true)
			expect(typeof receipt.blockHash).toBe("string")
			expect(typeof receipt.blockNumber).toBe("string")
			expect((receipt.blockNumber as string).startsWith("0x")).toBe(true)
			expect(typeof receipt.from).toBe("string")
			expect(typeof receipt.to).toBe("string")
			expect(typeof receipt.cumulativeGasUsed).toBe("string")
			expect((receipt.cumulativeGasUsed as string).startsWith("0x")).toBe(true)
			expect(typeof receipt.gasUsed).toBe("string")
			expect((receipt.gasUsed as string).startsWith("0x")).toBe(true)
			expect(typeof receipt.status).toBe("string")
			expect(receipt.status).toBe("0x1") // success
			expect(typeof receipt.effectiveGasPrice).toBe("string")
			expect((receipt.effectiveGasPrice as string).startsWith("0x")).toBe(true)
			expect(typeof receipt.type).toBe("string")
			expect(receipt.type).toBe("0x0") // legacy
			expect(Array.isArray(receipt.logs)).toBe(true)
			expect(receipt.contractAddress).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("receipt for EIP-1559 tx has type 0x2", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			const txHash = (yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
					maxFeePerGas: "0x3B9ACA00",
					maxPriorityFeePerGas: "0x0",
				},
			])) as string

			const receipt = (yield* ethGetTransactionReceipt(node)([txHash])) as Record<string, unknown>
			expect(receipt).not.toBeNull()
			expect(receipt.type).toBe("0x2") // EIP-1559
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("receipt for unknown tx returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetTransactionReceipt(node)([`0x${"dead".repeat(16)}`])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("receipt with logs serializes log fields correctly (lines 170-178)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			// Send a real transaction to get it mined and stored
			const txHash = (yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
				},
			])) as string

			// Now inject a receipt with logs directly to cover the log serialization path
			const receiptWithLogs: TransactionReceipt = {
				transactionHash: txHash,
				transactionIndex: 0,
				blockHash: `0x${"aa".repeat(32)}`,
				blockNumber: 1n,
				from: sender,
				to: `0x${"22".repeat(20)}`,
				cumulativeGasUsed: 21000n,
				gasUsed: 21000n,
				contractAddress: null,
				logs: [
					{
						address: `0x${"33".repeat(20)}`,
						topics: [
							`0x${"44".repeat(32)}`,
							`0x${"55".repeat(32)}`,
						],
						data: "0xdeadbeef",
						blockNumber: 1n,
						transactionHash: txHash,
						transactionIndex: 0,
						blockHash: `0x${"aa".repeat(32)}`,
						logIndex: 0,
						removed: false,
					},
					{
						address: `0x${"66".repeat(20)}`,
						topics: [],
						data: "0x",
						blockNumber: 1n,
						transactionHash: txHash,
						transactionIndex: 0,
						blockHash: `0x${"aa".repeat(32)}`,
						logIndex: 1,
						removed: false,
					},
				],
				status: 1,
				effectiveGasPrice: 1_000_000_000n,
				type: 2,
			}

			// Directly add receipt to tx pool to override the auto-mined one
			yield* node.txPool.addReceipt(receiptWithLogs)

			// Now get receipt via the procedure (exercises lines 170-178)
			const receipt = (yield* ethGetTransactionReceipt(node)([txHash])) as Record<string, unknown>
			expect(receipt).not.toBeNull()

			const logs = receipt.logs as Array<Record<string, unknown>>
			expect(logs).toHaveLength(2)

			// First log — verify all serialized fields
			expect(logs[0]!.address).toBe(`0x${"33".repeat(20)}`)
			expect(logs[0]!.topics).toEqual([
				`0x${"44".repeat(32)}`,
				`0x${"55".repeat(32)}`,
			])
			expect(logs[0]!.data).toBe("0xdeadbeef")
			expect(logs[0]!.blockNumber).toBe("0x1")
			expect(logs[0]!.transactionHash).toBe(txHash)
			expect(logs[0]!.transactionIndex).toBe("0x0")
			expect(logs[0]!.blockHash).toBe(`0x${"aa".repeat(32)}`)
			expect(logs[0]!.logIndex).toBe("0x0")
			expect(logs[0]!.removed).toBe(false)

			// Second log — verify logIndex is "0x1"
			expect(logs[1]!.address).toBe(`0x${"66".repeat(20)}`)
			expect(logs[1]!.topics).toEqual([])
			expect(logs[1]!.logIndex).toBe("0x1")
			expect(logs[1]!.removed).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
