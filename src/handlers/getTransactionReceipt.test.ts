import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import type { TransactionReceipt } from "../node/tx-pool.js"
import { getTransactionReceiptHandler } from "./getTransactionReceipt.js"
import { sendTransactionHandler } from "./sendTransaction.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getTransactionReceiptHandler", () => {
	it.effect("returns receipt for a mined transaction", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			// Send a transaction first
			const sendResult = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 1_000_000_000_000_000_000n,
			})

			// Get receipt
			const receipt = yield* getTransactionReceiptHandler(node)({ hash: sendResult.hash })

			expect(receipt).not.toBeNull()
			const r = receipt as TransactionReceipt
			expect(r.transactionHash).toBe(sendResult.hash)
			expect(r.status).toBe(1)
			expect(r.gasUsed).toBeGreaterThan(0n)
			expect(r.blockNumber).toBeGreaterThan(0n)
			expect(r.from.toLowerCase()).toBe(sender.address.toLowerCase())
			expect(r.to).toBe(`0x${"22".repeat(20)}`)
			expect(r.logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for unknown transaction hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const receipt = yield* getTransactionReceiptHandler(node)({ hash: `0x${"dead".repeat(16)}` })

			expect(receipt).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("receipt has correct effective gas price", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const sendResult = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const receipt = yield* getTransactionReceiptHandler(node)({ hash: sendResult.hash })
			const r = receipt as TransactionReceipt

			// Default gas price should be the base fee (1 gwei from genesis)
			expect(r.effectiveGasPrice).toBeGreaterThan(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("receipt has contractAddress null for non-create tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const sendResult = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const receipt = yield* getTransactionReceiptHandler(node)({ hash: sendResult.hash })
			const r = receipt as TransactionReceipt

			expect(r.contractAddress).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
