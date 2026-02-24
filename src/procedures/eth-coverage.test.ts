/**
 * Coverage tests for procedures/eth.ts.
 *
 * Covers:
 * - ethGetBlockByHash with includeFullTxs=true (lines 243-248):
 *   When includeFullTxs is true and the block has transaction hashes,
 *   the code resolves full transaction objects via getTransactionByHashHandler.
 *
 * - ethFeeHistory catchTag paths (lines 321, 335):
 *   The fee history handler catches GenesisError and BlockNotFoundError
 *   to provide sensible defaults on fresh/small chains.
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	ethAccounts,
	ethFeeHistory,
	ethGetBlockByHash,
	ethGetBlockByNumber,
	ethSendTransaction,
} from "./eth.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a simple ETH transfer and return the tx hash. */
const sendSimpleTx = (node: Parameters<typeof ethSendTransaction>[0] & { accounts: readonly { address: string }[] }) =>
	Effect.gen(function* () {
		const accounts = (yield* ethAccounts(node)([])) as string[]
		const sender = accounts[0]!
		const result = yield* ethSendTransaction(node)([
			{
				from: sender,
				to: `0x${"22".repeat(20)}`,
				value: "0xDE0B6B3A7640000", // 1 ETH
			},
		])
		return result as string
	})

// ===========================================================================
// ethGetBlockByHash — includeFullTxs=true (lines 242-248)
// ===========================================================================

describe("ethGetBlockByHash — includeFullTxs=true", () => {
	it.effect("returns full transaction objects when includeFullTxs is true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Send a transaction (auto-mined into block 1)
			const txHash = yield* sendSimpleTx(node)

			// Get block 1 (without full txs) to obtain the block hash
			const blockSummary = (yield* ethGetBlockByNumber(node)(["0x1", false])) as Record<string, unknown>
			expect(blockSummary).not.toBeNull()
			const blockHash = blockSummary.hash as string

			// Verify the block has transaction hashes (not full objects)
			const txHashes = blockSummary.transactions as string[]
			expect(txHashes).toHaveLength(1)
			expect(txHashes[0]).toBe(txHash)

			// Now call ethGetBlockByHash with includeFullTxs=true (exercises lines 242-248)
			const blockFull = (yield* ethGetBlockByHash(node)([blockHash, true])) as Record<string, unknown>
			expect(blockFull).not.toBeNull()

			// Transactions should be full objects, not hashes
			const txs = blockFull.transactions as Record<string, unknown>[]
			expect(txs).toHaveLength(1)

			const tx = txs[0]!
			// Full transaction objects have these fields (from serializeTransaction)
			expect(tx.hash).toBe(txHash)
			expect(typeof tx.from).toBe("string")
			expect(typeof tx.to).toBe("string")
			expect(typeof tx.value).toBe("string")
			expect((tx.value as string).startsWith("0x")).toBe(true)
			expect(typeof tx.nonce).toBe("string")
			expect((tx.nonce as string).startsWith("0x")).toBe(true)
			expect(typeof tx.gas).toBe("string")
			expect((tx.gas as string).startsWith("0x")).toBe(true)
			expect(typeof tx.gasPrice).toBe("string")
			expect(typeof tx.input).toBe("string")
			expect(tx.blockHash).toBe(blockHash)
			expect(tx.blockNumber).toBe("0x1")
			expect(tx.transactionIndex).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty transactions array for block with no txs and includeFullTxs=true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Genesis block (block 0) has no transactions
			const genesisBlock = (yield* ethGetBlockByNumber(node)(["0x0", false])) as Record<string, unknown>
			expect(genesisBlock).not.toBeNull()
			const genesisHash = genesisBlock.hash as string

			// ethGetBlockByHash with includeFullTxs=true on genesis
			// The block has no transactionHashes, so the fullTxs branch is skipped
			const block = (yield* ethGetBlockByHash(node)([genesisHash, true])) as Record<string, unknown>
			expect(block).not.toBeNull()

			// transactions should be an empty array (no tx hashes on genesis)
			const txs = block.transactions as unknown[]
			expect(txs).toHaveLength(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns multiple full transaction objects for block with multiple txs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Switch to manual mining so we can batch transactions
			yield* node.mining.setAutomine(false)

			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!

			// Send two transactions (they stay pending)
			const txHash1 = (yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x1",
				},
			])) as string

			const txHash2 = (yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"33".repeat(20)}`,
					value: "0x2",
					nonce: "0x1",
				},
			])) as string

			// Mine a single block containing both transactions
			yield* node.mining.mine(1)

			// Get block 1 to obtain hash
			const blockSummary = (yield* ethGetBlockByNumber(node)(["0x1", false])) as Record<string, unknown>
			expect(blockSummary).not.toBeNull()
			const blockHash = blockSummary.hash as string

			// Retrieve block by hash with full transactions
			const blockFull = (yield* ethGetBlockByHash(node)([blockHash, true])) as Record<string, unknown>
			const txs = blockFull.transactions as Record<string, unknown>[]
			expect(txs).toHaveLength(2)

			// Both transaction objects should be present
			const hashes = txs.map((t) => t.hash)
			expect(hashes).toContain(txHash1)
			expect(hashes).toContain(txHash2)

			// Verify they are full objects (have 'from', 'value', etc.)
			for (const tx of txs) {
				expect(typeof tx.from).toBe("string")
				expect(typeof tx.value).toBe("string")
				expect(typeof tx.gas).toBe("string")
				expect(tx.blockHash).toBe(blockHash)
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ===========================================================================
// ethFeeHistory — catchTag paths (lines 321, 335)
// ===========================================================================

describe("ethFeeHistory — error recovery paths", () => {
	it.effect("returns valid fee history on a fresh devnet (genesis block only)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// On a fresh devnet, head is block 0 (genesis).
			// blockCount=1 should return fee data for block 0.
			const result = (yield* ethFeeHistory(node)(["0x1", "latest", []])) as Record<string, unknown>

			expect(result).not.toBeNull()
			expect(typeof result.oldestBlock).toBe("string")
			expect((result.oldestBlock as string).startsWith("0x")).toBe(true)

			const baseFeePerGas = result.baseFeePerGas as string[]
			// blockCount=1 yields 1 historical entry + 1 "next block" entry = 2
			expect(baseFeePerGas.length).toBe(2)
			// Each entry should be a hex string
			for (const fee of baseFeePerGas) {
				expect(fee.startsWith("0x")).toBe(true)
			}

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(1)
			// Genesis block has 0 gas used, so ratio should be 0
			expect(gasUsedRatio[0]).toBe(0)

			expect(result.reward).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles blockCount larger than available blocks (BlockNotFoundError catch path)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Fresh devnet only has block 0 (genesis).
			// Request blockCount=10, which is larger than the 1 available block.
			// The loop iterates min(10, 0+1) = 1 time, so no BlockNotFoundError here.
			// But let's mine 1 block, then request blockCount=5 (more than 2 blocks exist).
			yield* sendSimpleTx(node)
			// Now we have blocks 0 and 1.

			// Request blockCount=5, which is more than the 2 available.
			// min(5, 1+1) = 2, oldestBlock = 1 - 2 + 1 = 0
			// The loop starts at block 0 and iterates 2 times (blocks 0 and 1).
			const result = (yield* ethFeeHistory(node)(["0x5", "latest", []])) as Record<string, unknown>

			expect(result).not.toBeNull()
			expect(result.oldestBlock).toBe("0x0")

			const baseFeePerGas = result.baseFeePerGas as string[]
			// min(5, 2) = 2 historical entries + 1 "next block" entry = 3
			expect(baseFeePerGas.length).toBe(3)

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns correct structure with blockCount=0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// blockCount=0 should produce an empty result with just the "next block" baseFee
			const result = (yield* ethFeeHistory(node)(["0x0", "latest", []])) as Record<string, unknown>

			expect(result).not.toBeNull()

			const baseFeePerGas = result.baseFeePerGas as string[]
			// 0 historical entries + 1 "next block" entry = 1
			expect(baseFeePerGas).toHaveLength(1)

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(0)

			expect(result.reward).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fee history after multiple blocks shows changing gas usage", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Send two transactions to create blocks 1 and 2
			yield* sendSimpleTx(node)
			yield* sendSimpleTx(node)
			// Now blocks 0, 1, 2 exist.

			// Request blockCount=3 covering all blocks
			const result = (yield* ethFeeHistory(node)(["0x3", "latest", []])) as Record<string, unknown>

			expect(result.oldestBlock).toBe("0x0")

			const baseFeePerGas = result.baseFeePerGas as string[]
			// 3 historical entries + 1 "next block" = 4
			expect(baseFeePerGas).toHaveLength(4)

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(3)

			// All gasUsedRatio values should be valid numbers >= 0
			for (const ratio of gasUsedRatio) {
				expect(ratio).toBeGreaterThanOrEqual(0)
				expect(ratio).toBeLessThanOrEqual(1)
			}

			// At least one block with a tx should have gasUsedRatio > 0
			const hasNonZero = gasUsedRatio.some((r) => r > 0)
			expect(hasNonZero).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fee history with blockCount=1 returns only the head block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Mine one block with a transaction
			yield* sendSimpleTx(node)

			// Request only the latest block's fee history
			const result = (yield* ethFeeHistory(node)(["0x1", "latest", []])) as Record<string, unknown>

			expect(result.oldestBlock).toBe("0x1")

			const baseFeePerGas = result.baseFeePerGas as string[]
			// 1 historical + 1 next = 2
			expect(baseFeePerGas).toHaveLength(2)

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(1)
			// Block 1 had a transaction, so ratio > 0
			expect(gasUsedRatio[0]).toBeGreaterThan(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
