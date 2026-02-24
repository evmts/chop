import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import type { Block } from "../blockchain/block-store.js"
import { BlockStoreLive, BlockchainLive, BlockchainService } from "../blockchain/index.js"
import { MiningService, MiningServiceLive } from "./mining.js"
import type { PoolTransaction } from "./tx-pool.js"
import { TxPoolLive, TxPoolService } from "./tx-pool.js"

// ---------------------------------------------------------------------------
// Test layer
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

// Helper: make a tx with optional field omissions to test fallbacks
const makeTx = (overrides: Partial<PoolTransaction> & { hash: string }): PoolTransaction => ({
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

// ============================================================================
// Branch coverage: buildBlock sorting with effectiveGasPrice/gasPrice fallback
// ============================================================================

describe("MiningService — buildBlock branch coverage", () => {
	it.effect("sorts txs using gasPrice when effectiveGasPrice is undefined", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			// Tx without effectiveGasPrice — should fall back to gasPrice
			const tx1 = makeTx({
				hash: `0x${"01".repeat(32)}`,
				gasPrice: 5_000_000_000n,
				effectiveGasPrice: undefined as unknown as bigint,
			})
			const tx2 = makeTx({
				hash: `0x${"02".repeat(32)}`,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: undefined as unknown as bigint,
			})

			yield* txPool.addTransaction(tx1)
			yield* txPool.addTransaction(tx2)

			const blocks = yield* mining.mine(1)
			// Higher gasPrice should come first
			expect(blocks[0]!.transactionHashes![0]!).toBe(tx1.hash)
			expect(blocks[0]!.transactionHashes![1]!).toBe(tx2.hash)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("uses gas when gasUsed is undefined for block gas accumulation", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx({
				hash: `0x${"03".repeat(32)}`,
				gas: 50000n,
				gasUsed: undefined as unknown as bigint,
			})

			yield* txPool.addTransaction(tx)
			const blocks = yield* mining.mine(1)

			// Block should use gas (50000) when gasUsed is undefined
			expect(blocks[0]?.gasUsed).toBe(50000n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("receipt uses tx.to ?? null (contract creation scenario)", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			// Tx without to field (contract creation)
			const tx = makeTx({
				hash: `0x${"04".repeat(32)}`,
				to: undefined as unknown as string,
			})

			yield* txPool.addTransaction(tx)
			yield* mining.mine(1)

			const receipt = yield* txPool.getReceipt(tx.hash)
			expect(receipt.to).toBeNull()
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("receipt uses status ?? 1 when tx.status is undefined", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx({
				hash: `0x${"05".repeat(32)}`,
				status: undefined as unknown as number,
			})

			yield* txPool.addTransaction(tx)
			yield* mining.mine(1)

			const receipt = yield* txPool.getReceipt(tx.hash)
			expect(receipt.status).toBe(1) // defaults to 1
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("receipt uses effectiveGasPrice ?? gasPrice fallback", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx({
				hash: `0x${"06".repeat(32)}`,
				gasPrice: 2_000_000_000n,
				effectiveGasPrice: undefined as unknown as bigint,
			})

			yield* txPool.addTransaction(tx)
			yield* mining.mine(1)

			const receipt = yield* txPool.getReceipt(tx.hash)
			expect(receipt.effectiveGasPrice).toBe(2_000_000_000n)
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("receipt uses type ?? 0 when tx.type is undefined", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx = makeTx({
				hash: `0x${"07".repeat(32)}`,
				type: undefined as unknown as number,
			})

			yield* txPool.addTransaction(tx)
			yield* mining.mine(1)

			const receipt = yield* txPool.getReceipt(tx.hash)
			expect(receipt.type).toBe(0) // defaults to 0
		}).pipe(Effect.provide(MiningTestLayer)),
	)

	it.effect("txs with equal gasPrice maintain stable order", () =>
		Effect.gen(function* () {
			const mining = yield* MiningService
			const txPool = yield* TxPoolService

			const tx1 = makeTx({
				hash: `0x${"08".repeat(32)}`,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: 1_000_000_000n,
			})
			const tx2 = makeTx({
				hash: `0x${"09".repeat(32)}`,
				gasPrice: 1_000_000_000n,
				effectiveGasPrice: 1_000_000_000n,
			})

			yield* txPool.addTransaction(tx1)
			yield* txPool.addTransaction(tx2)

			const blocks = yield* mining.mine(1)
			expect(blocks[0]?.transactionHashes).toHaveLength(2)
		}).pipe(Effect.provide(MiningTestLayer)),
	)
})

// ============================================================================
// Additional node.ts coverage: formatBanner edge cases
// ============================================================================

import { formatBanner } from "../cli/commands/node.js"

describe("formatBanner — edge cases", () => {
	it("handles empty accounts array", () => {
		const banner = formatBanner(8545, [])
		expect(banner).toContain("http://127.0.0.1:8545")
		expect(banner).not.toContain("Available Accounts")
		expect(banner).not.toContain("Private Keys")
	})

	it("handles port 0", () => {
		const banner = formatBanner(0, [])
		expect(banner).toContain("http://127.0.0.1:0")
	})

	it("handles large port number", () => {
		const banner = formatBanner(65535, [])
		expect(banner).toContain("http://127.0.0.1:65535")
	})

	it("handles multiple accounts with correct indexing", () => {
		const accounts = [
			{ address: "0xAddr1", privateKey: "0xKey1" },
			{ address: "0xAddr2", privateKey: "0xKey2" },
			{ address: "0xAddr3", privateKey: "0xKey3" },
		]
		const banner = formatBanner(8545, accounts)
		expect(banner).toContain("(0) 0xAddr1")
		expect(banner).toContain("(1) 0xAddr2")
		expect(banner).toContain("(2) 0xAddr3")
		expect(banner).toContain("(0) 0xKey1")
		expect(banner).toContain("(1) 0xKey2")
		expect(banner).toContain("(2) 0xKey3")
	})
})
