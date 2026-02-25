import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import type { ReceiptLog } from "../node/tx-pool.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for getLogsHandler. */
export interface GetLogsParams {
	/** Start block (hex number or "latest"/"earliest"). */
	readonly fromBlock?: string
	/** End block (hex number or "latest"/"earliest"). */
	readonly toBlock?: string
	/** Filter by contract address(es). */
	readonly address?: string | readonly string[]
	/** Filter by topics. */
	readonly topics?: readonly (string | readonly string[] | null)[]
	/** Filter by specific block hash (mutually exclusive with fromBlock/toBlock). */
	readonly blockHash?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Check if a log matches the address filter. */
const matchesAddress = (log: ReceiptLog, address?: string | readonly string[]): boolean => {
	if (!address) return true
	if (typeof address === "string") return log.address.toLowerCase() === address.toLowerCase()
	return address.some((a) => log.address.toLowerCase() === a.toLowerCase())
}

/** Check if a log matches the topics filter. */
const matchesTopics = (log: ReceiptLog, topics?: readonly (string | readonly string[] | null)[]): boolean => {
	if (!topics) return true
	for (let i = 0; i < topics.length; i++) {
		const filter = topics[i]
		if (filter === null || filter === undefined) continue
		const logTopic = log.topics[i]
		if (!logTopic) return false
		if (typeof filter === "string") {
			if (logTopic.toLowerCase() !== filter.toLowerCase()) return false
		} else {
			if (!filter.some((f) => logTopic.toLowerCase() === f.toLowerCase())) return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_getLogs.
 *
 * Iterates blocks in range and collects matching logs from receipts.
 * Currently returns empty array since we don't index logs by block yet.
 * Full implementation requires iterating block transactions and their receipts.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes params and returns matching logs.
 */
export const getLogsHandler =
	(node: TevmNodeShape) =>
	(params: GetLogsParams): Effect.Effect<readonly ReceiptLog[]> =>
		Effect.gen(function* () {
			// Resolve block range
			const head = yield* node.blockchain.getHead().pipe(
				Effect.catchTag("GenesisError", () =>
					Effect.succeed({
						hash: `0x${"00".repeat(32)}`,
						parentHash: `0x${"00".repeat(32)}`,
						number: 0n,
						timestamp: 0n,
						gasLimit: 30_000_000n,
						gasUsed: 0n,
						baseFeePerGas: 1_000_000_000n,
					} satisfies import("../blockchain/block-store.js").Block),
				),
			)

			let fromBlockNum: bigint
			let toBlockNum: bigint

			if (params.blockHash) {
				// If blockHash is specified, we only look at that block
				const block = yield* node.blockchain
					.getBlock(params.blockHash)
					.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
				if (!block) return [] as readonly ReceiptLog[]
				fromBlockNum = block.number
				toBlockNum = block.number
			} else {
				fromBlockNum = params.fromBlock
					? params.fromBlock === "latest" || params.fromBlock === "pending"
						? head.number
						: params.fromBlock === "earliest"
							? 0n
							: BigInt(params.fromBlock)
					: head.number
				toBlockNum = params.toBlock
					? params.toBlock === "latest" || params.toBlock === "pending"
						? head.number
						: params.toBlock === "earliest"
							? 0n
							: BigInt(params.toBlock)
					: head.number
			}

			// Collect logs from blocks in range
			const allLogs: ReceiptLog[] = []

			for (let blockNum = fromBlockNum; blockNum <= toBlockNum; blockNum++) {
				const block = yield* node.blockchain
					.getBlockByNumber(blockNum)
					.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
				if (!block || !block.transactionHashes) continue

				// For each transaction in the block, get its receipt
				for (const txHash of block.transactionHashes) {
					const receipt = yield* node.txPool
						.getReceipt(txHash)
						.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)))
					if (!receipt) continue

					// Filter logs
					for (const log of receipt.logs) {
						if (matchesAddress(log, params.address) && matchesTopics(log, params.topics)) {
							allLogs.push(log)
						}
					}
				}
			}

			return allLogs
		})
