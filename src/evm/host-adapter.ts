import { Context, Effect, Layer } from "effect"
import type { Account } from "../state/account.js"
import type { InvalidSnapshotError, MissingAccountError } from "../state/errors.js"
import type { WorldStateSnapshot } from "../state/world-state.js"
import { WorldStateService, WorldStateTest } from "../state/world-state.js"
import { bigintToBytes32, bytesToHex } from "./conversions.js"
import { WasmExecutionError } from "./errors.js"
import type { HostCallbacks } from "./wasm.js"

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

/** Shape of the HostAdapter service — bridges EVM WASM to WorldState. */
export interface HostAdapterShape {
	/**
	 * HostCallbacks object wired to WorldState for EvmWasmService.executeAsync().
	 * The callbacks convert between Uint8Array (WASM convention) and
	 * string/bigint (WorldState convention).
	 */
	readonly hostCallbacks: HostCallbacks

	/** Get account by byte address. Returns EMPTY_ACCOUNT for non-existent. */
	readonly getAccount: (address: Uint8Array) => Effect.Effect<Account>
	/** Set account at byte address. */
	readonly setAccount: (address: Uint8Array, account: Account) => Effect.Effect<void>
	/** Delete account at byte address. */
	readonly deleteAccount: (address: Uint8Array) => Effect.Effect<void>
	/** Get storage value by byte address + slot. Returns bigint. */
	readonly getStorage: (address: Uint8Array, slot: Uint8Array) => Effect.Effect<bigint>
	/** Set storage value. Fails if account doesn't exist. */
	readonly setStorage: (
		address: Uint8Array,
		slot: Uint8Array,
		value: bigint,
	) => Effect.Effect<void, MissingAccountError>

	/** Create a snapshot for later restore/commit. Delegates to WorldState. */
	readonly snapshot: () => Effect.Effect<WorldStateSnapshot>
	/** Restore state to snapshot. Delegates to WorldState. */
	readonly restore: (snap: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
	/** Commit snapshot — keep changes. Delegates to WorldState. */
	readonly commit: (snap: WorldStateSnapshot) => Effect.Effect<void, InvalidSnapshotError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for the HostAdapter service. */
export class HostAdapterService extends Context.Tag("HostAdapter")<HostAdapterService, HostAdapterShape>() {}

// ---------------------------------------------------------------------------
// Live layer — depends on WorldStateService
// ---------------------------------------------------------------------------

/** Live layer that wires HostCallbacks to WorldStateService. */
export const HostAdapterLive: Layer.Layer<HostAdapterService, never, WorldStateService> = Layer.effect(
	HostAdapterService,
	Effect.gen(function* () {
		const worldState = yield* WorldStateService

		const hostCallbacks: HostCallbacks = {
			onStorageRead: (address: Uint8Array, slot: Uint8Array) =>
				Effect.gen(function* () {
					const addrHex = bytesToHex(address)
					const slotHex = bytesToHex(slot)
					const value = yield* worldState.getStorage(addrHex, slotHex)
					return bigintToBytes32(value)
				}).pipe(
					Effect.catchAll((cause) => Effect.fail(new WasmExecutionError({ message: "Storage read failed", cause }))),
				),

			onBalanceRead: (address: Uint8Array) =>
				Effect.gen(function* () {
					const addrHex = bytesToHex(address)
					const account = yield* worldState.getAccount(addrHex)
					return bigintToBytes32(account.balance)
				}).pipe(
					Effect.catchAll((cause) => Effect.fail(new WasmExecutionError({ message: "Balance read failed", cause }))),
				),
		}

		return {
			hostCallbacks,

			getAccount: (address) => worldState.getAccount(bytesToHex(address)),

			setAccount: (address, account) => worldState.setAccount(bytesToHex(address), account),

			deleteAccount: (address) => worldState.deleteAccount(bytesToHex(address)),

			getStorage: (address, slot) => worldState.getStorage(bytesToHex(address), bytesToHex(slot)),

			setStorage: (address, slot, value) => worldState.setStorage(bytesToHex(address), bytesToHex(slot), value),

			snapshot: () => worldState.snapshot(),

			restore: (snap) => worldState.restore(snap),

			commit: (snap) => worldState.commit(snap),
		} satisfies HostAdapterShape
	}),
)

// ---------------------------------------------------------------------------
// Test layer — self-contained with internal WorldStateService
// ---------------------------------------------------------------------------

/** Self-contained test layer (includes fresh WorldStateService + JournalService). */
export const HostAdapterTest: Layer.Layer<HostAdapterService> = HostAdapterLive.pipe(Layer.provide(WorldStateTest))
