import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import type { Block } from "../blockchain/block-store.js"
import { BlockStoreLive, BlockchainLive, BlockchainService } from "../blockchain/index.js"
import { MiningService, MiningServiceLive } from "./mining.js"
import type { PoolTransaction } from "./tx-pool.js"
import { TxPoolLive, TxPoolService } from "./tx-pool.js"

// ---------------------------------------------------------------------------
// Test layer: MiningService + BlockchainService + TxPoolService
// ---------------------------------------------------------------------------

const genesisBlock: Block = {
	hash: `0x${"00".repeat(31)}01`,
	parentHash: `0x${"00".repeat(32)}`,
	number: 0n,
	timestamp: 0n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
}

/** Build a test layer with initialized genesis block + MiningService. */
const MiningTestLayer = Layer.effect(
	MiningService,
	Effect.gen(function* () {
		const blockchain = yield* BlockchainService
		yield* blockchain.initGenesis(genesisBlock).pipe(Effect.catchTag("GenesisError", () => Effect.void))

		return yield* MiningService
	}),
).pipe(
	Layer.provide(MiningServiceLive),
	Layer.provideMerge(BlockchainLive.pipe(Layer.provide(BlockStoreLive()))),
	Layer.provideMerge(TxPoolLive()),
)

// Helper: make a test transaction
const makeTx = (overrides: Partial<PoolTransaction> = {}): PoolTransaction => ({
	hash: `0x${"ab".repeat(32)}`,
	from: `0x${"11".repeat(20)}`,
	to: `0x${"22".repeat(20)}`,
	value: 1000n,
	gas: 21000n,
	gasPrice: 1_000_000_000n,
	nonce: 0n,
	data: "0x",
	gasUsed: 21000n,
	effectiveGasPrice: 1_000_000_000n,
	status: 1,
	type: 0,
	...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MiningService", () => {
	// -----------------------------------------------------------------------
	// Mode management
	// -----------------------------------------------------------------------

	it.effect("getMode() returns 'auto' by default", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const mode = yield* mining.getMode()
			expect(mode).toBe("auto")
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("setAutomine(false) switches to 'manual'", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			yield* mining.setAutomine(false)
			const mode = yield* mining.getMode()
			expect(mode).toBe("manual")
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("setAutomine(true) switches back to 'auto'", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			yield* mining.setAutomine(false)
			yield* mining.setAutomine(true)
			const mode = yield* mining.getMode()
			expect(mode).toBe("auto")
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("setIntervalMining(1000) switches to 'interval'", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			yield* mining.setIntervalMining(1000)
			const mode = yield* mining.getMode()
			expect(mode).toBe("interval")
			const interval = yield* mining.getInterval()
			expect(interval).toBe(1000)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("setIntervalMining(0) switches to 'manual'", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			yield* mining.setIntervalMining(1000)
			yield* mining.setIntervalMining(0)
			const mode = yield* mining.getMode()
			expect(mode).toBe("manual")
			const interval = yield* mining.getInterval()
			expect(interval).toBe(0)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	// -----------------------------------------------------------------------
	// Mining with no pending txs
	// -----------------------------------------------------------------------

	it.effect("mine(1) with no pending txs creates one empty block", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const blockchain = yield* BlockchainService

			const headBefore = yield* blockchain.getHeadBlockNumber()
			const blocks = yield* mining.mine(1)

			expect(blocks).toHaveLength(1)
			expect(blocks[0]!.number).toBe(headBefore + 1n)
			expect(blocks[0]!.gasUsed).toBe(0n)
			expect(blocks[0]!.transactionHashes).toEqual([])

			const headAfter = yield* blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("mine(3) with no pending txs creates three empty blocks", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const blockchain = yield* BlockchainService

			const headBefore = yield* blockchain.getHeadBlockNumber()
			const blocks = yield* mining.mine(3)

			expect(blocks).toHaveLength(3)
			expect(blocks[0]!.number).toBe(headBefore + 1n)
			expect(blocks[1]!.number).toBe(headBefore + 2n)
			expect(blocks[2]!.number).toBe(headBefore + 3n)

			const headAfter = yield* blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 3n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("mine() defaults to 1 block", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const blockchain = yield* BlockchainService

			const headBefore = yield* blockchain.getHeadBlockNumber()
			const blocks = yield* mining.mine()

			expect(blocks).toHaveLength(1)
			const headAfter = yield* blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	// -----------------------------------------------------------------------
	// Mining with pending txs
	// -----------------------------------------------------------------------

	it.effect("mine(1) with pending txs includes them in block", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx()
			yield* txPool.addTransaction(tx)

			const blocks = yield* mining.mine(1)

			// Block should contain the tx
			expect(blocks).toHaveLength(1)
			expect(blocks[0]!.transactionHashes).toEqual([tx.hash])
			expect(blocks[0]!.gasUsed).toBe(21000n)

			// Tx should be marked as mined
			const pendingAfter = yield* txPool.getPendingHashes()
			expect(pendingAfter).toHaveLength(0)

			// Receipt should be created
			const receipt = yield* txPool.getReceipt(tx.hash)
			expect(receipt.status).toBe(1)
			expect(receipt.gasUsed).toBe(21000n)
			expect(receipt.blockNumber).toBe(blocks[0]!.number)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("mine(1) with multiple pending txs orders by gasPrice desc", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const lowFeeTx = makeTx({
				hash: `0x${"01".repeat(32)}`,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: 1_000_000_000n,
				nonce: 0n,
			})
			const highFeeTx = makeTx({
				hash: `0x${"02".repeat(32)}`,
				gasPrice: 5_000_000_000n,
				effectiveGasPrice: 5_000_000_000n,
				nonce: 1n,
			})

			// Add low fee first, then high fee
			yield* txPool.addTransaction(lowFeeTx)
			yield* txPool.addTransaction(highFeeTx)

			const blocks = yield* mining.mine(1)

			// High fee tx should come first
			expect(blocks[0]!.transactionHashes![0]).toBe(highFeeTx.hash)
			expect(blocks[0]!.transactionHashes![1]).toBe(lowFeeTx.hash)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("mine(1) with txs exceeding gasLimit only includes txs that fit", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			// Gas limit is 30_000_000. Create txs that exceed it.
			const tx1 = makeTx({
				hash: `0x${"01".repeat(32)}`,
				gas: 20_000_000n,
				gasUsed: 20_000_000n,
				gasPrice: 2_000_000_000n,
				effectiveGasPrice: 2_000_000_000n,
			})
			const tx2 = makeTx({
				hash: `0x${"02".repeat(32)}`,
				gas: 20_000_000n,
				gasUsed: 20_000_000n,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: 1_000_000_000n,
			})

			yield* txPool.addTransaction(tx1)
			yield* txPool.addTransaction(tx2)

			const blocks = yield* mining.mine(1)

			// Only tx1 (higher fee) should fit
			expect(blocks[0]!.transactionHashes).toHaveLength(1)
			expect(blocks[0]!.transactionHashes![0]).toBe(tx1.hash)
			expect(blocks[0]!.gasUsed).toBe(20_000_000n)

			// tx2 should still be pending
			const pending = yield* txPool.getPendingHashes()
			expect(pending).toContain(tx2.hash)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	// -----------------------------------------------------------------------
	// Block building correctness
	// -----------------------------------------------------------------------

	it.effect("block has correct parentHash linking to previous head", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const blockchain = yield* BlockchainService

			const headBefore = yield* blockchain.getHead()
			const blocks = yield* mining.mine(1)

			expect(blocks[0]!.parentHash).toBe(headBefore.hash)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("block preserves gasLimit and baseFeePerGas from parent", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService

			const blocks = yield* mining.mine(1)

			expect(blocks[0]!.gasLimit).toBe(genesisBlock.gasLimit)
			expect(blocks[0]!.baseFeePerGas).toBe(genesisBlock.baseFeePerGas)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("receipt has correct cumulativeGasUsed for multiple txs", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx1 = makeTx({
				hash: `0x${"01".repeat(32)}`,
				gasUsed: 21000n,
				gasPrice: 2_000_000_000n,
				effectiveGasPrice: 2_000_000_000n,
			})
			const tx2 = makeTx({
				hash: `0x${"02".repeat(32)}`,
				gasUsed: 42000n,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: 1_000_000_000n,
			})

			yield* txPool.addTransaction(tx1)
			yield* txPool.addTransaction(tx2)

			yield* mining.mine(1)

			// tx1 (higher fee) comes first
			const receipt1 = yield* txPool.getReceipt(tx1.hash)
			const receipt2 = yield* txPool.getReceipt(tx2.hash)

			expect(receipt1.cumulativeGasUsed).toBe(21000n)
			expect(receipt1.transactionIndex).toBe(0)
			expect(receipt2.cumulativeGasUsed).toBe(21000n + 42000n)
			expect(receipt2.transactionIndex).toBe(1)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	// -----------------------------------------------------------------------
	// mine(N) only includes txs in first block
	// -----------------------------------------------------------------------

	it.effect("mine(3) only includes pending txs in first block, rest are empty", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx()
			yield* txPool.addTransaction(tx)

			const blocks = yield* mining.mine(3)

			expect(blocks).toHaveLength(3)
			// First block has the tx
			expect(blocks[0]!.transactionHashes).toEqual([tx.hash])
			expect(blocks[0]!.gasUsed).toBe(21000n)
			// Subsequent blocks are empty
			expect(blocks[1]!.transactionHashes).toEqual([])
			expect(blocks[1]!.gasUsed).toBe(0n)
			expect(blocks[2]!.transactionHashes).toEqual([])
			expect(blocks[2]!.gasUsed).toBe(0n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)
})
