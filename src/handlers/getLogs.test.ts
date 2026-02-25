import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getLogsHandler } from "./getLogs.js"

describe("getLogsHandler", () => {
	it.effect("returns empty array on fresh node", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logs = yield* getLogsHandler(node)({})
			expect(logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array for latest block range", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logs = yield* getLogsHandler(node)({
				fromBlock: "latest",
				toBlock: "latest",
			})
			expect(logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array for earliest block range", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logs = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
			})
			expect(logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array for non-existent block hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logs = yield* getLogsHandler(node)({
				blockHash: `0x${"ff".repeat(32)}`,
			})
			expect(logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns readonly array", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const logs = yield* getLogsHandler(node)({})
			expect(Array.isArray(logs)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
