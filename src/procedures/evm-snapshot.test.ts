import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { evmRevert, evmSnapshot } from "./evm.js"
import { methodRouter } from "./router.js"

const TEST_ADDR = hexToBytes(`0x${"00".repeat(19)}01`)
const ONE_ETH = 1_000_000_000_000_000_000n

const mkAccount = (balance: bigint) => ({
	nonce: 0n,
	balance,
	codeHash: new Uint8Array(32),
	code: new Uint8Array(0),
})

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("evmSnapshot procedure", () => {
	it.effect("returns hex ID starting with '0x'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* evmSnapshot(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("IDs increment (0x1, 0x2, 0x3)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const id1 = yield* evmSnapshot(node)([])
			const id2 = yield* evmSnapshot(node)([])
			const id3 = yield* evmSnapshot(node)([])
			expect(id1).toBe("0x1")
			expect(id2).toBe("0x2")
			expect(id3).toBe("0x3")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("evmRevert procedure", () => {
	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const snapId = yield* evmSnapshot(node)([])
			const result = yield* evmRevert(node)([snapId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns InternalError for invalid ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* evmRevert(node)(["0xff"]).pipe(Effect.flip)
			expect(error._tag).toBe("InternalError")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

describe("ACCEPTANCE: snapshot/revert via procedures", () => {
	it.effect("set balance -> snapshot -> change balance -> revert -> original balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set initial balance to 1 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))

			// Take snapshot via procedure
			const snapId = yield* evmSnapshot(node)([])

			// Change balance to 2 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const changed = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(changed.balance).toBe(2n * ONE_ETH)

			// Revert via procedure
			const result = yield* evmRevert(node)([snapId])
			expect(result).toBe(true)

			// Verify original balance restored
			const restored = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(restored.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("nested snapshots (3 deep) with partial reverts", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Level 0: balance = 1 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))
			const snap1 = yield* evmSnapshot(node)([])

			// Level 1: balance = 2 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const snap2 = yield* evmSnapshot(node)([])

			// Level 2: balance = 3 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(3n * ONE_ETH))
			const snap3 = yield* evmSnapshot(node)([])

			// Level 3: balance = 4 ETH
			yield* node.hostAdapter.setAccount(TEST_ADDR, mkAccount(4n * ONE_ETH))

			// Verify current balance is 4 ETH
			const current = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(current.balance).toBe(4n * ONE_ETH)

			// Revert to snap2 (should restore to 2 ETH, invalidate snap3)
			yield* evmRevert(node)([snap2])
			const bal2 = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(bal2.balance).toBe(2n * ONE_ETH)

			// snap3 is now invalid
			const error = yield* evmRevert(node)([snap3]).pipe(Effect.flip)
			expect(error._tag).toBe("InternalError")

			// snap1 is still valid — revert to it
			yield* evmRevert(node)([snap1])
			const bal1 = yield* node.hostAdapter.getAccount(TEST_ADDR)
			expect(bal1.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Router integration
// ---------------------------------------------------------------------------

describe("router: evm_snapshot / evm_revert", () => {
	it.effect("routes evm_snapshot returning hex string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("evm_snapshot", [])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes evm_revert returning true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const snapId = yield* methodRouter(node)("evm_snapshot", [])
			const result = yield* methodRouter(node)("evm_revert", [snapId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
