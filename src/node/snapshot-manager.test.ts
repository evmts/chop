import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { HostAdapterService, HostAdapterTest } from "../evm/host-adapter.js"
import { makeSnapshotManager, UnknownSnapshotError } from "./snapshot-manager.js"

const TEST_ADDR = hexToBytes(`0x${"00".repeat(19)}01`)
const ONE_ETH = 1_000_000_000_000_000_000n

const mkAccount = (balance: bigint) => ({
	nonce: 0n,
	balance,
	codeHash: new Uint8Array(32),
	code: new Uint8Array(0),
})

describe("SnapshotManager", () => {
	it.effect("take() returns incrementing IDs (1, 2, 3)", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			const id1 = yield* sm.take()
			const id2 = yield* sm.take()
			const id3 = yield* sm.take()

			expect(id1).toBe(1)
			expect(id2).toBe(2)
			expect(id3).toBe(3)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("revert() restores world state (set balance -> snapshot -> change -> revert -> original)", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			// Set initial balance
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))
			const before = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(before.balance).toBe(ONE_ETH)

			// Snapshot
			const snapId = yield* sm.take()

			// Change balance
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const changed = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(changed.balance).toBe(2n * ONE_ETH)

			// Revert
			const ok = yield* sm.revert(snapId)
			expect(ok).toBe(true)

			// Original balance restored
			const after = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(after.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("revert() invalidates later snapshots (snap1, snap2 -> revert snap1 -> snap2 invalid)", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))

			const snap1 = yield* sm.take()
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))

			const snap2 = yield* sm.take()
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(3n * ONE_ETH))

			// Revert to snap1 should invalidate snap2
			yield* sm.revert(snap1)

			// snap2 should now be invalid
			const error = yield* sm.revert(snap2).pipe(Effect.flip)
			expect(error._tag).toBe("UnknownSnapshotError")
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("revert() fails for unknown ID -> UnknownSnapshotError", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			const error = yield* sm.revert(999).pipe(Effect.flip)
			expect(error._tag).toBe("UnknownSnapshotError")
			expect(error).toBeInstanceOf(UnknownSnapshotError)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("revert() fails for already-reverted ID", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))
			const snap = yield* sm.take()
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))

			// First revert succeeds
			yield* sm.revert(snap)

			// Second revert fails
			const error = yield* sm.revert(snap).pipe(Effect.flip)
			expect(error._tag).toBe("UnknownSnapshotError")
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("nested 3-deep with partial reverts", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			// Level 0: balance = 1 ETH
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))
			const snap1 = yield* sm.take()

			// Level 1: balance = 2 ETH
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const snap2 = yield* sm.take()

			// Level 2: balance = 3 ETH
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(3n * ONE_ETH))
			const snap3 = yield* sm.take()

			// Level 3: balance = 4 ETH
			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(4n * ONE_ETH))

			// Revert to snap2 (should restore to 2 ETH, invalidate snap3)
			yield* sm.revert(snap2)
			const bal2 = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(bal2.balance).toBe(2n * ONE_ETH)

			// snap3 is now invalid
			const error = yield* sm.revert(snap3).pipe(Effect.flip)
			expect(error._tag).toBe("UnknownSnapshotError")

			// snap1 is still valid — revert to it
			yield* sm.revert(snap1)
			const bal1 = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(bal1.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(HostAdapterTest)),
	)

	it.effect("revert to earliest invalidates all later ones", () =>
		Effect.gen(function* () {
			const hostAdapter = yield* HostAdapterService
			const sm = makeSnapshotManager(hostAdapter)

			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(ONE_ETH))
			const snap1 = yield* sm.take()

			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(2n * ONE_ETH))
			const snap2 = yield* sm.take()

			yield* hostAdapter.setAccount(TEST_ADDR, mkAccount(3n * ONE_ETH))
			const snap3 = yield* sm.take()

			// Revert to snap1
			yield* sm.revert(snap1)

			// All later snapshots invalid
			const e2 = yield* sm.revert(snap2).pipe(Effect.flip)
			expect(e2._tag).toBe("UnknownSnapshotError")
			const e3 = yield* sm.revert(snap3).pipe(Effect.flip)
			expect(e3._tag).toBe("UnknownSnapshotError")

			// Original balance restored
			const bal = yield* hostAdapter.getAccount(TEST_ADDR)
			expect(bal.balance).toBe(ONE_ETH)
		}).pipe(Effect.provide(HostAdapterTest)),
	)
})
