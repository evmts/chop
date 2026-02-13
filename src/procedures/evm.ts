// EVM-specific JSON-RPC procedures (evm_* methods).

import { Effect, Ref } from "effect"
import { mineHandler, setAutomineHandler, setIntervalMiningHandler } from "../handlers/mine.js"
import { revertHandler, snapshotHandler } from "../handlers/snapshot.js"
import type { TevmNodeShape } from "../node/index.js"
import { wrapErrors } from "./errors.js"
import { type Procedure, bigintToHex } from "./eth.js"

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/**
 * evm_mine → mine one block.
 * Reads nodeConfig overrides and passes them to the mining service.
 * Params: [timestamp?]
 * Returns: "0x0" on success (matches Anvil).
 */
export const evmMine =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				// Read nodeConfig overrides
				const baseFeePerGas = yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)
				const gasLimit = yield* Ref.get(node.nodeConfig.blockGasLimit)
				const nextBlockTimestamp = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
				const timeOffset = yield* Ref.get(node.nodeConfig.timeOffset)
				const blockTimestampInterval = yield* Ref.get(node.nodeConfig.blockTimestampInterval)

				yield* mineHandler(node)({
					blockCount: 1,
					options: {
						...(baseFeePerGas !== undefined ? { baseFeePerGas } : {}),
						...(gasLimit !== undefined ? { gasLimit } : {}),
						...(nextBlockTimestamp !== undefined ? { nextBlockTimestamp } : {}),
						...(timeOffset !== 0n ? { timeOffset } : {}),
						...(blockTimestampInterval !== undefined ? { blockTimestampInterval } : {}),
					},
				})

				// Consume one-shot overrides
				if (baseFeePerGas !== undefined) {
					yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, undefined)
				}
				if (nextBlockTimestamp !== undefined) {
					yield* Ref.set(node.nodeConfig.nextBlockTimestamp, undefined)
				}

				return "0x0"
			}),
		)

/**
 * evm_setAutomine → toggle auto-mine mode.
 * Params: [enabled: boolean]
 * Returns: true on success.
 */
export const evmSetAutomine =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const enabled = Boolean(params[0])
				yield* setAutomineHandler(node)(enabled)
				return "true"
			}),
		)

/**
 * evm_setIntervalMining → set interval mining.
 * Params: [intervalMs: number]
 * Returns: true on success.
 */
export const evmSetIntervalMining =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const intervalMs = Number(params[0])
				yield* setIntervalMiningHandler(node)(intervalMs)
				return "true"
			}),
		)

/**
 * evm_snapshot → take a snapshot of the current state.
 * Params: [] (none)
 * Returns: hex snapshot ID (e.g. "0x1").
 */
export const evmSnapshot =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const id = yield* snapshotHandler(node)()
				return bigintToHex(BigInt(id))
			}),
		)

/**
 * evm_revert → revert state to a previous snapshot.
 * Params: [snapshotId: hex string]
 * Returns: true on success.
 */
export const evmRevert =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const snapshotId = Number(params[0] as string)
				const result = yield* revertHandler(node)(snapshotId)
				return result
			}),
		)

// ---------------------------------------------------------------------------
// Time manipulation
// ---------------------------------------------------------------------------

/**
 * evm_increaseTime → advance block timestamp by N seconds.
 * Params: [seconds: hex string or number]
 * Returns: hex string of total time offset.
 */
export const evmIncreaseTime =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const seconds = BigInt(Number(params[0]))
				const current = yield* Ref.get(node.nodeConfig.timeOffset)
				const newOffset = current + seconds
				yield* Ref.set(node.nodeConfig.timeOffset, newOffset)
				return bigintToHex(newOffset)
			}),
		)

/**
 * evm_setNextBlockTimestamp → set exact timestamp for next mined block.
 * Params: [timestamp: hex string or number]
 * Returns: hex string of the set timestamp.
 */
export const evmSetNextBlockTimestamp =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const timestamp = BigInt(Number(params[0]))
				yield* Ref.set(node.nodeConfig.nextBlockTimestamp, timestamp)
				return bigintToHex(timestamp)
			}),
		)
