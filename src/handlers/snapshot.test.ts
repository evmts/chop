import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { revertHandler, snapshotHandler } from "./snapshot.js"

const TEST_ADDR = hexToBytes(`0x${"00".repeat(19)}01`)
const ONE_ETH = 1_000_000_000_000_000_000n

const mkAccount = (balance: bigint) => ({
	nonce: 0n,
	balance,
	codeHash: new Uint8Array(32),
	code: new Uint8Array(0),
})

describe("snapshotHandler", () => {
	it.effect("returns a positive snapshot ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const id = yield* snapshotHandler(node)()
			expect(id).toBeGreaterThan(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("revertHandler", () => {
	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const id = yield* snapshotHandler(node)()
			const result = yield* revertHandler(node)(id)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("full balance cycle: set -> snapshot -> change -> revert -> original", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set initial balance
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))

			// Snapshot
			const snapId = yield* snapshotHandler(node)()

			// Change balance
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const changed = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(changed.balance).toBe(2n * ONE_ETH)

			// Revert
			const ok = yield* revertHandler(node)(snapId)
			expect(ok).toBe(true)

			// Verify original balance
			const restored = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(restored.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
