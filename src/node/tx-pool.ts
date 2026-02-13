// TxPool service — manages pending transactions and receipts.
// Uses Context.Tag + Layer pattern matching BlockStoreLive().

import { Context, Effect, Layer } from "effect"
import { TransactionNotFoundError } from "../handlers/errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal transaction representation stored in the pool. */
export interface PoolTransaction {
	/** Transaction hash (0x-prefixed). */
	readonly hash: string
	/** Sender address (0x-prefixed). */
	readonly from: string
	/** Recipient address (0x-prefixed). Undefined for contract creation. */
	readonly to?: string
	/** Value in wei. */
	readonly value: bigint
	/** Gas limit. */
	readonly gas: bigint
	/** Gas price (effective, after EIP-1559 calculation). */
	readonly gasPrice: bigint
	/** Transaction nonce. */
	readonly nonce: bigint
	/** Calldata (0x-prefixed hex). */
	readonly data: string
	/** Block hash the tx was mined in (set after mining). */
	readonly blockHash?: string
	/** Block number the tx was mined in (set after mining). */
	readonly blockNumber?: bigint
	/** Transaction index within the block. */
	readonly transactionIndex?: number
	/** Actual gas consumed by the tx (set during sendTransaction for mine() to use). */
	readonly gasUsed?: bigint
	/** Effective gas price after EIP-1559 calculation (for receipt creation during mining). */
	readonly effectiveGasPrice?: bigint
	/** Execution status: 1 for success, 0 for failure (for receipt creation during mining). */
	readonly status?: number
	/** Transaction type: 0 = legacy, 2 = EIP-1559 (for receipt creation during mining). */
	readonly type?: number
}

/** Transaction receipt — generated after mining. */
export interface TransactionReceipt {
	/** Transaction hash (0x-prefixed). */
	readonly transactionHash: string
	/** Transaction index within the block. */
	readonly transactionIndex: number
	/** Block hash. */
	readonly blockHash: string
	/** Block number. */
	readonly blockNumber: bigint
	/** Sender address. */
	readonly from: string
	/** Recipient address. Null for contract creation. */
	readonly to: string | null
	/** Cumulative gas used in the block up to and including this tx. */
	readonly cumulativeGasUsed: bigint
	/** Gas used by this specific transaction. */
	readonly gasUsed: bigint
	/** Contract address created, if any. Null for non-create txs. */
	readonly contractAddress: string | null
	/** Log entries emitted during execution. */
	readonly logs: readonly ReceiptLog[]
	/** Status: 1 for success, 0 for failure. */
	readonly status: number
	/** Effective gas price (what was actually paid per gas unit). */
	readonly effectiveGasPrice: bigint
	/** Type of transaction (0 = legacy, 2 = EIP-1559). */
	readonly type: number
}

/** Log entry in a transaction receipt. */
export interface ReceiptLog {
	readonly address: string
	readonly topics: readonly string[]
	readonly data: string
	readonly blockNumber: bigint
	readonly transactionHash: string
	readonly transactionIndex: number
	readonly blockHash: string
	readonly logIndex: number
	readonly removed: boolean
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

/** Shape of the TxPool service API. */
export interface TxPoolApi {
	/** Add a pending (unmined) transaction to the pool. */
	readonly addTransaction: (tx: PoolTransaction) => Effect.Effect<void>
	/** Get a transaction by hash. Fails with TransactionNotFoundError if missing. */
	readonly getTransaction: (hash: string) => Effect.Effect<PoolTransaction, TransactionNotFoundError>
	/** Store a receipt after mining. */
	readonly addReceipt: (receipt: TransactionReceipt) => Effect.Effect<void>
	/** Get a receipt by transaction hash. Fails with TransactionNotFoundError if missing. */
	readonly getReceipt: (hash: string) => Effect.Effect<TransactionReceipt, TransactionNotFoundError>
	/** Get all pending (unmined) transaction hashes. */
	readonly getPendingHashes: () => Effect.Effect<readonly string[]>
	/** Get all pending (unmined) transactions (full objects). */
	readonly getPendingTransactions: () => Effect.Effect<readonly PoolTransaction[]>
	/** Mark a transaction as mined (update with block info). */
	readonly markMined: (
		hash: string,
		blockHash: string,
		blockNumber: bigint,
		transactionIndex: number,
	) => Effect.Effect<void, TransactionNotFoundError>
	/** Remove a pending transaction by hash. Fails with TransactionNotFoundError if not pending. */
	readonly dropTransaction: (hash: string) => Effect.Effect<boolean, TransactionNotFoundError>
	/** Remove all pending (unmined) transactions from the pool. */
	readonly dropAllTransactions: () => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for the TxPool service. */
export class TxPoolService extends Context.Tag("TxPool")<TxPoolService, TxPoolApi>() {}

// ---------------------------------------------------------------------------
// Layer — factory function for test isolation
// ---------------------------------------------------------------------------

/** Create a fresh TxPool layer with in-memory storage. */
export const TxPoolLive = (): Layer.Layer<TxPoolService> =>
	Layer.sync(TxPoolService, () => {
		/** Transactions stored by hash. */
		const transactions = new Map<string, PoolTransaction>()
		/** Receipts stored by transaction hash. */
		const receipts = new Map<string, TransactionReceipt>()
		/** Set of pending (unmined) transaction hashes. */
		const pending = new Set<string>()

		return {
			addTransaction: (tx) =>
				Effect.sync(() => {
					transactions.set(tx.hash, tx)
					pending.add(tx.hash)
				}),

			getTransaction: (hash) =>
				Effect.sync(() => transactions.get(hash)).pipe(
					Effect.flatMap((tx) =>
						tx !== undefined ? Effect.succeed(tx) : Effect.fail(new TransactionNotFoundError({ hash })),
					),
				),

			addReceipt: (receipt) =>
				Effect.sync(() => {
					receipts.set(receipt.transactionHash, receipt)
				}),

			getReceipt: (hash) =>
				Effect.sync(() => receipts.get(hash)).pipe(
					Effect.flatMap((receipt) =>
						receipt !== undefined ? Effect.succeed(receipt) : Effect.fail(new TransactionNotFoundError({ hash })),
					),
				),

			getPendingHashes: () => Effect.sync(() => Array.from(pending)),

			getPendingTransactions: () =>
				Effect.sync(() =>
					Array.from(pending)
						.map((hash) => transactions.get(hash))
						.filter((tx): tx is PoolTransaction => tx !== undefined),
				),

			markMined: (hash, blockHash, blockNumber, transactionIndex) =>
				Effect.sync(() => transactions.get(hash)).pipe(
					Effect.flatMap((tx) => {
						if (tx === undefined) {
							return Effect.fail(new TransactionNotFoundError({ hash }))
						}
						// Update the transaction with block info
						const mined: PoolTransaction = { ...tx, blockHash, blockNumber, transactionIndex }
						transactions.set(hash, mined)
						pending.delete(hash)
						return Effect.void
					}),
				),

			dropTransaction: (hash) =>
				Effect.sync(() => pending.has(hash)).pipe(
					Effect.flatMap((isPending) => {
						if (!isPending) {
							return Effect.fail(new TransactionNotFoundError({ hash }))
						}
						pending.delete(hash)
						transactions.delete(hash)
						return Effect.succeed(true as boolean)
					}),
				),

			dropAllTransactions: () =>
				Effect.sync(() => {
					for (const hash of pending) {
						transactions.delete(hash)
					}
					pending.clear()
				}),
		} satisfies TxPoolApi
	})
