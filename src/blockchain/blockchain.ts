import { Context, Effect, Layer, Ref } from "effect"
import { type Block, BlockStoreService } from "./block-store.js"
import { type BlockNotFoundError, GenesisError } from "./errors.js"
import { BlockHeaderValidatorService } from "./header-validator.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the Blockchain service API. */
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
// Layer — depends on BlockStoreService + BlockHeaderValidatorService
// ---------------------------------------------------------------------------

/** Live layer for BlockchainService. Requires BlockStoreService and BlockHeaderValidatorService. */
export const BlockchainLive: Layer.Layer<BlockchainService, never, BlockStoreService | BlockHeaderValidatorService> =
	Layer.effect(
		BlockchainService,
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			// Ensure validator is available in the dependency graph
			void (yield* BlockHeaderValidatorService)

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
