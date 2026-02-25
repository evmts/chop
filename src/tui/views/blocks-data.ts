/**
 * Pure Effect functions that query TevmNodeShape for blocks view data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the blocks view should never fail.
 */

import { Effect } from "effect"
import type { Block } from "../../blockchain/block-store.js"
import type { TevmNodeShape } from "../../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detail for a single block. */
export interface BlockDetail {
	/** Block hash. */
	readonly hash: string
	/** Parent block hash. */
	readonly parentHash: string
	/** Block number. */
	readonly number: bigint
	/** Unix timestamp. */
	readonly timestamp: bigint
	/** Gas limit for this block. */
	readonly gasLimit: bigint
	/** Actual gas used. */
	readonly gasUsed: bigint
	/** EIP-1559 base fee per gas. */
	readonly baseFeePerGas: bigint
	/** Transaction hashes included in this block (always an array, never undefined). */
	readonly transactionHashes: readonly string[]
}

/** Aggregated data for the blocks view. */
export interface BlocksViewData {
	/** All blocks in reverse chronological order. */
	readonly blocks: readonly BlockDetail[]
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/** Fetch all blocks from genesis to head in reverse chronological order. */
export const getBlocksData = (node: TevmNodeShape): Effect.Effect<BlocksViewData> =>
	Effect.gen(function* () {
		const headBlockNumber = yield* node.blockchain
			.getHeadBlockNumber()
			.pipe(Effect.catchTag("GenesisError", () => Effect.succeed(0n)))

		const blocks: BlockDetail[] = []

		for (let n = headBlockNumber; n >= 0n; n--) {
			const block = yield* node.blockchain
				.getBlockByNumber(n)
				.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
			if (block === null) break

			blocks.push({
				hash: block.hash,
				parentHash: block.parentHash,
				number: block.number,
				timestamp: block.timestamp,
				gasLimit: block.gasLimit,
				gasUsed: block.gasUsed,
				baseFeePerGas: block.baseFeePerGas,
				transactionHashes: block.transactionHashes ?? [],
			})
		}

		return { blocks }
	}).pipe(Effect.catchAll(() => Effect.succeed({ blocks: [] as readonly BlockDetail[] })))

// ---------------------------------------------------------------------------
// Block actions
// ---------------------------------------------------------------------------

/**
 * Mine a single block. Returns the mined blocks array.
 *
 * @param node - The TevmNode facade.
 */
export const mineBlock = (node: TevmNodeShape): Effect.Effect<readonly Block[]> => node.mining.mine(1)
