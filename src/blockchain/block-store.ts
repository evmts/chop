import { Context, Effect, Layer } from "effect"
import { BlockNotFoundError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal block representation for storage. */
export interface Block {
	readonly hash: string
	readonly parentHash: string
	readonly number: bigint
	readonly timestamp: bigint
	readonly gasLimit: bigint
	readonly gasUsed: bigint
	readonly baseFeePerGas: bigint
}

/** Shape of the BlockStore service API. */
export interface BlockStoreApi {
	/** Store a block by its hash. Overwrites if hash already present. */
	readonly putBlock: (block: Block) => Effect.Effect<void>
	/** Retrieve a block by hash. Fails with BlockNotFoundError if not present. */
	readonly getBlock: (hash: string) => Effect.Effect<Block, BlockNotFoundError>
	/** Check if a block exists in the store. */
	readonly hasBlock: (hash: string) => Effect.Effect<boolean>
	/** Remove a block from the store by hash. No-op if not present. */
	readonly deleteBlock: (hash: string) => Effect.Effect<void>
	/** Map a block number to its canonical hash. */
	readonly setCanonical: (blockNumber: bigint, hash: string) => Effect.Effect<void>
	/** Get the canonical hash for a block number. Fails with BlockNotFoundError if not mapped. */
	readonly getCanonical: (blockNumber: bigint) => Effect.Effect<string, BlockNotFoundError>
	/** Get a block by its canonical number (looks up canonical hash, then block). */
	readonly getBlockByNumber: (blockNumber: bigint) => Effect.Effect<Block, BlockNotFoundError>
	/** Mark a block hash as an orphan. */
	readonly addOrphan: (hash: string) => Effect.Effect<void>
	/** Remove a block hash from the orphan set. No-op if not an orphan. */
	readonly removeOrphan: (hash: string) => Effect.Effect<void>
	/** Get all orphan block hashes. */
	readonly getOrphans: () => Effect.Effect<ReadonlyArray<string>>
	/** Check if a block hash is marked as an orphan. */
	readonly isOrphan: (hash: string) => Effect.Effect<boolean>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for BlockStoreService. */
export class BlockStoreService extends Context.Tag("BlockStore")<BlockStoreService, BlockStoreApi>() {}

// ---------------------------------------------------------------------------
// Layer — factory function for test isolation
// ---------------------------------------------------------------------------

/** Create a fresh BlockStoreService layer with in-memory storage. */
export const BlockStoreLive = (): Layer.Layer<BlockStoreService> =>
	Layer.sync(BlockStoreService, () => {
		/** Blocks stored by hash. */
		const blocks = new Map<string, Block>()
		/** Canonical chain index: block number → hash. */
		const canonicalIndex = new Map<bigint, string>()
		/** Set of orphan block hashes. */
		const orphans = new Set<string>()

		const getBlock: BlockStoreApi["getBlock"] = (hash) =>
			Effect.sync(() => blocks.get(hash)).pipe(
				Effect.flatMap((block) =>
					block !== undefined ? Effect.succeed(block) : Effect.fail(new BlockNotFoundError({ identifier: hash })),
				),
			)

		const getCanonical: BlockStoreApi["getCanonical"] = (blockNumber) =>
			Effect.sync(() => canonicalIndex.get(blockNumber)).pipe(
				Effect.flatMap((hash) =>
					hash !== undefined
						? Effect.succeed(hash)
						: Effect.fail(new BlockNotFoundError({ identifier: String(blockNumber) })),
				),
			)

		return {
			putBlock: (block) =>
				Effect.sync(() => {
					blocks.set(block.hash, block)
				}),

			getBlock,

			hasBlock: (hash) => Effect.sync(() => blocks.has(hash)),

			deleteBlock: (hash) =>
				Effect.sync(() => {
					blocks.delete(hash)
				}),

			setCanonical: (blockNumber, hash) =>
				Effect.sync(() => {
					canonicalIndex.set(blockNumber, hash)
				}),

			getCanonical,

			getBlockByNumber: (blockNumber) => getCanonical(blockNumber).pipe(Effect.flatMap(getBlock)),

			addOrphan: (hash) =>
				Effect.sync(() => {
					orphans.add(hash)
				}),

			removeOrphan: (hash) =>
				Effect.sync(() => {
					orphans.delete(hash)
				}),

			getOrphans: () => Effect.sync(() => Array.from(orphans)),

			isOrphan: (hash) => Effect.sync(() => orphans.has(hash)),
		} satisfies BlockStoreApi
	})
