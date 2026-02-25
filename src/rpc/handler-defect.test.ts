import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { TevmNodeShape } from "../node/index.js"
import { handleRequest } from "./handler.js"

// ---------------------------------------------------------------------------
// Create a mock node that causes defects (unexpected throws)
// ---------------------------------------------------------------------------

const makeDefectNode = (): TevmNodeShape =>
	({
		chainId: 31337n,
		accounts: [],
		evm: {} as never,
		hostAdapter: {} as never,
		releaseSpec: {} as never,
		txPool: {} as never,
		mining: {} as never,
		blockchain: {
			getHeadBlockNumber: () => {
				// This throws a non-Error value (simulating a defect)
				throw new Error("unexpected crash in blockchain")
			},
			getHead: () => Effect.die("unexpected crash"),
			getBlock: () => Effect.die("unexpected crash"),
			getBlockByNumber: () => Effect.die("unexpected crash"),
			getLatestBlock: () => Effect.die("unexpected crash"),
			putBlock: () => Effect.die("unexpected crash"),
			initGenesis: () => Effect.die("unexpected crash"),
		},
	}) as unknown as TevmNodeShape

// ---------------------------------------------------------------------------
// Defect handling in handleSingleRequest
// ---------------------------------------------------------------------------

describe("handleRequest — defect handling", () => {
	it.effect("catches defects and returns -32603 Internal error", () =>
		Effect.gen(function* () {
			const node = makeDefectNode()
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method: "eth_blockNumber",
				params: [],
				id: 1,
			})
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { error: { code: number; message: string }; id: number }
			expect(res.error.code).toBe(-32603)
			expect(res.error.message).toContain("Internal error")
			expect(res.id).toBe(1)
		}),
	)

	it.effect("preserves id when defect occurs", () =>
		Effect.gen(function* () {
			const node = makeDefectNode()
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method: "eth_blockNumber",
				params: [],
				id: "my-request-id",
			})
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as { id: string }
			expect(res.id).toBe("my-request-id")
		}),
	)

	it.effect("batch with defecting method still returns all responses", () =>
		Effect.gen(function* () {
			const node = makeDefectNode()
			const body = JSON.stringify([
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
				{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
			])
			const raw = yield* handleRequest(node)(body)
			const res = JSON.parse(raw) as Array<{
				result?: string
				error?: { code: number }
				id: number
			}>
			expect(Array.isArray(res)).toBe(true)
			expect(res).toHaveLength(2)
			// eth_chainId returns the value directly from node.chainId, so it works
			// eth_blockNumber calls blockchain.getHeadBlockNumber() which throws
		}),
	)
})
