// Anvil-specific JSON-RPC procedures (anvil_* methods).

import { Effect } from "effect"
import { mineHandler } from "../handlers/mine.js"
import type { TevmNodeShape } from "../node/index.js"
import { wrapErrors } from "./errors.js"
import type { Procedure } from "./eth.js"

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
