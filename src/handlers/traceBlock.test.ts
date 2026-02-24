import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { sendTransactionHandler } from "./sendTransaction.js"
import { traceBlockByHashHandler, traceBlockByNumberHandler } from "./traceBlock.js"

describe("traceBlockByNumberHandler", () => {
	// -----------------------------------------------------------------------
	// Happy path: trace a block with transactions
	// -----------------------------------------------------------------------

	it.effect("traces all transactions in a block by number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			// Send a transaction (auto-mine will create block 1)
			yield* sendTransactionHandler(node)({ from, to, value: 1_000n })

			// Trace block 1
			const results = yield* traceBlockByNumberHandler(node)({ blockNumber: 1n })
			expect(results.length).toBe(1)
			expect(results[0]?.result.failed).toBe(false)
			expect(results[0]?.result.gas).toBeTypeOf("bigint")
			expect(results[0]?.result.returnValue).toBe("0x")
			// Simple transfer → no code → empty structLogs
			expect(results[0]?.result.structLogs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("traces multiple transactions in a block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]!.address
			const to1 = node.accounts[1]!.address
			const to2 = node.accounts[2]!.address

			// Switch to manual mining so we can batch transactions
			yield* node.mining.setAutomine(false)

			// Send two transactions
			const { hash: hash1 } = yield* sendTransactionHandler(node)({ from, to: to1, value: 100n })
			const { hash: hash2 } = yield* sendTransactionHandler(node)({ from, to: to2, value: 200n })

			// Mine a block with both
			yield* node.mining.mine(1)

			// Trace the block
			const results = yield* traceBlockByNumberHandler(node)({ blockNumber: 1n })
			expect(results.length).toBe(2)

			// Each result should have the tx hash
			expect(results[0]?.txHash).toBe(hash1)
			expect(results[1]?.txHash).toBe(hash2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array for genesis block (no txs)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const results = yield* traceBlockByNumberHandler(node)({ blockNumber: 0n })
			expect(results).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with HandlerError for non-existent block number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* traceBlockByNumberHandler(node)({ blockNumber: 999n }).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("not found")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Trace block with contract calls
	// -----------------------------------------------------------------------

	it.effect("traces block containing a contract call with structLogs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]!.address
			const contractAddr = "0x2222222222222222222222222222222222222222"

			// Deploy code: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const code = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			const { setCodeHandler } = yield* Effect.promise(() => import("./setCode.js"))
			yield* setCodeHandler(node)({ address: contractAddr, code: bytesToHex(code) })

			// Send tx to the contract (auto-mines)
			yield* sendTransactionHandler(node)({ from, to: contractAddr, data: "0x" })

			// Trace the block
			const results = yield* traceBlockByNumberHandler(node)({ blockNumber: 1n })
			expect(results.length).toBe(1)
			expect(results[0]?.result.structLogs.length).toBeGreaterThan(0)
			expect(results[0]?.result.structLogs[0]?.op).toBe("PUSH1")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("traceBlockByHashHandler", () => {
	it.effect("traces all transactions in a block by hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			// Send a transaction (auto-mine creates block 1)
			yield* sendTransactionHandler(node)({ from, to, value: 1_000n })

			// Get block 1's hash
			const block = yield* node.blockchain.getBlockByNumber(1n)

			// Trace by hash
			const results = yield* traceBlockByHashHandler(node)({ blockHash: block.hash })
			expect(results.length).toBe(1)
			expect(results[0]?.result.failed).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with HandlerError for non-existent block hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* traceBlockByHashHandler(node)({
				blockHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
			}).pipe(Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("not found")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
