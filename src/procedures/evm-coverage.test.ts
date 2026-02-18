import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { evmIncreaseTime, evmMine, evmRevert, evmSetNextBlockTimestamp, evmSnapshot } from "./evm.js"

// ---------------------------------------------------------------------------
// evmMine — branch coverage for nodeConfig overrides
// ---------------------------------------------------------------------------

describe("evmMine with nodeConfig overrides", () => {
	it.effect("with baseFeePerGas set — exercises consume one-shot override path", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set baseFeePerGas override
			yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, 42_000_000_000n)
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBe(42_000_000_000n)

			// Mine a block — should use override and then consume it
			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")

			// Verify override was consumed (set back to undefined)
			const afterMine = yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)
			expect(afterMine).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("with gasLimit set — exercises gasLimit !== undefined branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set gasLimit override
			yield* Ref.set(node.nodeConfig.blockGasLimit, 15_000_000n)
			expect(yield* Ref.get(node.nodeConfig.blockGasLimit)).toBe(15_000_000n)

			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")

			// gasLimit is NOT consumed (not a one-shot override)
			const afterMine = yield* Ref.get(node.nodeConfig.blockGasLimit)
			expect(afterMine).toBe(15_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("with blockTimestampInterval set — exercises blockTimestampInterval branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set blockTimestampInterval
			yield* Ref.set(node.nodeConfig.blockTimestampInterval, 12n)
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBe(12n)

			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")

			// blockTimestampInterval is NOT consumed (persistent setting)
			const afterMine = yield* Ref.get(node.nodeConfig.blockTimestampInterval)
			expect(afterMine).toBe(12n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("with timeOffset non-zero — exercises timeOffset !== 0n branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set a non-zero time offset
			yield* Ref.set(node.nodeConfig.timeOffset, 3600n) // 1 hour
			expect(yield* Ref.get(node.nodeConfig.timeOffset)).toBe(3600n)

			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")

			// timeOffset should persist (not consumed)
			const afterMine = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(afterMine).toBe(3600n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("with all overrides set simultaneously", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set all overrides
			yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, 1_000_000_000n)
			yield* Ref.set(node.nodeConfig.blockGasLimit, 20_000_000n)
			yield* Ref.set(node.nodeConfig.blockTimestampInterval, 15n)
			yield* Ref.set(node.nodeConfig.timeOffset, 100n)
			yield* Ref.set(node.nodeConfig.nextBlockTimestamp, 5_000_000n)

			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")

			// One-shot overrides should be consumed
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBeUndefined()
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBeUndefined()

			// Persistent overrides should remain
			expect(yield* Ref.get(node.nodeConfig.blockGasLimit)).toBe(20_000_000n)
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBe(15n)
			expect(yield* Ref.get(node.nodeConfig.timeOffset)).toBe(100n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("without any overrides — all branches take false path", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Verify defaults: all undefined/zero
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBeUndefined()
			expect(yield* Ref.get(node.nodeConfig.blockGasLimit)).toBeUndefined()
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBeUndefined()
			expect(yield* Ref.get(node.nodeConfig.timeOffset)).toBe(0n)
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBeUndefined()

			const result = yield* evmMine(node)([])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evmSnapshot + evmRevert — full cycle
// ---------------------------------------------------------------------------

describe("evmSnapshot + evmRevert cycle", () => {
	it.effect("snapshot returns hex id, revert restores state successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Take a snapshot
			const snapshotId = (yield* evmSnapshot(node)([])) as string
			expect(typeof snapshotId).toBe("string")
			expect(snapshotId).toMatch(/^0x/)
			expect(snapshotId).toBe("0x1") // first snapshot is 1

			// Mine a block so state changes
			yield* evmMine(node)([])
			const headAfterMine = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfterMine).toBe(1n)

			// Revert to the snapshot
			const revertResult = yield* evmRevert(node)([snapshotId])
			expect(revertResult).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("multiple snapshots — IDs increment", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const snap1 = (yield* evmSnapshot(node)([])) as string
			const snap2 = (yield* evmSnapshot(node)([])) as string
			const snap3 = (yield* evmSnapshot(node)([])) as string

			expect(snap1).toBe("0x1")
			expect(snap2).toBe("0x2")
			expect(snap3).toBe("0x3")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("revert invalidates later snapshots", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSnapshot(node)([]) // id 1
			yield* evmSnapshot(node)([]) // id 2
			const snap3 = (yield* evmSnapshot(node)([])) as string // id 3

			// Revert to snapshot 1 — should invalidate 2 and 3
			yield* evmRevert(node)(["0x1"])

			// Trying to revert to snapshot 3 should fail (it was invalidated)
			const result = yield* evmRevert(node)([snap3]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evmRevert — invalid snapshot IDs
// ---------------------------------------------------------------------------

describe("evmRevert with invalid snapshot id", () => {
	it.effect("revert with non-existent snapshot id wraps error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Try to revert to a snapshot that was never taken
			const result = yield* evmRevert(node)(["0x99"]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("revert with 0 id wraps error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Snapshot IDs start at 1, so 0 is invalid
			const result = yield* evmRevert(node)(["0x0"]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evmIncreaseTime — edge cases
// ---------------------------------------------------------------------------

describe("evmIncreaseTime edge cases", () => {
	it.effect("increasing time by 0 seconds returns current offset", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* evmIncreaseTime(node)([0])
			// 0n in hex
			expect(result).toBe("0x0")

			// Offset should remain 0
			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("increasing by 0 after a prior increase preserves offset", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Increase by 60 first
			yield* evmIncreaseTime(node)([60])

			// Increase by 0 — offset stays at 60
			const result = yield* evmIncreaseTime(node)([0])
			expect(result).toBe("0x3c") // 60 in hex

			const offset = yield* Ref.get(node.nodeConfig.timeOffset)
			expect(offset).toBe(60n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evmSetNextBlockTimestamp — edge cases
// ---------------------------------------------------------------------------

describe("evmSetNextBlockTimestamp edge cases", () => {
	it.effect("setting timestamp to 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* evmSetNextBlockTimestamp(node)([0])
			expect(result).toBe("0x0")

			const ts = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
			expect(ts).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("setting timestamp to 0 then mining consumes it", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* evmSetNextBlockTimestamp(node)([0])
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBe(0n)

			yield* evmMine(node)([])

			// Should be consumed
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("setting timestamp to hex string input", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// 0x3e8 = 1000
			const result = yield* evmSetNextBlockTimestamp(node)(["0x3e8"])
			expect(result).toBe("0x3e8")

			const ts = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
			expect(ts).toBe(1000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
