import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getBlockByNumberHandler } from "./getBlockByNumber.js"

describe("getBlockByNumberHandler", () => {
	it.effect("returns genesis block for 'latest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "latest", includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns genesis block for 'earliest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "earliest", includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns genesis block for 'pending'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "pending", includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns genesis block for hex '0x0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "0x0", includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null for non-existent block number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "0xff", includeFullTxs: false })
			expect(block).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with HandlerError for invalid block tag", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getBlockByNumberHandler(node)({
				blockTag: "not-a-number",
				includeFullTxs: false,
			}).pipe(
				Effect.flip,
			)
			expect(result._tag).toBe("HandlerError")
			expect(result.message).toContain("Invalid block tag")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns block with correct hash field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const block = yield* getBlockByNumberHandler(node)({ blockTag: "latest", includeFullTxs: false })
			expect(block).not.toBeNull()
			expect(block!.hash).toBeDefined()
			expect(block!.hash.startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
