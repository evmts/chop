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
// Snapshot edge cases
// ---------------------------------------------------------------------------

describe("JournalService — boundary: snapshot edge cases", () => {
	it.effect("snapshot at position 0 with no entries, then empty restore", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()
			expect(snap).toBe(0)

			// Restore with nothing to revert
			const reverted: string[] = []
			yield* journal.restore(snap, (entry) =>
				Effect.sync(() => {
					reverted.push(entry.key)
				}),
			)

			expect(reverted).toEqual([])
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("duplicate snapshot positions (two snapshots with no entries between)", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap1 = yield* journal.snapshot()
			const snap2 = yield* journal.snapshot()
			// Both at position 0
			expect(snap1).toBe(0)
			expect(snap2).toBe(0)

			yield* journal.append(makeEntry("a"))

			// Restore snap2 (latest with value 0) — should revert "a"
			yield* journal.restore(snap2, () => Effect.void)
			expect(yield* journal.size()).toBe(0)

			// snap1 should still be valid (lastIndexOf finds the remaining 0)
			yield* journal.append(makeEntry("b"))
			yield* journal.restore(snap1, () => Effect.void)
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("clear then snapshot works correctly", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			yield* journal.append(makeEntry("a"))
			yield* journal.snapshot()
			yield* journal.clear()

			expect(yield* journal.size()).toBe(0)
			const snap = yield* journal.snapshot()
			expect(snap).toBe(0)

			yield* journal.append(makeEntry("b"))
			yield* journal.restore(snap, () => Effect.void)
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("restore then new snapshot works correctly", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap1 = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			yield* journal.append(makeEntry("b"))

			yield* journal.restore(snap1, () => Effect.void)
			expect(yield* journal.size()).toBe(0)

			// Take a new snapshot and use it
			const snap2 = yield* journal.snapshot()
			expect(snap2).toBe(0)
			yield* journal.append(makeEntry("c"))
			expect(yield* journal.size()).toBe(1)

			yield* journal.restore(snap2, () => Effect.void)
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("commit outer snapshot while inner exists, inner becomes invalid", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap1 = yield* journal.snapshot()
			yield* journal.append(makeEntry("a"))
			yield* journal.snapshot()
			yield* journal.append(makeEntry("b"))

			// Commit outer — removes snap1 marker. snap2 still exists.
			yield* journal.commit(snap1)
			expect(yield* journal.size()).toBe(2)

			// snap1 should now be invalid
			const result = yield* journal
				.commit(snap1)
				.pipe(Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e)))
			expect(result).toBeInstanceOf(InvalidSnapshotError)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Factory isolation
// ---------------------------------------------------------------------------

describe("JournalService — boundary: factory isolation", () => {
	it.effect("two JournalLive() instances are independent", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			yield* journal.append(makeEntry("a"))
			expect(yield* journal.size()).toBe(1)
		}).pipe(Effect.provide(JournalLive())),
	)

	it.effect("second JournalLive() starts empty", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			expect(yield* journal.size()).toBe(0)
		}).pipe(Effect.provide(JournalLive())),
	)
})

// ---------------------------------------------------------------------------
// Entry tags
// ---------------------------------------------------------------------------

describe("JournalService — boundary: entry tags preserved through restore", () => {
	it.effect("onRevert receives correct tags", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()

			yield* journal.append(makeEntry("a", null, "Create"))
			yield* journal.append(makeEntry("b", "old-b", "Update"))
			yield* journal.append(makeEntry("c", "old-c", "Delete"))

			const tags: string[] = []
			yield* journal.restore(snap, (entry) =>
				Effect.sync(() => {
					tags.push(`${entry.key}:${entry.tag}`)
				}),
			)

			// Reverse order
			expect(tags).toEqual(["c:Delete", "b:Update", "a:Create"])
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("previousValue is preserved through restore", () =>
		Effect.gen(function* () {
			const journal = yield* JournalService
			const snap = yield* journal.snapshot()

			yield* journal.append(makeEntry("a", null, "Create"))
			yield* journal.append(makeEntry("b", { foo: 42 }, "Update"))

			const values: Array<unknown> = []
			yield* journal.restore(snap, (entry) =>
				Effect.sync(() => {
					values.push(entry.previousValue)
				}),
			)

			expect(values).toEqual([{ foo: 42 }, null])
		}).pipe(Effect.provide(TestLayer)),
	)
})
