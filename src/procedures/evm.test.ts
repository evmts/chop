import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { evmIncreaseTime, evmMine, evmSetAutomine, evmSetIntervalMining, evmSetNextBlockTimestamp } from "./evm.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evmMine procedure", () => {
	it.effect("mines one block and returns '0x0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const result = yield* evmMine(node)([])

			expect(result).toBe("0x0")
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("evmSetAutomine procedure", () => {
	it.effect("disables automine when passed false", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetAutomine(node)([false])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("manual")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("enables automine when passed true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetAutomine(node)([false])
			yield* evmSetAutomine(node)([true])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 'true'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSetAutomine(node)([true])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("evmSetIntervalMining procedure", () => {
	it.effect("sets interval mode when ms > 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetIntervalMining(node)([1000])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("interval")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("sets manual mode when ms = 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetIntervalMining(node)([1000])
			yield* evmSetIntervalMining(node)([0])
			const mode = yield* node.mining.getMode()
			expect(mode).toBe("manual")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 'true'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSetIntervalMining(node)([1000])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ===========================================================================
// T3.7 — Time manipulation procedures
// ===========================================================================

const T37Layer = TevmNode.LocalTest()

// ---------------------------------------------------------------------------
// evm_increaseTime
// ---------------------------------------------------------------------------

describe("evmIncreaseTime procedure", () => {
	it.effect("increases time offset and returns hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmIncreaseTime(node)([60])
			expect(result).toBe("0x3c") // 60 in hex
			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(60n)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("accumulates multiple increases", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* evmIncreaseTime(node)([60])
			const result = yield* evmIncreaseTime(node)([40])
			expect(result).toBe("0x64") // 100 in hex
			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(100n)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("accepts hex string input", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmIncreaseTime(node)(["0x3c"])
			expect(result).toBe("0x3c")
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// evm_setNextBlockTimestamp
// ---------------------------------------------------------------------------

describe("evmSetNextBlockTimestamp procedure", () => {
	it.effect("sets next block timestamp and returns hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSetNextBlockTimestamp(node)([9999999])
			expect(result).toBe("0x98967f") // 9999999 in hex
			const ts = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
			expect(ts).toBe(9999999n)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("timestamp is consumed after mining", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* evmSetNextBlockTimestamp(node)([9999999])
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBe(9999999n)
			yield* evmMine(node)([])
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBeUndefined()
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("mined block uses the set timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* evmSetNextBlockTimestamp(node)([9999999])
			yield* evmMine(node)([])
			const head = yield* node.blockchain.getHead()
			expect(head.timestamp).toBe(9999999n)
		}).pipe(Effect.provide(T37Layer)),
	)
})
