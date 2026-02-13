// Shared helpers for JSON-RPC procedures — block tag resolution and serialization.

import { Effect } from "effect"
import type { Block } from "../blockchain/block-store.js"
import type { BlockchainApi } from "../blockchain/index.js"
import type { PoolTransaction, ReceiptLog } from "../node/tx-pool.js"
import { bigintToHex } from "./eth.js"

// ---------------------------------------------------------------------------
// Block tag resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a JSON-RPC block tag to a Block.
 *
 * Supports: "latest", "earliest", "pending" (treated as latest), "safe", "finalized",
 * or a hex-encoded block number (e.g. "0x0", "0x1a").
 *
 * Returns null if the block is not found (for hex numbers).
 */
export const resolveBlockTag = (
	blockchain: BlockchainApi,
	tag: string | undefined,
): Effect.Effect<Block | null> =>
	Effect.gen(function* () {
		const resolved = tag ?? "latest"

		switch (resolved) {
			case "latest":
			case "pending":
			case "safe":
			case "finalized":
				return yield* blockchain.getHead().pipe(
					Effect.catchTag("GenesisError", () => Effect.succeed(null as Block | null)),
				)

			case "earliest":
				return yield* blockchain.getBlockByNumber(0n).pipe(
					Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null as Block | null)),
				)

			default: {
				// Hex-encoded block number
				const blockNumber = BigInt(resolved)
				return yield* blockchain.getBlockByNumber(blockNumber).pipe(
					Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null as Block | null)),
				)
			}
		}
	})

// ---------------------------------------------------------------------------
// Block serialization
// ---------------------------------------------------------------------------

/** Zero hash constant for fields we don't track. */
const ZERO_HASH = `0x${"00".repeat(32)}`

/** Zero address constant. */
const ZERO_ADDRESS = `0x${"00".repeat(20)}`

/**
 * Convert a Block to JSON-RPC block object format.
 *
 * When includeFullTxs is false, transactions is an array of hashes.
 * When true, transactions would be full tx objects (not implemented yet — returns hashes).
 */
export const serializeBlock = (
	block: Block,
	includeFullTxs: boolean,
): Record<string, unknown> => ({
	number: bigintToHex(block.number),
	hash: block.hash,
	parentHash: block.parentHash,
	nonce: "0x0000000000000000",
	sha3Uncles: ZERO_HASH,
	logsBloom: `0x${"00".repeat(256)}`,
	transactionsRoot: ZERO_HASH,
	stateRoot: ZERO_HASH,
	receiptsRoot: ZERO_HASH,
	miner: ZERO_ADDRESS,
	difficulty: "0x0",
	totalDifficulty: "0x0",
	extraData: "0x",
	size: "0x0",
	gasLimit: bigintToHex(block.gasLimit),
	gasUsed: bigintToHex(block.gasUsed),
	timestamp: bigintToHex(block.timestamp),
	transactions: includeFullTxs
		? (block.transactionHashes ?? [])
		: (block.transactionHashes ?? []),
	uncles: [],
	baseFeePerGas: bigintToHex(block.baseFeePerGas),
	mixHash: ZERO_HASH,
})

// ---------------------------------------------------------------------------
// Transaction serialization
// ---------------------------------------------------------------------------

/**
 * Convert a PoolTransaction to JSON-RPC transaction object format.
 * All bigint fields are serialized as hex strings.
 */
export const serializeTransaction = (
	tx: PoolTransaction,
): Record<string, unknown> => ({
	hash: tx.hash,
	nonce: bigintToHex(tx.nonce),
	blockHash: tx.blockHash ?? null,
	blockNumber: tx.blockNumber !== undefined ? bigintToHex(tx.blockNumber) : null,
	transactionIndex: tx.transactionIndex !== undefined ? bigintToHex(BigInt(tx.transactionIndex)) : null,
	from: tx.from,
	to: tx.to ?? null,
	value: bigintToHex(tx.value),
	gasPrice: bigintToHex(tx.gasPrice),
	gas: bigintToHex(tx.gas),
	input: tx.data,
	v: "0x0",
	r: ZERO_HASH,
	s: ZERO_HASH,
	type: bigintToHex(BigInt(tx.type ?? 0)),
})

// ---------------------------------------------------------------------------
// Log serialization
// ---------------------------------------------------------------------------

/**
 * Convert a ReceiptLog to JSON-RPC log object format.
 */
export const serializeLog = (
	log: ReceiptLog,
): Record<string, unknown> => ({
	address: log.address,
	topics: log.topics,
	data: log.data,
	blockNumber: bigintToHex(log.blockNumber),
	transactionHash: log.transactionHash,
	transactionIndex: bigintToHex(BigInt(log.transactionIndex)),
	blockHash: log.blockHash,
	logIndex: bigintToHex(BigInt(log.logIndex)),
	removed: log.removed,
})
