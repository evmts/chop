/**
 * Coverage-gap tests for handler branches that are hard to reach with a
 * fully-wired TevmNode.
 *
 * Covers:
 * - getLogs.ts line 126: receipt is null after catching TransactionNotFoundError
 *   (block has a txHash but the receipt for it is missing).
 * - traceBlock.ts line 50: TransactionNotFoundError catch branch in
 *   traceBlockTransactions (block references a tx hash that doesn't exist
 *   in the pool).
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { Block } from "../blockchain/block-store.js"
import type { BlockchainApi } from "../blockchain/blockchain.js"
import { BlockNotFoundError } from "../blockchain/errors.js"
import type { TevmNodeShape } from "../node/index.js"
import { TransactionNotFoundError } from "./errors.js"
import { getLogsHandler } from "./getLogs.js"
import { traceBlockByNumberHandler } from "./traceBlock.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_HASH = `0x${"00".repeat(32)}`

const makeBlock = (overrides: Partial<Block> = {}): Block => ({
	hash: `0x${"00".repeat(31)}01`,
	parentHash: ZERO_HASH,
	number: 0n,
	timestamp: 0n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
	...overrides,
})

// ---------------------------------------------------------------------------
// Test 1 — getLogs: receipt null after TransactionNotFoundError (line 126)
// ---------------------------------------------------------------------------

describe("getLogsHandler — receipt not found for tx in block (line 126)", () => {
	/**
	 * Scenario: block 0 has transactionHashes: ["0xdeadbeef"], but the
	 * txPool has no receipt for that hash.  getLogsHandler should catch the
	 * TransactionNotFoundError, get null, and skip that tx — returning an
	 * empty logs array.
	 */
	it.effect("returns empty array when receipt is missing for a transaction in the block", () =>
		Effect.gen(function* () {
			const blockWithTx = makeBlock({
				transactionHashes: ["0xdeadbeef"],
			})

			const blockchain: BlockchainApi = {
				initGenesis: () => Effect.void,
				getHead: () => Effect.succeed(blockWithTx),
				getBlock: (hash) => Effect.fail(new BlockNotFoundError({ identifier: hash })),
				getBlockByNumber: (num) =>
					num === 0n ? Effect.succeed(blockWithTx) : Effect.fail(new BlockNotFoundError({ identifier: String(num) })),
				putBlock: () => Effect.void,
				getHeadBlockNumber: () => Effect.succeed(0n),
				getLatestBlock: () => Effect.succeed(blockWithTx),
			}

			const node = {
				blockchain,
				txPool: {
					addTransaction: () => Effect.void,
					getTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					addReceipt: () => Effect.void,
					getReceipt: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					getPendingHashes: () => Effect.succeed([]),
					getPendingTransactions: () => Effect.succeed([]),
					markMined: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropAllTransactions: () => Effect.void,
				},
			} as unknown as TevmNodeShape

			const logs = yield* getLogsHandler(node)({ fromBlock: "0x0", toBlock: "0x0" })
			expect(logs).toEqual([])
		}),
	)

	/**
	 * Same scenario but with multiple transaction hashes in the block,
	 * all missing receipts.  Every iteration hits the `if (!receipt) continue`
	 * branch.
	 */
	it.effect("skips all transactions when every receipt is missing", () =>
		Effect.gen(function* () {
			const blockWithTxs = makeBlock({
				transactionHashes: ["0xaaa", "0xbbb", "0xccc"],
			})

			const blockchain: BlockchainApi = {
				initGenesis: () => Effect.void,
				getHead: () => Effect.succeed(blockWithTxs),
				getBlock: (hash) => Effect.fail(new BlockNotFoundError({ identifier: hash })),
				getBlockByNumber: (num) =>
					num === 0n ? Effect.succeed(blockWithTxs) : Effect.fail(new BlockNotFoundError({ identifier: String(num) })),
				putBlock: () => Effect.void,
				getHeadBlockNumber: () => Effect.succeed(0n),
				getLatestBlock: () => Effect.succeed(blockWithTxs),
			}

			const node = {
				blockchain,
				txPool: {
					addTransaction: () => Effect.void,
					getTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					addReceipt: () => Effect.void,
					getReceipt: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					getPendingHashes: () => Effect.succeed([]),
					getPendingTransactions: () => Effect.succeed([]),
					markMined: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropAllTransactions: () => Effect.void,
				},
			} as unknown as TevmNodeShape

			const logs = yield* getLogsHandler(node)({ fromBlock: "0x0", toBlock: "0x0" })
			expect(logs).toEqual([])
		}),
	)
})

// ---------------------------------------------------------------------------
// Test 2 — traceBlock: TransactionNotFoundError catch branch (line 50)
// ---------------------------------------------------------------------------

describe("traceBlockByNumberHandler — TransactionNotFoundError catch (line 50)", () => {
	/**
	 * Scenario: block 0 has transactionHashes: ["0xdeadbeef"], but the
	 * txPool has no transaction for that hash.  traceTransactionHandler
	 * calls txPool.getTransaction(hash) which fails with
	 * TransactionNotFoundError.  traceBlockTransactions catches it and
	 * re-throws as HandlerError with "not found in pool".
	 */
	it.effect("fails with HandlerError when tx referenced by block does not exist in pool", () =>
		Effect.gen(function* () {
			const blockWithTx = makeBlock({
				transactionHashes: ["0xdeadbeef"],
			})

			const blockchain: BlockchainApi = {
				initGenesis: () => Effect.void,
				getHead: () => Effect.succeed(blockWithTx),
				getBlock: (hash) => Effect.fail(new BlockNotFoundError({ identifier: hash })),
				getBlockByNumber: (num) =>
					num === 0n ? Effect.succeed(blockWithTx) : Effect.fail(new BlockNotFoundError({ identifier: String(num) })),
				putBlock: () => Effect.void,
				getHeadBlockNumber: () => Effect.succeed(0n),
				getLatestBlock: () => Effect.succeed(blockWithTx),
			}

			const node = {
				blockchain,
				txPool: {
					addTransaction: () => Effect.void,
					getTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					addReceipt: () => Effect.void,
					getReceipt: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					getPendingHashes: () => Effect.succeed([]),
					getPendingTransactions: () => Effect.succeed([]),
					markMined: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
					dropAllTransactions: () => Effect.void,
				},
			} as unknown as TevmNodeShape

			const result = yield* traceBlockByNumberHandler(node)({ blockNumber: 0n }).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)

			expect(result).toContain("not found in pool")
			expect(result).toContain("0xdeadbeef")
		}),
	)
})
