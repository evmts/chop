// web3_* JSON-RPC procedures.

import { Effect } from "effect"
import { keccakHandler } from "../cli/commands/crypto.js"
import type { TevmNodeShape } from "../node/index.js"
import type { Procedure } from "./eth.js"
import { wrapErrors } from "./errors.js"

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** web3_clientVersion → version string identifying the client. */
export const web3ClientVersion =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.succeed("chop/0.1.0")

/** web3_sha3 → keccak256 of input data (0x-prefixed hex). */
export const web3Sha3 =
	(_node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const data = params[0] as string
				return yield* keccakHandler(data)
			}),
		)
