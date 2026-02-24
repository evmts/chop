import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { cycleMiningMode, getSettingsData, setBlockGasLimit } from "./settings-data.js"

describe("settings-data", () => {
	describe("getSettingsData", () => {
		it.effect("returns expected default settings on fresh node", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getSettingsData(node)
				expect(data.chainId).toBe(31337n)
				expect(data.hardfork).toBe("prague")
				expect(data.miningMode).toBe("auto")
				expect(data.miningInterval).toBe(0)
				expect(data.blockGasLimit).toBe(30_000_000n)
				expect(data.baseFee).toBe(1_000_000_000n)
				expect(data.minGasPrice).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("chainId matches node chainId", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getSettingsData(node)
				expect(data.chainId).toBe(node.chainId)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("hardfork is a non-empty string", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getSettingsData(node)
				expect(data.hardfork.length).toBeGreaterThan(0)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("forkUrl is undefined for local mode", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getSettingsData(node)
				expect(data.forkUrl).toBeUndefined()
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("reflects nodeConfig changes to blockGasLimit", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* Ref.set(node.nodeConfig.blockGasLimit, 15_000_000n)
				const data = yield* getSettingsData(node)
				expect(data.blockGasLimit).toBe(15_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("reflects nodeConfig changes to minGasPrice", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* Ref.set(node.nodeConfig.minGasPrice, 1_000_000n)
				const data = yield* getSettingsData(node)
				expect(data.minGasPrice).toBe(1_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("uses custom chain ID", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getSettingsData(node)
				expect(data.chainId).toBe(42n)
			}).pipe(Effect.provide(TevmNode.LocalTest({ chainId: 42n }))),
		)
	})

	describe("cycleMiningMode", () => {
		it.effect("cycles from auto to manual", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const newMode = yield* cycleMiningMode(node)
				expect(newMode).toBe("manual")
				const mode = yield* node.mining.getMode()
				expect(mode).toBe("manual")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("cycles from manual to interval", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.setAutomine(false)
				const newMode = yield* cycleMiningMode(node)
				expect(newMode).toBe("interval")
				const mode = yield* node.mining.getMode()
				expect(mode).toBe("interval")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("cycles from interval back to auto", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.mining.setIntervalMining(2000)
				const newMode = yield* cycleMiningMode(node)
				expect(newMode).toBe("auto")
				const mode = yield* node.mining.getMode()
				expect(mode).toBe("auto")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("full cycle: auto → manual → interval → auto", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const m1 = yield* cycleMiningMode(node)
				expect(m1).toBe("manual")

				const m2 = yield* cycleMiningMode(node)
				expect(m2).toBe("interval")

				const m3 = yield* cycleMiningMode(node)
				expect(m3).toBe("auto")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("setBlockGasLimit", () => {
		it.effect("updates blockGasLimit in nodeConfig", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* setBlockGasLimit(node, 15_000_000n)
				const limit = yield* Ref.get(node.nodeConfig.blockGasLimit)
				expect(limit).toBe(15_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("reflected in getSettingsData", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* setBlockGasLimit(node, 20_000_000n)
				const data = yield* getSettingsData(node)
				expect(data.blockGasLimit).toBe(20_000_000n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("setting zero is allowed", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* setBlockGasLimit(node, 0n)
				const limit = yield* Ref.get(node.nodeConfig.blockGasLimit)
				expect(limit).toBe(0n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
