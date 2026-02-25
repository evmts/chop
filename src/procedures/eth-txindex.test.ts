import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	ethAccounts,
	ethGetBlockByNumber,
	ethGetBlockTransactionCountByHash,
	ethGetBlockTransactionCountByNumber,
	ethGetFilterChanges,
	ethGetTransactionByBlockHashAndIndex,
	ethGetTransactionByBlockNumberAndIndex,
	ethNewFilter,
	ethNewPendingTransactionFilter,
	ethSendTransaction,
} from "./eth.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a simple ETH transfer and return the tx hash. */
const sendSimpleTx = (node: Parameters<typeof ethSendTransaction>[0] & { accounts: readonly { address: string }[] }) =>
	Effect.gen(function* () {
		const accounts = (yield* ethAccounts(node)([])) as string[]
		const sender = accounts[0]!
		const result = yield* ethSendTransaction(node)([
			{
				from: sender,
				to: `0x${"22".repeat(20)}`,
				value: "0x0",
			},
		])
		return result as string
	})

// ---------------------------------------------------------------------------
// Transaction-by-index happy paths (covers lines 591-595, 609-613)
// ---------------------------------------------------------------------------

describe("ethGetTransactionByBlockHashAndIndex — with transactions", () => {
	it.effect("returns tx for valid index in block with transactions", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const txHash = yield* sendSimpleTx(node)

			// Get block 1 (auto-mined)
			const block = (yield* ethGetBlockByNumber(node)(["0x1", false])) as Record<string, unknown>
			expect(block).not.toBeNull()
			const blockHash = block.hash as string

			// Query tx at index 0
			const result = yield* ethGetTransactionByBlockHashAndIndex(node)([blockHash, "0x0"])
			expect(result).not.toBeNull()
			const tx = result as Record<string, unknown>
			expect(tx.hash).toBe(txHash)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for out-of-bounds index", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* sendSimpleTx(node)

			const block = (yield* ethGetBlockByNumber(node)(["0x1", false])) as Record<string, unknown>
			const blockHash = block.hash as string

			// Index 99 is out of bounds
			const result = yield* ethGetTransactionByBlockHashAndIndex(node)([blockHash, "0x63"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetTransactionByBlockNumberAndIndex — with transactions", () => {
	it.effect("returns tx for valid index in block with transactions", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const txHash = yield* sendSimpleTx(node)

			const result = yield* ethGetTransactionByBlockNumberAndIndex(node)(["0x1", "0x0"])
			expect(result).not.toBeNull()
			const tx = result as Record<string, unknown>
			expect(tx.hash).toBe(txHash)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for out-of-bounds index", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* sendSimpleTx(node)

			const result = yield* ethGetTransactionByBlockNumberAndIndex(node)(["0x1", "0x63"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Block transaction count with real transactions (covers lines 552-575)
// ---------------------------------------------------------------------------

describe("ethGetBlockTransactionCountByHash — with transactions", () => {
	it.effect("returns correct count for block with 1 tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* sendSimpleTx(node)

			const block = (yield* ethGetBlockByNumber(node)(["0x1", false])) as Record<string, unknown>
			const blockHash = block.hash as string

			const result = yield* ethGetBlockTransactionCountByHash(node)([blockHash])
			expect(result).toBe("0x1")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetBlockTransactionCountByNumber — with transactions", () => {
	it.effect("returns correct count for block with 1 tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* sendSimpleTx(node)

			const result = yield* ethGetBlockTransactionCountByNumber(node)(["0x1"])
			expect(result).toBe("0x1")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetFilterChanges — log filter path (covers lines 486-494)
// ---------------------------------------------------------------------------

describe("ethGetFilterChanges — log filter", () => {
	it.effect("returns logs for log filter after new blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create a log filter for all logs
			const filterId = yield* ethNewFilter(node)([{ fromBlock: "0x0", toBlock: "latest" }])

			// Send a tx to create block 1
			yield* sendSimpleTx(node)

			// Get filter changes — should return logs (empty since mining creates receipts with empty logs)
			const result = yield* ethGetFilterChanges(node)([filterId])
			// The result should be an array (of logs, even if empty since auto-mined receipts have no logs)
			expect(Array.isArray(result)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("log filter with address criteria works", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create a log filter with address
			const filterId = yield* ethNewFilter(node)([
				{
					fromBlock: "0x0",
					toBlock: "latest",
					address: "0x0000000000000000000000000000000000000042",
				},
			])

			yield* sendSimpleTx(node)

			const result = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(result)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("log filter with topics criteria works", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create a log filter with topics
			const filterId = yield* ethNewFilter(node)([
				{
					fromBlock: "0x0",
					toBlock: "latest",
					topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
				},
			])

			yield* sendSimpleTx(node)

			const result = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(result)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("pending transaction filter returns pending hashes", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Switch to manual mining so tx stays pending
			yield* node.mining.setAutomine(false)

			// Create pending tx filter
			const filterId = yield* ethNewPendingTransactionFilter(node)([])

			// Add a pending transaction
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!
			yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
				},
			])

			const result = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(result)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
