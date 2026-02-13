import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getTransactionByHashHandler } from "./getTransactionByHash.js"
import { sendTransactionHandler } from "./sendTransaction.js"

describe("getTransactionByHashHandler", () => {
	it.effect("returns null for unknown tx hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const tx = yield* getTransactionByHashHandler(node)({ hash: `0x${"ff".repeat(32)}` })
			expect(tx).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns transaction after sendTransaction", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!.address
			const recipient = `0x${"00".repeat(19)}42`

			const result = yield* sendTransactionHandler(node)({
				from: sender,
				to: recipient,
				value: 1000n,
			})

			const tx = yield* getTransactionByHashHandler(node)({ hash: result.hash })
			expect(tx).not.toBeNull()
			expect(tx!.hash).toBe(result.hash)
			expect(tx!.from.toLowerCase()).toBe(sender.toLowerCase())
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returned transaction has correct value field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!.address
			const recipient = `0x${"00".repeat(19)}42`

			const result = yield* sendTransactionHandler(node)({
				from: sender,
				to: recipient,
				value: 5000n,
			})

			const tx = yield* getTransactionByHashHandler(node)({ hash: result.hash })
			expect(tx).not.toBeNull()
			expect(tx!.value).toBe(5000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
