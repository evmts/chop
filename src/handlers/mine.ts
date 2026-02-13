// Mining handlers — business logic for mining, auto-mine, and interval mining.

import { Effect } from "effect"
import type { Block } from "../blockchain/block-store.js"
import type { TevmNodeShape } from "../node/index.js"
import type { BlockBuildOptions } from "../node/mining.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for mineHandler. */
export interface MineParams {
	/** Number of blocks to mine. Defaults to 1. */
	readonly blockCount?: number
	/** Options for overriding block properties from nodeConfig. */
	readonly options?: BlockBuildOptions
}

/** Result of a mine operation. */
export type MineResult = readonly Block[]

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handler for anvil_mine / evm_mine.
 * Mines one or more blocks using the MiningService.
 */
export const mineHandler =
	(node: TevmNodeShape) =>
	(params: MineParams = {}): Effect.Effect<MineResult> =>
		node.mining.mine(params.blockCount ?? 1, params.options)

/**
 * Handler for evm_setAutomine.
 * Enables or disables auto-mine mode.
 */
export const setAutomineHandler =
	(node: TevmNodeShape) =>
	(enabled: boolean): Effect.Effect<void> =>
		node.mining.setAutomine(enabled)

/**
 * Handler for evm_setIntervalMining.
 * Sets the interval (in ms) for automatic mining.
 * 0 disables interval mining (switches to manual).
 */
export const setIntervalMiningHandler =
	(node: TevmNodeShape) =>
	(intervalMs: number): Effect.Effect<void> =>
		node.mining.setIntervalMining(intervalMs)
