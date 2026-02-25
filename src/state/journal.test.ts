import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { InvalidSnapshotError } from "./errors.js"
import { type JournalEntry, JournalLive, JournalService } from "./journal.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TestLayer = JournalLive()

const makeEntry = (
	key: string,
	previousValue: unknown = null,
	tag: "Create" | "Update" | "Delete" = "Create",
): JournalEntry<string, unknown> => ({ key, previousValue, tag })

// ---------------------------------------------------------------------------
// JournalService — basic operations
// ---------------------------------------------------------------------------

describe("JournalService — basic operations", () => {
	it.effect("append increases size", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			expect(yield* journal.size()).toBe(0)

			yield* journal.append(makeEntry("a"))
			expect(yield* journal.size()).toBe(1)

			yield* journal.append(makeEntry("b"))
			expect(yield* journal.size()).toBe(2)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("clear resets everything", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			yield* journal.append(makeEntry("a"))
			yield* journal.append(makeEntry("b"))
			yield* journal.snapshot()
			expect(yield* journal.size()).toBe(2)

			yield* journal.clear()
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// JournalService — snapshot + restore
// ---------------------------------------------------------------------------

describe("JournalService — snapshot + restore", () => {
	it.effect("snapshot returns current position", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap0 = yield* journal.snapshot()
			expect(snap0).toBe(0)

			yield* journal.append(makeEntry("a"))
			yield* journal.append(makeEntry("b"))
			const snap2 = yield* journal.snapshot()
			expect(snap2).toBe(2)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("restore undoes entries after snapshot (calls onRevert in reverse)", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			yield* journal.append(makeEntry("b"))
			yield* journal.append(makeEntry("c"))
			expect(yield* journal.size()).toBe(3)

			const reverted: string[] = []
			yield* journal.restore(snap, (entry) =>
				Effect.sync(() => {
					reverted.push(entry.key)
				}),
			)

			expect(yield* journal.size()).toBe(0)
			// Reverted in reverse order: c, b, a
			expect(reverted).toEqual(["c", "b", "a"])
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("restore with invalid snapshot fails with InvalidSnapshotError", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const error = yield* journal
				.restore(999, () => Effect.void)
				.pipe(
					Effect.flip,
					Effect.catchAll((e) => Effect.succeed(e)),
				)
			expect(error).toBeInstanceOf(InvalidSnapshotError)
			expect((error as InvalidSnapshotError).snapshotId).toBe(999)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("double-restore of same snapshot fails", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))

			yield* journal.restore(snap, () => Effect.void)
			// Second restore should fail — snapshot consumed
			const result = yield* journal
				.restore(snap, () => Effect.void)
				.pipe(Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(InvalidSnapshotError)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// JournalService — snapshot + commit
// ---------------------------------------------------------------------------

describe("JournalService — snapshot + commit", () => {
	it.effect("commit keeps entries, removes snapshot marker", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			yield* journal.append(makeEntry("b"))

			yield* journal.commit(snap)
			// Entries are still there
			expect(yield* journal.size()).toBe(2)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("commit with invalid snapshot fails with InvalidSnapshotError", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const error = yield* journal.commit(999).pipe(
				Effect.flip,
				Effect.catchAll((e) => Effect.succeed(e)),
			)
			expect(error).toBeInstanceOf(InvalidSnapshotError)
			expect((error as InvalidSnapshotError).snapshotId).toBe(999)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("double-commit of same snapshot fails", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))

			yield* journal.commit(snap)
			const result = yield* journal.commit(snap).pipe(Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(InvalidSnapshotError)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// JournalService — nested snapshots
// ---------------------------------------------------------------------------

describe("JournalService — nested snapshots", () => {
	it.effect("nested snapshots work correctly", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService

			// snap1 at position 0
			const snap1 = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))

			// snap2 at position 1
			const snap2 = yield* journal.snapshot()
			yield* journal.append(makeEntry("b"))

			// snap3 at position 2
			const snap3 = yield* journal.snapshot()
			yield* journal.append(makeEntry("c"))

			expect(yield* journal.size()).toBe(3)

			// Restore snap3 — reverts "c"
			const reverted3: string[] = []
			yield* journal.restore(snap3, (entry) =>
				Effect.sync(() => {
					reverted3.push(entry.key)
				}),
			)
			expect(reverted3).toEqual(["c"])
			expect(yield* journal.size()).toBe(2)

			// Restore snap2 — reverts "b"
			const reverted2: string[] = []
			yield* journal.restore(snap2, (entry) =>
				Effect.sync(() => {
					reverted2.push(entry.key)
				}),
			)
			expect(reverted2).toEqual(["b"])
			expect(yield* journal.size()).toBe(1)

			// Restore snap1 — reverts "a"
			const reverted1: string[] = []
			yield* journal.restore(snap1, (entry) =>
				Effect.sync(() => {
					reverted1.push(entry.key)
				}),
			)
			expect(reverted1).toEqual(["a"])
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("restoring outer snapshot also removes inner snapshots", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService

			const snap1 = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			const snap2 = yield* journal.snapshot()
			yield* journal.append(makeEntry("b"))

			// Restore snap1 — should also remove snap2
			yield* journal.restore(snap1, () => Effect.void)
			expect(yield* journal.size()).toBe(0)

			// snap2 should now be invalid
			const result = yield* journal
				.restore(snap2, () => Effect.void)
				.pipe(Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(InvalidSnapshotError)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("commit inner snapshot, then restore outer snapshot", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService

			const snap1 = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			const snap2 = yield* journal.snapshot()
			yield* journal.append(makeEntry("b"))

			// Commit snap2 — entries kept, snap2 marker removed
			yield* journal.commit(snap2)
			expect(yield* journal.size()).toBe(2)

			// Restore snap1 — reverts both "a" and "b"
			const reverted: string[] = []
			yield* journal.restore(snap1, (entry) =>
				Effect.sync(() => {
					reverted.push(entry.key)
				}),
			)
			expect(reverted).toEqual(["b", "a"])
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// JournalService — tag
// ---------------------------------------------------------------------------

describe("JournalService — tag", () => {
	it("has correct tag key", () => {
		expect(JournalService.key).toBe("JournalService")
	})
})
