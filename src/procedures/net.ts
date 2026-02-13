// net_* JSON-RPC procedures.

import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import type { Procedure } from "./eth.js"

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** net_version → chain ID as decimal string (NOT hex — per Ethereum JSON-RPC spec). */
export const netVersion =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.succeed(String(node.chainId))

/** net_listening → always true (local devnet is always "listening"). */
export const netListening =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.succeed(true)

/** net_peerCount → "0x0" (local devnet has no peers). */
export const netPeerCount =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.succeed("0x0")
