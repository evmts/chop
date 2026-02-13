// Integration tests for T3.7 — verify nodeConfig actually affects mined blocks.

import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	anvilMine,
	anvilSetBlockGasLimit,
	anvilSetBlockTimestampInterval,
	anvilSetNextBlockBaseFeePerGas,
} from "./anvil.js"
import { evmIncreaseTime, evmSetNextBlockTimestamp } from "./evm.js"

// ---------------------------------------------------------------------------
// anvil_setNextBlockBaseFeePerGas → affects mined block
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: anvil_setNextBlockBaseFeePerGas affects next mined block", () => {
	it.effect("mined block uses the overridden base fee", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set next block's base fee to 42 gwei
			const targetBaseFee = 42_000_000_000n
			yield* anvilSetNextBlockBaseFeePerGas(node)([`0x${targetBaseFee.toString(16)}`])

			// Mine a block
			yield* anvilMine(node)([])

			// Get the mined block
			const head = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
			expect(head.baseFeePerGas).toBe(targetBaseFee)

			// Should be consumed (one-shot) — next block uses auto-calculated
			const configValue = yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)
			expect(configValue).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockGasLimit → affects mined block
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: anvil_setBlockGasLimit affects next mined block", () => {
	it.effect("mined block uses the overridden gas limit", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const targetGasLimit = 15_000_000n
			yield* anvilSetBlockGasLimit(node)([`0x${targetGasLimit.toString(16)}`])

			yield* anvilMine(node)([])

			const head = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
			expect(head.gasLimit).toBe(targetGasLimit)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evm_increaseTime → advances block timestamp
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: evm_increaseTime advances block timestamp", () => {
	it.effect("mined block timestamp includes time offset", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Get genesis timestamp
			const genesis = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
			const genesisTs = genesis.timestamp

			// Increase time by 1000 seconds
			yield* evmIncreaseTime(node)([1000])

			// Mine a block
			yield* anvilMine(node)([])

			const head = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
			// Block timestamp should be at least genesisTs + 1000
			expect(head.timestamp).toBeGreaterThanOrEqual(genesisTs + 1000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evm_setNextBlockTimestamp → sets exact timestamp for next block
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: evm_setNextBlockTimestamp sets exact timestamp for next block", () => {
	it.effect("mined block has the exact requested timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const targetTimestamp = 2_000_000_000n
			yield* evmSetNextBlockTimestamp(node)([Number(targetTimestamp)])

			yield* anvilMine(node)([])

			const head = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
			expect(head.timestamp).toBe(targetTimestamp)

			// Should be consumed (one-shot)
			const configValue = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
			expect(configValue).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockTimestampInterval → consistent block spacing
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: anvil_setBlockTimestampInterval sets interval", () => {
	it.effect("consecutive blocks have the configured interval", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set interval to 12 seconds
			yield* anvilSetBlockTimestampInterval(node)([12])

			// Mine 3 blocks
			yield* anvilMine(node)([3])

			// Get blocks 1, 2, 3
			const block1 = yield* node.blockchain
				.getBlockByNumber(1n)
				.pipe(Effect.catchTag("BlockNotFoundError", (e) => Effect.die(e)))
			const block2 = yield* node.blockchain
				.getBlockByNumber(2n)
				.pipe(Effect.catchTag("BlockNotFoundError", (e) => Effect.die(e)))
			const block3 = yield* node.blockchain
				.getBlockByNumber(3n)
				.pipe(Effect.catchTag("BlockNotFoundError", (e) => Effect.die(e)))

			expect(block2.timestamp - block1.timestamp).toBe(12n)
			expect(block3.timestamp - block2.timestamp).toBe(12n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// evm_setAutomine → via router (acceptance test for T3.7 checkbox)
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: evm_setAutomine", () => {
	it.effect("routes through router and toggles mining mode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const { methodRouter } = yield* Effect.promise(() => import("./router.js"))

			// Disable automine
			const result = yield* methodRouter(node)("evm_setAutomine", [false])
			expect(result).toBe("true")

			const mode = yield* node.mining.getMode()
			expect(mode).toBe("manual")

			// Re-enable
			yield* methodRouter(node)("evm_setAutomine", [true])
			const mode2 = yield* node.mining.getMode()
			expect(mode2).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
