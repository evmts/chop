// EVM-specific JSON-RPC procedures (evm_* methods).

import { Effect } from "effect"
import { mineHandler, setAutomineHandler, setIntervalMiningHandler } from "../handlers/mine.js"
import type { TevmNodeShape } from "../node/index.js"
import { InternalError } from "./errors.js"
import type { Procedure } from "./eth.js"

// ---------------------------------------------------------------------------
// Internal: wrap procedure body to catch both errors and defects
// ---------------------------------------------------------------------------

/** Catch all errors AND defects, wrapping them as InternalError. */
const wrapErrors = <A>(effect: Effect.Effect<A, unknown>): Effect.Effect<A, InternalError> =>
	effect.pipe(
		Effect.catchAll((e) => Effect.fail(new InternalError({ message: String(e) }))),
		Effect.catchAllDefect((defect) => Effect.fail(new InternalError({ message: String(defect) }))),
	)

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/**
 * evm_mine → mine one block.
 * Params: [timestamp?]
 * Returns: "0x0" on success (matches Anvil).
 */
export const evmMine =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				yield* mineHandler(node)({ blockCount: 1 })
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
