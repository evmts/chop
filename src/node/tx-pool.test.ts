import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TransactionNotFoundError } from "../handlers/errors.js"
import { type PoolTransaction, type TransactionReceipt, TxPoolLive, TxPoolService } from "./tx-pool.js"

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

const makeReceipt = (overrides: Partial<TransactionReceipt> = {}): TransactionReceipt => ({
	transactionHash: `0x${"ab".repeat(32)}`,
	transactionIndex: 0,
	blockHash: `0x${"cc".repeat(32)}`,
	blockNumber: 1n,
	from: `0x${"11".repeat(20)}`,
	to: `0x${"22".repeat(20)}`,
	cumulativeGasUsed: 21000n,
	gasUsed: 21000n,
	contractAddress: null,
	logs: [],
	status: 1,
	effectiveGasPrice: 1_000_000_000n,
	type: 0,
	...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TxPool", () => {
	// -----------------------------------------------------------------------
	// Transaction management
	// -----------------------------------------------------------------------

	it.effect("addTransaction + getTransaction round-trip", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx = makeTx()

			yield* pool.addTransaction(tx)
			const result = yield* pool.getTransaction(tx.hash)

			expect(result.hash).toBe(tx.hash)
			expect(result.from).toBe(tx.from)
			expect(result.value).toBe(1000n)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("getTransaction fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService

			const result = yield* pool.getTransaction("0xdeadbeef").pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("TransactionNotFoundError")
			}
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("addTransaction marks tx as pending", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx = makeTx()

			yield* pool.addTransaction(tx)
			const pending = yield* pool.getPendingHashes()

			expect(pending).toContain(tx.hash)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	// -----------------------------------------------------------------------
	// Receipt management
	// -----------------------------------------------------------------------

	it.effect("addReceipt + getReceipt round-trip", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const receipt = makeReceipt()

			yield* pool.addReceipt(receipt)
			const result = yield* pool.getReceipt(receipt.transactionHash)

			expect(result.transactionHash).toBe(receipt.transactionHash)
			expect(result.status).toBe(1)
			expect(result.gasUsed).toBe(21000n)
			expect(result.logs).toHaveLength(0)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("getReceipt fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService

			const result = yield* pool.getReceipt("0xdeadbeef").pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("TransactionNotFoundError")
			}
		}).pipe(Effect.provide(TxPoolLive())),
	)

	// -----------------------------------------------------------------------
	// Mining lifecycle
	// -----------------------------------------------------------------------

	it.effect("markMined removes tx from pending and updates block info", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx = makeTx()

			yield* pool.addTransaction(tx)

			// Should be pending
			const pendingBefore = yield* pool.getPendingHashes()
			expect(pendingBefore).toContain(tx.hash)

			// Mine it
			const blockHash = `0x${"ff".repeat(32)}`
			yield* pool.markMined(tx.hash, blockHash, 1n, 0)

			// Should no longer be pending
			const pendingAfter = yield* pool.getPendingHashes()
			expect(pendingAfter).not.toContain(tx.hash)

			// Should have block info
			const mined = yield* pool.getTransaction(tx.hash)
			expect(mined.blockHash).toBe(blockHash)
			expect(mined.blockNumber).toBe(1n)
			expect(mined.transactionIndex).toBe(0)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	it.effect("markMined fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService

			const result = yield* pool.markMined("0xdeadbeef", "0xblock", 1n, 0).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("TransactionNotFoundError")
			}
		}).pipe(Effect.provide(TxPoolLive())),
	)

	// -----------------------------------------------------------------------
	// Multiple transactions
	// -----------------------------------------------------------------------

	it.effect("handles multiple pending transactions", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			const tx1 = makeTx({ hash: `0x${"01".repeat(32)}`, nonce: 0n })
			const tx2 = makeTx({ hash: `0x${"02".repeat(32)}`, nonce: 1n })

			yield* pool.addTransaction(tx1)
			yield* pool.addTransaction(tx2)

			const pending = yield* pool.getPendingHashes()
			expect(pending).toHaveLength(2)
			expect(pending).toContain(tx1.hash)
			expect(pending).toContain(tx2.hash)
		}).pipe(Effect.provide(TxPoolLive())),
	)

	// -----------------------------------------------------------------------
	// Test isolation
	// -----------------------------------------------------------------------

	it.effect("each TxPoolLive() creates an independent pool", () =>
		Effect.gen(function* () {
			const pool = yield* TxPoolService
			// Fresh pool should have no pending txs
			const pending = yield* pool.getPendingHashes()
			expect(pending).toHaveLength(0)
		}).pipe(Effect.provide(TxPoolLive())),
	)
})
