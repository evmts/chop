/**
 * Pure Effect functions that query TevmNodeShape for settings view data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the settings view should never fail.
 */

import { Effect, Ref } from "effect"
import type { MiningMode, TevmNodeShape } from "../../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Aggregated data for the settings view. */
export interface SettingsViewData {
	/** Current chain ID. */
	readonly chainId: bigint
	/** Hardfork name. */
	readonly hardfork: string
	/** Current mining mode. */
	readonly miningMode: MiningMode
	/** Mining interval in ms (0 if not interval mode). */
	readonly miningInterval: number
	/** Effective block gas limit. */
	readonly blockGasLimit: bigint
	/** Current base fee per gas (from head block). */
	readonly baseFee: bigint
	/** Minimum gas price. */
	readonly minGasPrice: bigint
	/** Fork URL (upstream RPC URL, undefined in local mode). */
	readonly forkUrl: string | undefined
	/** Fork block number (undefined in local mode). */
	readonly forkBlock: bigint | undefined
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/** Fetch all settings from the node. */
export const getSettingsData = (node: TevmNodeShape): Effect.Effect<SettingsViewData> =>
	Effect.gen(function* () {
		// Read mining state
		const miningMode = yield* node.mining.getMode()
		const miningInterval = yield* node.mining.getInterval()

		// Read NodeConfig refs
		const chainId = yield* Ref.get(node.nodeConfig.chainId)
		const rpcUrl = yield* Ref.get(node.nodeConfig.rpcUrl)
		const blockGasLimitOverride = yield* Ref.get(node.nodeConfig.blockGasLimit)
		const minGasPrice = yield* Ref.get(node.nodeConfig.minGasPrice)

		// Read head block for effective gas limit and base fee
		const headBlock = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", () => Effect.succeed(null)))

		const effectiveGasLimit = blockGasLimitOverride ?? headBlock?.gasLimit ?? 30_000_000n
		const baseFee = headBlock?.baseFeePerGas ?? 1_000_000_000n

		// Read hardfork from release spec
		const hardfork = node.releaseSpec.hardfork

		// Fork block: genesis block number > 0 means fork mode
		const genesisBlock = yield* node.blockchain.getBlockByNumber(0n).pipe(Effect.catchAll(() => Effect.succeed(null)))
		const forkBlock =
			rpcUrl !== undefined && genesisBlock !== null && genesisBlock.number > 0n ? genesisBlock.number : undefined

		return {
			chainId,
			hardfork,
			miningMode,
			miningInterval,
			blockGasLimit: effectiveGasLimit,
			baseFee,
			minGasPrice,
			forkUrl: rpcUrl,
			forkBlock,
		}
	}).pipe(
		Effect.catchAll(() =>
			Effect.succeed({
				chainId: 31337n,
				hardfork: "prague",
				miningMode: "auto" as MiningMode,
				miningInterval: 0,
				blockGasLimit: 30_000_000n,
				baseFee: 1_000_000_000n,
				minGasPrice: 0n,
				forkUrl: undefined,
				forkBlock: undefined,
			}),
		),
	)

// ---------------------------------------------------------------------------
// Settings mutations
// ---------------------------------------------------------------------------

/**
 * Cycle the mining mode: auto → manual → interval → auto.
 *
 * When switching to interval, uses a default of 2000ms.
 */
export const cycleMiningMode = (node: TevmNodeShape): Effect.Effect<MiningMode> =>
	Effect.gen(function* () {
		const current = yield* node.mining.getMode()
		switch (current) {
			case "auto": {
				yield* node.mining.setAutomine(false)
				return "manual" as MiningMode
			}
			case "manual": {
				yield* node.mining.setIntervalMining(2000)
				return "interval" as MiningMode
			}
			case "interval": {
				yield* node.mining.setAutomine(true)
				return "auto" as MiningMode
			}
		}
	})

/**
 * Set the block gas limit override.
 *
 * @param node - The TevmNode facade.
 * @param limit - New gas limit value.
 */
export const setBlockGasLimit = (node: TevmNodeShape, limit: bigint): Effect.Effect<void> =>
	Ref.set(node.nodeConfig.blockGasLimit, limit)
