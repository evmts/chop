import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import type { ReceiptLog, TransactionReceipt } from "../node/tx-pool.js"
import { sendTransactionHandler } from "./sendTransaction.js"
import { getLogsHandler } from "./getLogs.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock receipt log. */
const makeLog = (overrides: Partial<ReceiptLog> = {}): ReceiptLog => ({
	address: overrides.address ?? "0x0000000000000000000000000000000000000042",
	topics: overrides.topics ?? ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
	data: overrides.data ?? "0x0000000000000000000000000000000000000000000000000000000000000064",
	blockNumber: overrides.blockNumber ?? 1n,
	transactionHash: overrides.transactionHash ?? `0x${"ab".repeat(32)}`,
	transactionIndex: overrides.transactionIndex ?? 0,
	blockHash: overrides.blockHash ?? `0x${"cd".repeat(32)}`,
	logIndex: overrides.logIndex ?? 0,
	removed: overrides.removed ?? false,
})

/**
 * Send a tx, inject custom logs into its receipt, and return the block hash.
 * Uses blockHash for all filtering tests to avoid range-iteration doubling.
 */
const sendTxAndInjectLogs = (
	node: { readonly accounts: readonly { readonly address: string }[] } & Parameters<typeof sendTransactionHandler>[0],
	logs: ReceiptLog[],
) =>
	Effect.gen(function* () {
		const sender = node.accounts[0]!
		const result = yield* sendTransactionHandler(node)({
			from: sender.address,
			to: `0x${"22".repeat(20)}`,
			value: 0n,
		})
		// Now inject logs into the receipt
		const receipt = yield* node.txPool.getReceipt(result.hash)
		// Create a new receipt with the provided logs
		const receiptWithLogs: TransactionReceipt = {
			...receipt,
			logs: logs.map((log, idx) => ({
				...log,
				transactionHash: result.hash,
				blockHash: receipt.blockHash,
				blockNumber: receipt.blockNumber,
				transactionIndex: receipt.transactionIndex,
				logIndex: idx,
			})),
		}
		yield* node.txPool.addReceipt(receiptWithLogs)
		// Get the block hash for use in blockHash queries
		const head = yield* node.blockchain.getHead()
		return { hash: result.hash, receipt: receiptWithLogs, blockHash: head.hash }
	})

// ---------------------------------------------------------------------------
// matchesAddress — tested indirectly via getLogsHandler (blockHash path)
// ---------------------------------------------------------------------------

describe("getLogs — address filtering", () => {
	it.effect("single address filter matches log", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logAddr = "0x0000000000000000000000000000000000000042"
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ address: logAddr })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: logAddr,
			})
			expect(result.length).toBe(1)
			expect(result[0]!.address).toBe(logAddr)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("single address filter excludes non-matching log", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [
				makeLog({ address: "0x0000000000000000000000000000000000000042" }),
			])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: "0x0000000000000000000000000000000000000099",
			})
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("address filter is case-insensitive", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [
				makeLog({ address: "0x000000000000000000000000000000000000ABCD" }),
			])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: "0x000000000000000000000000000000000000abcd",
			})
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("array of addresses matches if one matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logAddr = "0x0000000000000000000000000000000000000042"
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ address: logAddr })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: ["0x0000000000000000000000000000000000000099", logAddr],
			})
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("array of addresses returns empty if none match", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [
				makeLog({ address: "0x0000000000000000000000000000000000000042" }),
			])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: ["0x0000000000000000000000000000000000000099", "0x0000000000000000000000000000000000000088"],
			})
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("no address filter returns all logs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [
				makeLog({ address: "0x0000000000000000000000000000000000000001" }),
				makeLog({ address: "0x0000000000000000000000000000000000000002" }),
			])

			const result = yield* getLogsHandler(node)({ blockHash })
			expect(result.length).toBe(2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// matchesTopics — tested indirectly via getLogsHandler (blockHash path)
// ---------------------------------------------------------------------------

describe("getLogs — topic filtering", () => {
	const topic1 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	const topic2 = "0x0000000000000000000000000000000000000000000000000000000000000001"

	it.effect("null topic position acts as wildcard", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1, topic2] })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [null, topic2],
			})
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("single string topic matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1] })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [topic1],
			})
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("single string topic does not match", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1] })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [topic2], // doesn't match topic1
			})
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("array topic (OR match) matches if one matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1] })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [[topic2, topic1]], // OR: topic2 OR topic1
			})
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("array topic (OR match) returns empty if none match", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1] })])

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [[topic2]], // only topic2 in OR list
			})
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("log with fewer topics than filter is excluded", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { blockHash } = yield* sendTxAndInjectLogs(node, [makeLog({ topics: [topic1] })]) // only 1 topic

			const result = yield* getLogsHandler(node)({
				blockHash,
				topics: [topic1, topic2], // expects 2 topics
			})
			expect(result.length).toBe(0) // log only has 1 topic
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Block range parsing
// ---------------------------------------------------------------------------

describe("getLogs — block range parsing", () => {
	it.effect("fromBlock as hex string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Fresh node has only genesis block 0, so "0x0" should work
			const result = yield* getLogsHandler(node)({ fromBlock: "0x0", toBlock: "latest" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("toBlock as 'earliest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "earliest", toBlock: "earliest" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fromBlock as 'pending' is treated as latest", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "pending", toBlock: "latest" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("toBlock as 'pending' is treated as latest", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "earliest", toBlock: "pending" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("blockHash pointing to existing block returns logs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Send tx to create block 1
			yield* sendTxAndInjectLogs(node, [makeLog()])

			// Get block 1 hash
			const head = yield* node.blockchain.getHead()
			const result = yield* getLogsHandler(node)({ blockHash: head.hash })
			expect(result.length).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Combined address + topic filtering
// ---------------------------------------------------------------------------

describe("getLogs — combined filtering", () => {
	it.effect("address + topic filter narrows results", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const topic1 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
			const matchAddr = "0x0000000000000000000000000000000000000042"
			const otherAddr = "0x0000000000000000000000000000000000000099"

			const { blockHash } = yield* sendTxAndInjectLogs(node, [
				makeLog({ address: matchAddr, topics: [topic1] }),
				makeLog({ address: otherAddr, topics: [topic1] }),
			])

			const result = yield* getLogsHandler(node)({
				blockHash,
				address: matchAddr,
				topics: [topic1],
			})
			expect(result.length).toBe(1)
			expect(result[0]!.address).toBe(matchAddr)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
