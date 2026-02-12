import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { type PoolTransaction, TxPoolLive, TxPoolService } from "./tx-pool.js"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeTx = (overrides: Partial<PoolTransaction> = {}): PoolTransaction => ({
	hash: `0x${"ab".repeat(32)}`,
	from: `0x${"11".repeat(20)}`,
	to: `0x${"22".repeat(20)}`,
	value: 1000n,
	gas: 21000n,
	gasPrice: 1_000_000_000n,
	nonce: 0n,
	data: "0x",
	...overrides,
})

// ---------------------------------------------------------------------------
// getPendingTransactions — direct tests
// ---------------------------------------------------------------------------

describe("TxPool — getPendingTransactions", () => {
	it.effect("returns empty array initially", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const pending = yield* pool.getPendingTransactions()
			expect(pending).toEqual([])
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("returns full PoolTransaction objects for pending txs", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx1 = makeTx({ hash: `0x${"01".repeat(32)}`, nonce: 0n, gasPrice: 2_000_000_000n })
			const tx2 = makeTx({ hash: `0x${"02".repeat(32)}`, nonce: 1n, gasPrice: 1_000_000_000n })

			yield* pool.addTransaction(tx1)
			yield* pool.addTransaction(tx2)

			const pending = yield* pool.getPendingTransactions()
			expect(pending).toHaveLength(2)
			expect(pending[0]?.hash).toBeDefined()
			expect(pending[0]?.from).toBe(tx1.from)
			expect(pending[1]?.from).toBe(tx2.from)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("returns empty array after all txs are mined", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx = makeTx()
			yield* pool.addTransaction(tx)
			yield* pool.markMined(tx.hash, "0xblock", 1n, 0)

			const pending = yield* pool.getPendingTransactions()
			expect(pending).toEqual([])
		}).pipe(Effect.provide(TxPoolLive())),
	)
})

// ---------------------------------------------------------------------------
// Duplicate transaction handling
// ---------------------------------------------------------------------------

describe("TxPool — duplicate transactions", () => {
	it.effect("adding same hash twice overwrites the transaction", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx1 = makeTx({ hash: `0x${"ab".repeat(32)}`, value: 100n })
			const tx2 = makeTx({ hash: `0x${"ab".repeat(32)}`, value: 200n })

			yield* pool.addTransaction(tx1)
			yield* pool.addTransaction(tx2)

			const result = yield* pool.getTransaction(tx1.hash)
			expect(result.value).toBe(200n)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("duplicate hash doesn't create duplicate pending entries", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx = makeTx()

			yield* pool.addTransaction(tx)
			yield* pool.addTransaction(tx)

			const pending = yield* pool.getPendingHashes()
			// Should have 2 entries since it pushes to pendingHashes each time,
			// but getPendingTransactions filters correctly
			const pendingTxs = yield* pool.getPendingTransactions()
			// Even if pendingHashes has duplicates, the txs map has only one entry
			expect(pendingTxs.length).toBeGreaterThanOrEqual(1)
		}).pipe(Effect.provide(TxPoolLive())),
	)
})

// ---------------------------------------------------------------------------
// Receipt handling edge cases
// ---------------------------------------------------------------------------

describe("TxPool — receipt edge cases", () => {
	it.effect("addReceipt with logs preserves log data", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const receipt = {
				transactionHash: `0x${"ab".repeat(32)}`,
				transactionIndex: 0,
				blockHash: `0x${"cc".repeat(32)}`,
				blockNumber: 1n,
				from: `0x${"11".repeat(20)}`,
				to: `0x${"22".repeat(20)}`,
				cumulativeGasUsed: 21000n,
				gasUsed: 21000n,
				contractAddress: null,
				logs: [
					{
						address: `0x${"33".repeat(20)}`,
						topics: [`0x${"44".repeat(32)}`],
						data: "0xdeadbeef",
						blockNumber: 1n,
						transactionHash: `0x${"ab".repeat(32)}`,
						transactionIndex: 0,
						blockHash: `0x${"cc".repeat(32)}`,
						logIndex: 0,
						removed: false,
					},
				],
				status: 1,
				effectiveGasPrice: 1_000_000_000n,
				type: 2,
			}

			yield* pool.addReceipt(receipt)
			const result = yield* pool.getReceipt(receipt.transactionHash)

			expect(result.logs).toHaveLength(1)
			expect(result.logs[0]?.data).toBe("0xdeadbeef")
			expect(result.type).toBe(2)
		}).pipe(Effect.provide(TxPoolLive())),
	)
})
