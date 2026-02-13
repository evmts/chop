// Snapshot manager — maps RPC-level auto-incrementing IDs to WorldState snapshots
// with invalidation semantics (reverting snapshot N invalidates all snapshots > N).

import { Data, Effect } from "effect"
import type { HostAdapterShape } from "../evm/host-adapter.js"
import type { WorldStateSnapshot } from "../state/world-state.js"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Error raised when reverting to a snapshot ID that doesn't exist or was invalidated. */
export class UnknownSnapshotError extends Data.TaggedError("UnknownSnapshotError")<{
	readonly snapshotId: number
}> {}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the SnapshotManager API. */
export interface SnapshotManagerApi {
	/** Take a snapshot. Returns a monotonically increasing snapshot ID (1, 2, 3...). */
	readonly take: () => Effect.Effect<number>
	/** Revert to a snapshot. Returns true on success. Invalidates all later snapshots. */
	readonly revert: (snapshotId: number) => Effect.Effect<boolean, UnknownSnapshotError>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a SnapshotManager backed by a HostAdapter.
 *
 * The manager maintains a counter and a map of snapshot IDs to WorldState snapshots.
 * On revert, it restores the WorldState and invalidates all snapshots with IDs >= the
 * reverted one's ID.
 */
export const makeSnapshotManager = (hostAdapter: HostAdapterShape): SnapshotManagerApi => {
	let nextId = 1
	const snapshots = new Map<number, WorldStateSnapshot>()

	return {
		take: () =>
			Effect.gen(function* () {
				const wsSnap = yield* hostAdapter.snapshot()
				const id = nextId++
				snapshots.set(id, wsSnap)
				return id
			}),

		revert: (snapshotId) =>
			Effect.gen(function* () {
				const wsSnap = snapshots.get(snapshotId)
				if (wsSnap === undefined) {
					return yield* Effect.fail(new UnknownSnapshotError({ snapshotId }))
				}

				// Restore world state
				yield* hostAdapter.restore(wsSnap).pipe(
					Effect.catchTag("InvalidSnapshotError", (e) =>
						Effect.fail(new UnknownSnapshotError({ snapshotId })),
					),
				)

				// Invalidate this snapshot and all later ones
				for (const id of [...snapshots.keys()]) {
					if (id >= snapshotId) {
						snapshots.delete(id)
					}
				}

				return true as boolean
			}),
	} satisfies SnapshotManagerApi
}
