import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	ethEstimateGas,
	ethFeeHistory,
	ethGasPrice,
	ethGetBlockByHash,
	ethGetBlockByNumber,
	ethGetBlockTransactionCountByHash,
	ethGetBlockTransactionCountByNumber,
	ethGetFilterChanges,
	ethGetLogs,
	ethGetProof,
	ethGetTransactionByBlockHashAndIndex,
	ethGetTransactionByBlockNumberAndIndex,
	ethGetTransactionByHash,
	ethMaxPriorityFeePerGas,
	ethNewBlockFilter,
	ethNewFilter,
	ethNewPendingTransactionFilter,
	ethSendRawTransaction,
	ethSign,
	ethUninstallFilter,
} from "./eth.js"

// ---------------------------------------------------------------------------
// Block retrieval
// ---------------------------------------------------------------------------

describe("ethGetBlockByNumber", () => {
	it.effect("returns genesis block for '0x0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockByNumber(node)(["0x0", false])
			expect(result).not.toBeNull()
			const block = result as Record<string, unknown>
			expect(block.number).toBe("0x0")
			expect(typeof block.hash).toBe("string")
			expect(typeof block.parentHash).toBe("string")
			expect(typeof block.gasLimit).toBe("string")
			expect(block.uncles).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns latest block for 'latest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockByNumber(node)(["latest", false])
			expect(result).not.toBeNull()
			const block = result as Record<string, unknown>
			expect(block.number).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for non-existent block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockByNumber(node)(["0xff", false])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetBlockByHash", () => {
	it.effect("returns block for known hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const genesis = yield* node.blockchain.getHead()
			const result = yield* ethGetBlockByHash(node)([genesis.hash, false])
			expect(result).not.toBeNull()
			const block = result as Record<string, unknown>
			expect(block.hash).toBe(genesis.hash)
			expect(block.number).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockByHash(node)([`0x${"ff".repeat(32)}`, false])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Transaction retrieval
// ---------------------------------------------------------------------------

describe("ethGetTransactionByHash", () => {
	it.effect("returns null for non-existent tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetTransactionByHash(node)([`0x${"aa".repeat(32)}`])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns serialized tx for known hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Add a tx to the pool
			const txHash = `0x${"ab".repeat(32)}`
			yield* node.txPool.addTransaction({
				hash: txHash,
				from: "0x1234",
				to: "0x5678",
				value: 1000n,
				gas: 21000n,
				gasPrice: 1_000_000_000n,
				nonce: 0n,
				data: "0x",
			})
			const result = yield* ethGetTransactionByHash(node)([txHash])
			expect(result).not.toBeNull()
			const tx = result as Record<string, unknown>
			expect(tx.hash).toBe(txHash)
			expect(tx.from).toBe("0x1234")
			expect(tx.to).toBe("0x5678")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Gas / fee
// ---------------------------------------------------------------------------

describe("ethGasPrice", () => {
	it.effect("returns hex gas price", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGasPrice(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
			// Genesis block has baseFeePerGas = 1_000_000_000 = 0x3b9aca00
			expect(result).toBe("0x3b9aca00")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethMaxPriorityFeePerGas", () => {
	it.effect("returns 0x0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethMaxPriorityFeePerGas(node)([])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethEstimateGas", () => {
	it.effect("returns gas estimate for simple transfer", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethEstimateGas(node)([{ to: "0x1234", from: "0x5678" }])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
			// Simple transfer = 21000 = 0x5208
			expect(result).toBe("0x5208")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethFeeHistory", () => {
	it.effect("returns fee history object", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethFeeHistory(node)(["0x1", "latest", []])
			expect(result).not.toBeNull()
			const history = result as Record<string, unknown>
			expect(history.oldestBlock).toBe("0x0")
			expect(Array.isArray(history.baseFeePerGas)).toBe(true)
			expect(Array.isArray(history.gasUsedRatio)).toBe(true)
			expect((history.baseFeePerGas as string[]).length).toBeGreaterThan(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

describe("ethGetLogs", () => {
	it.effect("returns empty array when no matching logs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetLogs(node)([{ fromBlock: "earliest", toBlock: "latest" }])
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Signing / proof stubs
// ---------------------------------------------------------------------------

describe("ethSign", () => {
	it.effect("returns error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethSign(node)(["0x1234", "0xdata"]).pipe(
				Effect.map(() => "success" as const),
				Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("not supported")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetProof", () => {
	it.effect("returns stub proof structure", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetProof(node)(["0x1234", [], "latest"])
			const proof = result as Record<string, unknown>
			expect(proof.address).toBe("0x1234")
			expect(proof.accountProof).toEqual([])
			expect(proof.balance).toBe("0x0")
			expect(proof.nonce).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("ethNewFilter", () => {
	it.effect("creates a filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([{ fromBlock: "0x0", toBlock: "latest" }])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethNewBlockFilter", () => {
	it.effect("creates a block filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewBlockFilter(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethNewPendingTransactionFilter", () => {
	it.effect("creates a pending tx filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewPendingTransactionFilter(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetFilterChanges", () => {
	it.effect("returns error for non-existent filter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetFilterChanges(node)(["0x99"]).pipe(
				Effect.map(() => "success" as const),
				Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("not found")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty changes for new block filter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewBlockFilter(node)([])
			const result = yield* ethGetFilterChanges(node)([filterId])
			// No new blocks since filter was created
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethUninstallFilter", () => {
	it.effect("removes a filter and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewBlockFilter(node)([])
			const result = yield* ethUninstallFilter(node)([filterId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns false for non-existent filter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethUninstallFilter(node)(["0x99"])
			expect(result).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Raw transaction stub
// ---------------------------------------------------------------------------

describe("ethSendRawTransaction", () => {
	it.effect("returns error (not implemented)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethSendRawTransaction(node)(["0xf800..."]).pipe(
				Effect.map(() => "success" as const),
				Effect.catchTag("InternalError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("not yet implemented")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Block transaction count
// ---------------------------------------------------------------------------

describe("ethGetBlockTransactionCountByHash", () => {
	it.effect("returns 0x0 for genesis block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const genesis = yield* node.blockchain.getHead()
			const result = yield* ethGetBlockTransactionCountByHash(node)([genesis.hash])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockTransactionCountByHash(node)([`0x${"ff".repeat(32)}`])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetBlockTransactionCountByNumber", () => {
	it.effect("returns 0x0 for genesis block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockTransactionCountByNumber(node)(["0x0"])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for non-existent block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBlockTransactionCountByNumber(node)(["0xff"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Transaction-by-index
// ---------------------------------------------------------------------------

describe("ethGetTransactionByBlockHashAndIndex", () => {
	it.effect("returns null for genesis block (no txs)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const genesis = yield* node.blockchain.getHead()
			const result = yield* ethGetTransactionByBlockHashAndIndex(node)([genesis.hash, "0x0"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetTransactionByBlockNumberAndIndex", () => {
	it.effect("returns null for genesis block (no txs)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetTransactionByBlockNumberAndIndex(node)(["0x0", "0x0"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
