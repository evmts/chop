/**
 * Pure Effect functions that query TevmNodeShape for dashboard display data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the dashboard should never fail.
 */

import { Effect } from "effect"
import type { TevmNodeShape } from "../../node/index.js"
import { hexToBytes } from "../../evm/conversions.js"
import { VERSION } from "../../cli/version.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Client version string shown in the dashboard Chain Info panel. */
const CLIENT_VERSION = `chop/${VERSION}`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainInfoData {
	readonly chainId: bigint
	readonly blockNumber: bigint
	readonly gasPrice: bigint
	readonly baseFee: bigint
	readonly clientVersion: string
	readonly miningMode: string
}

export interface RecentBlockData {
	readonly number: bigint
	readonly txCount: number
	readonly gasUsed: bigint
	readonly timestamp: bigint
}

export interface RecentTxData {
	readonly hash: string
	readonly from: string
	readonly to: string | null
	readonly value: bigint
}

export interface AccountData {
	readonly address: string
	readonly balance: bigint
}

export interface DashboardData {
	readonly chainInfo: ChainInfoData
	readonly recentBlocks: readonly RecentBlockData[]
	readonly recentTxs: readonly RecentTxData[]
	readonly accounts: readonly AccountData[]
}

// ---------------------------------------------------------------------------
// Data fetching functions
// ---------------------------------------------------------------------------

/** Fetch chain info from the node. */
export const getChainInfo = (node: TevmNodeShape): Effect.Effect<ChainInfoData> =>
	Effect.gen(function* () {
		const head = yield* node.blockchain.getHead().pipe(
			Effect.catchTag("GenesisError", () =>
				Effect.succeed({
					number: 0n,
					baseFeePerGas: 0n,
					gasLimit: 0n,
				}),
			),
		)
		const miningMode = yield* node.mining.getMode()

		return {
			chainId: node.chainId,
			blockNumber: head.number,
			gasPrice: head.baseFeePerGas,
			baseFee: head.baseFeePerGas,
			clientVersion: CLIENT_VERSION,
			miningMode,
		}
	}).pipe(Effect.catchAll(() => Effect.succeed({
		chainId: 0n,
		blockNumber: 0n,
		gasPrice: 0n,
		baseFee: 0n,
		clientVersion: CLIENT_VERSION,
		miningMode: "unknown",
	})))

/** Fetch the most recent blocks (newest first). */
export const getRecentBlocks = (node: TevmNodeShape, count = 5): Effect.Effect<readonly RecentBlockData[]> =>
	Effect.gen(function* () {
		const headBlockNumber = yield* node.blockchain.getHeadBlockNumber().pipe(
			Effect.catchTag("GenesisError", () => Effect.succeed(0n)),
		)

		const blocks: RecentBlockData[] = []
		const start = headBlockNumber
		const end = start - BigInt(count) + 1n < 0n ? 0n : start - BigInt(count) + 1n

		for (let n = start; n >= end; n--) {
			const block = yield* node.blockchain.getBlockByNumber(n).pipe(
				Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)),
			)
			if (block === null) break

			blocks.push({
				number: block.number,
				txCount: block.transactionHashes?.length ?? 0,
				gasUsed: block.gasUsed,
				timestamp: block.timestamp,
			})
		}

		return blocks
	}).pipe(Effect.catchAll(() => Effect.succeed([] as readonly RecentBlockData[])))

/** Fetch recent transactions from recent blocks. */
export const getRecentTransactions = (node: TevmNodeShape, count = 10): Effect.Effect<readonly RecentTxData[]> =>
	Effect.gen(function* () {
		const headBlockNumber = yield* node.blockchain.getHeadBlockNumber().pipe(
			Effect.catchTag("GenesisError", () => Effect.succeed(0n)),
		)

		const txs: RecentTxData[] = []
		// Track seen tx hashes to deduplicate (block store hash collisions can cause
		// the same block to appear at multiple canonical numbers).
		const seen = new Set<string>()

		// Walk backwards through blocks to find transactions
		for (let n = headBlockNumber; n >= 0n && txs.length < count; n--) {
			const block = yield* node.blockchain.getBlockByNumber(n).pipe(
				Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)),
			)
			if (block === null) break

			const hashes = block.transactionHashes ?? []
			for (const hash of hashes) {
				if (txs.length >= count) break
				if (seen.has(hash)) continue
				seen.add(hash)

				const tx = yield* node.txPool.getTransaction(hash).pipe(
					Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)),
				)
				if (tx === null) continue

				txs.push({
					hash: tx.hash,
					from: tx.from,
					to: tx.to ?? null,
					value: tx.value,
				})
			}
		}

		return txs
	}).pipe(Effect.catchAll(() => Effect.succeed([] as readonly RecentTxData[])))

/** Fetch account summaries (balances) for all test accounts. */
export const getAccountSummaries = (node: TevmNodeShape): Effect.Effect<readonly AccountData[]> =>
	Effect.gen(function* () {
		const accounts: AccountData[] = []

		for (const testAccount of node.accounts) {
			const addrBytes = hexToBytes(testAccount.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			accounts.push({
				address: testAccount.address,
				balance: account.balance,
			})
		}

		return accounts
	}).pipe(Effect.catchAll(() => Effect.succeed([] as readonly AccountData[])))

/** Fetch all dashboard data sections in parallel. */
export const getDashboardData = (node: TevmNodeShape): Effect.Effect<DashboardData> =>
	Effect.all({
		chainInfo: getChainInfo(node),
		recentBlocks: getRecentBlocks(node),
		recentTxs: getRecentTransactions(node),
		accounts: getAccountSummaries(node),
	}, { concurrency: "unbounded" })
