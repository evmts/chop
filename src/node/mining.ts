// MiningService — manages mining modes (auto/manual/interval) and block building.
// Uses Context.Tag + Layer pattern matching other services.

import { Context, Effect, Layer, Ref } from "effect"
import type { Block } from "../blockchain/block-store.js"
import { BlockchainService } from "../blockchain/blockchain.js"
import type { PoolTransaction, TransactionReceipt } from "./tx-pool.js"
import { TxPoolService } from "./tx-pool.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mining mode: auto (mine after each tx), manual (explicit mine), or interval (periodic). */
export type MiningMode = "auto" | "manual" | "interval"

/** Shape of the MiningService API. */
export interface MiningServiceApi {
	/** Get the current mining mode. */
	readonly getMode: () => Effect.Effect<MiningMode>
	/** Enable or disable auto-mine. When disabled, switches to manual mode. */
	readonly setAutomine: (enabled: boolean) => Effect.Effect<void>
	/** Set interval mining. If ms > 0, switches to interval mode. If ms === 0, switches to manual. */
	readonly setIntervalMining: (intervalMs: number) => Effect.Effect<void>
	/** Get the current interval in ms (0 if not in interval mode). */
	readonly getInterval: () => Effect.Effect<number>
	/** Mine one or more blocks. Returns the created blocks. */
	readonly mine: (blockCount?: number) => Effect.Effect<readonly Block[]>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for MiningService. */
export class MiningService extends Context.Tag("Mining")<MiningService, MiningServiceApi>() {}

// ---------------------------------------------------------------------------
// Block builder — sorts txs by fee, accumulates gas, creates block + receipts
// ---------------------------------------------------------------------------

/** Build a single block from pending transactions. */
const buildBlock = (
	parent: Block,
	pendingTxs: readonly PoolTransaction[],
	blockNumber: bigint,
): { block: Block; includedTxs: readonly PoolTransaction[]; cumulativeGasUsed: bigint } => {
	// 1. Sort by gasPrice descending (highest fee first)
	const sorted = [...pendingTxs].sort((a, b) => {
		const priceA = a.effectiveGasPrice ?? a.gasPrice
		const priceB = b.effectiveGasPrice ?? b.gasPrice
		return priceB > priceA ? 1 : priceB < priceA ? -1 : 0
	})

	// 2. Accumulate txs up to gas limit
	let cumulativeGasUsed = 0n
	const includedTxs: PoolTransaction[] = []
	for (const tx of sorted) {
		const txGas = tx.gasUsed ?? tx.gas
		if (cumulativeGasUsed + txGas > parent.gasLimit) continue
		cumulativeGasUsed += txGas
		includedTxs.push(tx)
	}

	// 3. Create block
	const blockHash = `0x${blockNumber.toString(16).padStart(64, "0")}`
	const block: Block = {
		hash: blockHash,
		parentHash: parent.hash,
		number: blockNumber,
		timestamp: BigInt(Math.floor(Date.now() / 1000)),
		gasLimit: parent.gasLimit,
		gasUsed: cumulativeGasUsed,
		baseFeePerGas: parent.baseFeePerGas,
		transactionHashes: includedTxs.map((tx) => tx.hash),
	}

	return { block, includedTxs, cumulativeGasUsed }
}

// ---------------------------------------------------------------------------
// Layer — depends on BlockchainService + TxPoolService
// ---------------------------------------------------------------------------

/** Live layer for MiningService. Requires BlockchainService + TxPoolService. */
export const MiningServiceLive: Layer.Layer<MiningService, never, BlockchainService | TxPoolService> = Layer.effect(
	MiningService,
	Effect.gen(function* () {
		const blockchain = yield* BlockchainService
		const txPool = yield* TxPoolService

		const modeRef = yield* Ref.make<MiningMode>("auto")
		const intervalRef = yield* Ref.make<number>(0)

		return {
			getMode: () => Ref.get(modeRef),

			setAutomine: (enabled) => Ref.set(modeRef, enabled ? "auto" : "manual"),

			setIntervalMining: (intervalMs) =>
				Effect.gen(function* () {
					if (intervalMs > 0) {
						yield* Ref.set(modeRef, "interval")
						yield* Ref.set(intervalRef, intervalMs)
					} else {
						yield* Ref.set(modeRef, "manual")
						yield* Ref.set(intervalRef, 0)
					}
				}),

			getInterval: () => Ref.get(intervalRef),

			mine: (blockCount = 1) =>
				Effect.gen(function* () {
					const blocks: Block[] = []

					for (let i = 0; i < blockCount; i++) {
						const parent = yield* blockchain
							.getHead()
							.pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))

						// Only include pending txs in the first block
						const pendingTxs = i === 0 ? yield* txPool.getPendingTransactions() : []

						const blockNumber = parent.number + 1n
						const { block, includedTxs } = buildBlock(parent, pendingTxs, blockNumber)

						// Store block in blockchain
						yield* blockchain.putBlock(block)

						// Mark included txs as mined + create receipts
						let txIndex = 0
						let cumulativeGas = 0n
						for (const tx of includedTxs) {
							const txGas = tx.gasUsed ?? tx.gas
							cumulativeGas += txGas

							yield* txPool
								.markMined(tx.hash, block.hash, blockNumber, txIndex)
								.pipe(Effect.catchTag("TransactionNotFoundError", (e) => Effect.die(e)))

							const receipt: TransactionReceipt = {
								transactionHash: tx.hash,
								transactionIndex: txIndex,
								blockHash: block.hash,
								blockNumber,
								from: tx.from,
								to: tx.to ?? null,
								cumulativeGasUsed: cumulativeGas,
								gasUsed: txGas,
								contractAddress: null,
								logs: [],
								status: tx.status ?? 1,
								effectiveGasPrice: tx.effectiveGasPrice ?? tx.gasPrice,
								type: tx.type ?? 0,
							}
							yield* txPool.addReceipt(receipt)
							txIndex++
						}

						blocks.push(block)
					}

					return blocks
				}),
		} satisfies MiningServiceApi
	}),
)
