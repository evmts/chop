/**
 * Pure Effect functions that query TevmNodeShape for transaction data.
 *
 * Walks blocks from head backwards, fetches PoolTransaction + TransactionReceipt
 * per tx hash, and maps to TransactionDetail[]. Returns newest first.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the transactions view should never fail.
 */

import { Effect } from "effect"
import type { Block } from "../../blockchain/block-store.js"
import type { TevmNodeShape } from "../../node/index.js"
import type { PoolTransaction, ReceiptLog, TransactionReceipt } from "../../node/tx-pool.js"
import { formatTxType } from "./transactions-format.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detail for a single mined transaction. */
export interface TransactionDetail {
	/** Transaction hash (0x-prefixed). */
	readonly hash: string
	/** Block number the tx was mined in. */
	readonly blockNumber: bigint
	/** Block hash the tx was mined in. */
	readonly blockHash: string
	/** Sender address (0x-prefixed). */
	readonly from: string
	/** Recipient address (0x-prefixed). Undefined for contract creation. */
	readonly to: string | undefined
	/** Value in wei. */
	readonly value: bigint
	/** Gas price (effective). */
	readonly gasPrice: bigint
	/** Gas consumed. */
	readonly gasUsed: bigint
	/** Gas limit. */
	readonly gas: bigint
	/** Receipt status: 1 success, 0 failure. */
	readonly status: number
	/** Transaction type: 0 legacy, 1 EIP-2930, 2 EIP-1559, 3 EIP-4844. */
	readonly type: number
	/** Transaction nonce. */
	readonly nonce: bigint
	/** Calldata (0x-prefixed hex). */
	readonly data: string
	/** Log entries from receipt. */
	readonly logs: readonly ReceiptLog[]
	/** Contract address created (from receipt), if any. */
	readonly contractAddress: string | null
}

/** Aggregated data for the transactions view. */
export interface TransactionsViewData {
	/** All transactions in reverse chronological order. */
	readonly transactions: readonly TransactionDetail[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a pool transaction + optional receipt + block to a TransactionDetail. */
const toDetail = (tx: PoolTransaction, receipt: TransactionReceipt | null, block: Block): TransactionDetail => ({
	hash: tx.hash,
	blockNumber: block.number,
	blockHash: block.hash,
	from: tx.from,
	to: tx.to,
	value: tx.value,
	gasPrice: tx.gasPrice,
	gasUsed: receipt?.gasUsed ?? tx.gasUsed ?? 0n,
	gas: tx.gas,
	status: receipt ? receipt.status : (tx.status ?? 1),
	type: receipt ? receipt.type : (tx.type ?? 0),
	nonce: tx.nonce,
	data: tx.data,
	logs: receipt?.logs ?? [],
	contractAddress: receipt?.contractAddress ?? null,
})

/** Fetch a single transaction detail by hash from the node. */
const fetchTxDetail = (node: TevmNodeShape, hash: string, block: Block): Effect.Effect<TransactionDetail | null> =>
	Effect.gen(function* () {
		const tx = yield* node.txPool
			.getTransaction(hash)
			.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)))
		if (tx === null) return null

		const receipt = yield* node.txPool
			.getReceipt(hash)
			.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)))

		return toDetail(tx, receipt, block)
	})

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch mined transactions from the node.
 *
 * Walks blocks from head backwards, collecting transaction details.
 * Returns newest first, limited to `count`.
 */
export const getTransactionsData = (node: TevmNodeShape, count = 100): Effect.Effect<TransactionsViewData> =>
	Effect.gen(function* () {
		const headBlockNumber = yield* node.blockchain
			.getHeadBlockNumber()
			.pipe(Effect.catchTag("GenesisError", () => Effect.succeed(0n)))

		const transactions: TransactionDetail[] = []
		const seen = new Set<string>()

		for (let n = headBlockNumber; n >= 0n && transactions.length < count; n--) {
			const block = yield* node.blockchain
				.getBlockByNumber(n)
				.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
			if (block === null) break

			const hashes = block.transactionHashes ?? []
			for (const hash of hashes) {
				if (transactions.length >= count) break
				if (seen.has(hash)) continue
				seen.add(hash)

				const detail = yield* fetchTxDetail(node, hash, block)
				if (detail !== null) transactions.push(detail)
			}
		}

		return { transactions }
	}).pipe(Effect.catchAll(() => Effect.succeed({ transactions: [] as readonly TransactionDetail[] })))

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Map type number to searchable text. */
const typeText = (type: number): string => formatTxType(type).toLowerCase()

/**
 * Filter transactions by case-insensitive substring match.
 *
 * Matches against: hash, from, to, status text ('success'/'fail'),
 * type text ('legacy'/'eip-1559'), blockNumber.
 * Empty query returns input unchanged.
 */
export const filterTransactions = (txs: readonly TransactionDetail[], query: string): readonly TransactionDetail[] => {
	if (query === "") return txs
	const q = query.toLowerCase()
	return txs.filter((tx) => {
		const searchable = [
			tx.hash,
			tx.from,
			tx.to ?? "",
			tx.status === 1 ? "success" : "fail",
			typeText(tx.type),
			tx.blockNumber.toString(),
		]
		return searchable.some((field) => field.toLowerCase().includes(q))
	})
}
