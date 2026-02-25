import { Context, Effect, Layer, Ref } from "effect"
import { type Block, BlockStoreService } from "./block-store.js"
import { type BlockNotFoundError, GenesisError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of the Blockchain service API.
 *
 * TODO: Add event/subscription mechanism (PubSub) for chain events:
 *   - onNewBlock: subscribe to new block additions
 *   - onReorg: subscribe to chain reorganizations
 *   - onNewHead: subscribe to head changes
 * See engineering doc: "BlockchainService (scoped - PubSub)"
 */
export interface BlockchainApi {
	/** Initialize the chain with a genesis block. Fails if already initialized. */
	readonly initGenesis: (genesis: Block) => Effect.Effect<void, GenesisError>
	/** Get the current head block. Fails if chain not initialized. */
	readonly getHead: () => Effect.Effect<Block, GenesisError>
	/** Get a block by hash (delegates to BlockStoreService). */
	readonly getBlock: (hash: string) => Effect.Effect<Block, BlockNotFoundError>
	/** Get a block by canonical number (delegates to BlockStoreService). */
	readonly getBlockByNumber: (blockNumber: bigint) => Effect.Effect<Block, BlockNotFoundError>
	/** Store a new block. Updates head if it extends the longest chain. */
	readonly putBlock: (block: Block) => Effect.Effect<void>
	/** Get the block number of the current head. Fails if chain not initialized. */
	readonly getHeadBlockNumber: () => Effect.Effect<bigint, GenesisError>
	/** Get the latest (head) block. Alias for getHead. Fails if chain not initialized. */
	readonly getLatestBlock: () => Effect.Effect<Block, GenesisError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for BlockchainService. */
export class BlockchainService extends Context.Tag("Blockchain")<BlockchainService, BlockchainApi>() {}

// ---------------------------------------------------------------------------
// Layer — depends on BlockStoreService
// ---------------------------------------------------------------------------

/**
 * Live layer for BlockchainService. Requires BlockStoreService.
 *
 * TODO: Add BlockHeaderValidatorService dependency and validate headers in putBlock
 * when the block ingestion pipeline is implemented (Phase 3+).
 */
export const BlockchainLive: Layer.Layer<BlockchainService, never, BlockStoreService> = Layer.effect(
	BlockchainService,
	Effect.gen(function* () {
		const store = yield* BlockStoreService

		/** Head block reference — null means chain not yet initialized. */
		const headRef = yield* Ref.make<Block | null>(null)

		const getHead = (): Effect.Effect<Block, GenesisError> =>
			Effect.gen(function* () {
				const head = yield* Ref.get(headRef)
				if (head === null) {
					return yield* Effect.fail(
						new GenesisError({ message: "Chain not initialized — genesis block has not been set" }),
					)
				}
				return head
			})

		return {
			initGenesis: (genesis) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(headRef)
					if (current !== null) {
						return yield* Effect.fail(new GenesisError({ message: "Genesis block already initialized" }))
					}
					yield* store.putBlock(genesis)
					yield* store.setCanonical(genesis.number, genesis.hash)
					yield* Ref.set(headRef, genesis)
				}),

			getHead,

			getBlock: (hash) => store.getBlock(hash),

			getBlockByNumber: (blockNumber) => store.getBlockByNumber(blockNumber),

			putBlock: (block) =>
				Effect.gen(function* () {
					yield* store.putBlock(block)

					const head = yield* Ref.get(headRef)
					// Fork choice: longest chain rule — update head if new block has higher number
					// TODO: In a reorg scenario this only updates the canonical mapping for the new
					// block's height. Intermediate blocks on the winning fork are not re-mapped,
					// so getBlockByNumber for those heights returns stale data. Acceptable for
					// Phase 2 linear chain — full reorg support needed in Phase 3.
					if (head === null || block.number > head.number) {
						yield* store.setCanonical(block.number, block.hash)
						yield* Ref.set(headRef, block)
					}
				}),

			getHeadBlockNumber: () =>
				Effect.gen(function* () {
					const head = yield* getHead()
					return head.number
				}),

			getLatestBlock: () => getHead(),
		} satisfies BlockchainApi
	}),
)
