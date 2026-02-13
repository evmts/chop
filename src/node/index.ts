// Node module — composition root for local-mode EVM devnet

import { Context, Effect, Layer } from "effect"
import type { Block } from "../blockchain/block-store.js"
import { BlockStoreLive, BlockchainLive, BlockchainService } from "../blockchain/index.js"
import type { BlockchainApi } from "../blockchain/index.js"
import type { WasmLoadError } from "../evm/errors.js"
import { HostAdapterLive, HostAdapterService } from "../evm/host-adapter.js"
import type { HostAdapterShape } from "../evm/host-adapter.js"
import { ReleaseSpecLive, ReleaseSpecService } from "../evm/release-spec.js"
import type { ReleaseSpecShape } from "../evm/release-spec.js"
import { EvmWasmLive, EvmWasmService, EvmWasmTest } from "../evm/wasm.js"
import type { EvmWasmShape } from "../evm/wasm.js"
import { JournalLive } from "../state/journal.js"
import { WorldStateLive } from "../state/world-state.js"
import { type TestAccount, fundAccounts, getTestAccounts } from "./accounts.js"
import { MiningService, MiningServiceLive } from "./mining.js"
import type { MiningServiceApi } from "./mining.js"
import { type SnapshotManagerApi, makeSnapshotManager } from "./snapshot-manager.js"
import { TxPoolLive, TxPoolService } from "./tx-pool.js"
import type { TxPoolApi } from "./tx-pool.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the TevmNode service — single facade for all sub-services. */
export interface TevmNodeShape {
	/** EVM execution engine (WASM or test mini-interpreter). */
	readonly evm: EvmWasmShape
	/** Host adapter bridging EVM to WorldState (accounts, storage, snapshots). */
	readonly hostAdapter: HostAdapterShape
	/** Blockchain service (chain head, block storage). */
	readonly blockchain: BlockchainApi
	/** Hardfork feature flags. */
	readonly releaseSpec: ReleaseSpecShape
	/** Transaction pool (pending transactions and receipts). */
	readonly txPool: TxPoolApi
	/** Mining service (auto/manual/interval modes, block building). */
	readonly mining: MiningServiceApi
	/** Snapshot manager for evm_snapshot / evm_revert RPC methods. */
	readonly snapshotManager: SnapshotManagerApi
	/** Chain ID (default: 31337 for local devnet). */
	readonly chainId: bigint
	/** Pre-funded test accounts (deterministic Hardhat/Anvil defaults). */
	readonly accounts: readonly TestAccount[]
}

/** Options for creating a local-mode TevmNode. */
export interface NodeOptions {
	/** Chain ID (default: 31337). */
	readonly chainId?: bigint
	/** Hardfork name (default: "prague"). */
	readonly hardfork?: string
	/** Path to WASM binary (only for TevmNode.Local). */
	readonly wasmPath?: string
	/** Number of pre-funded test accounts (default: 10, max: 10). */
	readonly accounts?: number
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for the TevmNode service. */
export class TevmNodeService extends Context.Tag("TevmNode")<TevmNodeService, TevmNodeShape>() {}

// ---------------------------------------------------------------------------
// Internal layer — requires sub-services in context
// ---------------------------------------------------------------------------

const TevmNodeLive = (
	options: NodeOptions = {},
): Layer.Layer<
	TevmNodeService,
	never,
	EvmWasmService | HostAdapterService | BlockchainService | ReleaseSpecService | TxPoolService | MiningService
> =>
	Layer.effect(
		TevmNodeService,
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const hostAdapter = yield* HostAdapterService
			const blockchain = yield* BlockchainService
			const releaseSpec = yield* ReleaseSpecService
			const txPool = yield* TxPoolService
			const mining = yield* MiningService
			const chainId = options.chainId ?? 31337n

			// Initialize genesis block
			const genesisBlock: Block = {
				hash: `0x${"00".repeat(31)}01`,
				parentHash: `0x${"00".repeat(32)}`,
				number: 0n,
				timestamp: BigInt(Math.floor(Date.now() / 1000)),
				gasLimit: 30_000_000n,
				gasUsed: 0n,
				baseFeePerGas: 1_000_000_000n,
			}

			yield* blockchain.initGenesis(genesisBlock).pipe(
				Effect.catchTag("GenesisError", (e) => Effect.die(e)), // Should never fail on fresh node
			)

			// Create snapshot manager
			const snapshotManager = makeSnapshotManager(hostAdapter)

			// Create and fund deterministic test accounts
			const accounts = getTestAccounts(options.accounts ?? 10)
			yield* fundAccounts(hostAdapter, accounts)

			return {
				evm,
				hostAdapter,
				blockchain,
				releaseSpec,
				txPool,
				mining,
				snapshotManager,
				chainId,
				accounts,
			} satisfies TevmNodeShape
		}),
	)

// ---------------------------------------------------------------------------
// Shared sub-service layers (without EVM — EVM varies between Local/LocalTest)
// ---------------------------------------------------------------------------

const sharedSubLayers = (options: NodeOptions = {}) => {
	const base = Layer.mergeAll(
		HostAdapterLive.pipe(Layer.provide(WorldStateLive), Layer.provide(JournalLive())),
		BlockchainLive.pipe(Layer.provide(BlockStoreLive())),
		ReleaseSpecLive(options.hardfork ?? "prague"),
		TxPoolLive(),
	)
	// MiningServiceLive needs BlockchainService + TxPoolService from base.
	// Layer.provide feeds base's output into MiningServiceLive's requirements.
	// Layer.mergeAll merges both outputs; Effect memoizes the shared `base` reference.
	return Layer.mergeAll(base, MiningServiceLive.pipe(Layer.provide(base)))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const TevmNode = {
	/**
	 * Local mode layer with real WASM EVM.
	 * Requires the guillotine-mini WASM binary on disk.
	 */
	Local: (options: NodeOptions = {}): Layer.Layer<TevmNodeService, WasmLoadError> =>
		TevmNodeLive(options).pipe(
			Layer.provide(sharedSubLayers(options)),
			Layer.provide(EvmWasmLive(options.wasmPath, options.hardfork)),
		),

	/**
	 * Local mode layer with test EVM (pure TypeScript mini-interpreter).
	 * No WASM binary needed — suitable for unit/integration tests.
	 */
	LocalTest: (options: NodeOptions = {}): Layer.Layer<TevmNodeService> =>
		TevmNodeLive(options).pipe(Layer.provide(sharedSubLayers(options)), Layer.provide(EvmWasmTest)),
} as const

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { NodeInitError } from "./errors.js"
export { MiningService, MiningServiceLive } from "./mining.js"
export type { MiningMode, MiningServiceApi } from "./mining.js"
export { UnknownSnapshotError } from "./snapshot-manager.js"
export type { SnapshotManagerApi } from "./snapshot-manager.js"
