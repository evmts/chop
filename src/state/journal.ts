import { Context, Effect, Layer } from "effect"
import { InvalidSnapshotError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tag for journal entry operations. */
export type ChangeTag = "Create" | "Update" | "Delete"

/** A single journal entry recording a state change. */
export interface JournalEntry<K, V> {
	readonly key: K
	/** Previous value before the change. null = key didn't exist before. */
	readonly previousValue: V | null
	readonly tag: ChangeTag
}

/** Opaque snapshot handle — index into the journal entries array. */
export type JournalSnapshot = number

/** Shape of the Journal service API. */
export interface JournalApi<K, V> {
	/** Record a state change in the journal. */
	readonly append: (entry: JournalEntry<K, V>) => Effect.Effect<void>
	/** Mark current position — returns a handle for restore/commit. */
	readonly snapshot: () => Effect.Effect<JournalSnapshot>
	/** Undo all entries after the snapshot, calling onRevert in reverse order. */
	readonly restore: (
		snapshot: JournalSnapshot,
		onRevert: (entry: JournalEntry<K, V>) => Effect.Effect<void>,
	) => Effect.Effect<void, InvalidSnapshotError>
	/** Keep entries but discard the snapshot marker. */
	readonly commit: (snapshot: JournalSnapshot) => Effect.Effect<void, InvalidSnapshotError>
	/** Number of entries in the journal. */
	readonly size: () => Effect.Effect<number>
	/** Reset journal to empty state (entries + snapshots). */
	readonly clear: () => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for JournalService — uses string keys and unknown values. */
export class JournalService extends Context.Tag("JournalService")<JournalService, JournalApi<string, unknown>>() {}

// ---------------------------------------------------------------------------
// Layer — factory function for test isolation
// ---------------------------------------------------------------------------

/** Create a fresh JournalService layer. Factory function ensures isolation per test. */
export const JournalLive = (): Layer.Layer<JournalService> =>
	Layer.sync(JournalService, () => {
		const entries: JournalEntry<string, unknown>[] = []
		const snapshotStack: number[] = []

		return {
			append: (entry) =>
				Effect.sync(() => {
					entries.push(entry)
				}),

			snapshot: () =>
				Effect.sync(() => {
					const position = entries.length
					snapshotStack.push(position)
					return position
				}),

			restore: (snapshot, onRevert) =>
				Effect.gen(function* () {
					const idx = snapshotStack.lastIndexOf(snapshot)
					if (idx === -1) {
						return yield* Effect.fail(
							new InvalidSnapshotError({
								snapshotId: snapshot,
								message: `Snapshot ${snapshot} not found or already consumed`,
							}),
						)
					}
					// Pop this and all later snapshots
					snapshotStack.splice(idx)
					// Revert entries in reverse order
					while (entries.length > snapshot) {
						const entry = entries.pop()
						if (entry !== undefined) {
							yield* onRevert(entry)
						}
					}
				}),

			commit: (snapshot) =>
				Effect.gen(function* () {
					const idx = snapshotStack.lastIndexOf(snapshot)
					if (idx === -1) {
						return yield* Effect.fail(
							new InvalidSnapshotError({
								snapshotId: snapshot,
								message: `Snapshot ${snapshot} not found or already consumed`,
							}),
						)
					}
					// Just remove the snapshot marker, keep entries
					snapshotStack.splice(idx, 1)
				}),

			size: () => Effect.sync(() => entries.length),

			clear: () =>
				Effect.sync(() => {
					entries.length = 0
					snapshotStack.length = 0
				}),
		} satisfies JournalApi<string, unknown>
	})
