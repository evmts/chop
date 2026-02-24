// Snapshot / revert handlers — business logic for evm_snapshot and evm_revert.

import type { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import type { UnknownSnapshotError } from "../node/snapshot-manager.js"

/**
 * Handler for evm_snapshot.
 * Takes a snapshot of the current world state and returns its ID.
 *
 * @param node - The TevmNode facade.
 * @returns A function that returns the snapshot ID.
 */
export const snapshotHandler = (node: TevmNodeShape) => (): Effect.Effect<number> => node.snapshotManager.take()

/**
 * Handler for evm_revert.
 * Reverts the world state to the given snapshot ID.
 * Invalidates all snapshots taken after the target.
 *
 * @param node - The TevmNode facade.
 * @returns A function that takes a snapshot ID and returns true on success.
 */
export const revertHandler =
	(node: TevmNodeShape) =>
	(snapshotId: number): Effect.Effect<boolean, UnknownSnapshotError> =>
		node.snapshotManager.revert(snapshotId)
