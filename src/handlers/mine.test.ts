import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { sendTransactionHandler } from "./sendTransaction.js"
import { mineHandler, setAutomineHandler, setIntervalMiningHandler } from "./mine.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mineHandler", () => {
	it.effect("mines a single block by default", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const blocks = yield* mineHandler(node)()

			expect(blocks).toHaveLength(1)
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("mines specified number of blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const blocks = yield* mineHandler(node)({ blockCount: 5 })

			expect(blocks).toHaveLength(5)
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 5n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("setAutomineHandler", () => {
	it.effect("toggles auto-mine mode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const modeBefore = yield* node.mining.getMode()
			expect(modeBefore).toBe("auto")

			yield* setAutomineHandler(node)(false)
			const modeAfter = yield* node.mining.getMode()
			expect(modeAfter).toBe("manual")

			yield* setAutomineHandler(node)(true)
			const modeRestored = yield* node.mining.getMode()
			expect(modeRestored).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("setIntervalMiningHandler", () => {
	it.effect("sets interval mining mode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* setIntervalMiningHandler(node)(1000)
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("interval")

			yield* setIntervalMiningHandler(node)(0)
			const modeAfter = yield* node.mining.getMode()
			expect(modeAfter).toBe("manual")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("mine handler — integration with sendTransaction", () => {
	it.effect("manual mode: send tx → block number unchanged → mine → increments", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			// Switch to manual mining
			yield* setAutomineHandler(node)(false)

			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			// Send tx — should NOT auto-mine
			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			// Block number should NOT have changed
			const headAfterSend = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfterSend).toBe(headBefore)

			// Tx should be pending
			const pending = yield* node.txPool.getPendingHashes()
			expect(pending).toHaveLength(1)

			// Now mine manually
			const blocks = yield* mineHandler(node)()

			// Block number should increment
			const headAfterMine = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfterMine).toBe(headBefore + 1n)

			// Block should contain the tx
			expect(blocks[0]!.transactionHashes).toHaveLength(1)
			expect(blocks[0]!.gasUsed).toBeGreaterThan(0n)

			// Tx should no longer be pending
			const pendingAfter = yield* node.txPool.getPendingHashes()
			expect(pendingAfter).toHaveLength(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("auto-mine: send tx → block number increments immediately", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("auto-mine: block has correct tx count and gasUsed", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const head = yield* node.blockchain
				.getHead()
				.pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))

			expect(head.transactionHashes).toHaveLength(1)
			expect(head.gasUsed).toBeGreaterThan(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
