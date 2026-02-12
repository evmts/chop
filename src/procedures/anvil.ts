// Anvil-specific JSON-RPC procedures (anvil_* methods).

import { Effect } from "effect"
import { mineHandler } from "../handlers/mine.js"
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
 * anvil_mine → mine N blocks (default 1).
 * Params: [blockCount?, timestampDelta?]
 * Returns: null on success.
 */
export const anvilMine =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockCount = params[0] !== undefined ? Number(params[0]) : 1
				yield* mineHandler(node)({ blockCount })
				return null
			}),
		)
