// Node module — composition root for local-mode and fork-mode EVM devnet

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
import type { ForkDataError } from "./fork/errors.js"
import { resolveForkConfig } from "./fork/fork-config.js"
import { ForkWorldStateLive } from "./fork/fork-state.js"
import { HttpTransportLive, HttpTransportService } from "./fork/http-transport.js"
import { type FilterManagerApi, makeFilterManager } from "./filter-manager.js"
import { type ImpersonationManagerApi, makeImpersonationManager } from "./impersonation-manager.js"
import { MiningService, MiningServiceLive } from "./mining.js"
import type { MiningServiceApi } from "./mining.js"
import type { NodeConfig } from "./node-config.js"
import { makeNodeConfig } from "./node-config.js"
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
	/** Impersonation manager for anvil_impersonateAccount / anvil_stopImpersonatingAccount. */
	readonly impersonationManager: ImpersonationManagerApi
	/** Filter manager for eth_newFilter / eth_getFilterChanges / eth_uninstallFilter. */
	readonly filterManager: FilterManagerApi
	/** Chain ID (default: 31337 for local devnet). */
	readonly chainId: bigint
	/** Pre-funded test accounts (deterministic Hardhat/Anvil defaults). */
	readonly accounts: readonly TestAccount[]
	/** Mutable node configuration (gas, coinbase, timestamps, etc.). */
	readonly nodeConfig: NodeConfig
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

/** Options for creating a fork-mode TevmNode. */
export interface ForkNodeOptions extends NodeOptions {
	/** Upstream RPC URL to fork from. */
	readonly forkUrl: string
	/** Pin to a specific block number (default: latest). */
	readonly forkBlockNumber?: bigint
	/** HTTP transport timeout in ms (default: 10_000). */
	readonly transportTimeoutMs?: number
	/** HTTP transport max retries (default: 3). */
	readonly transportMaxRetries?: number
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

			// Create impersonation manager
			const impersonationManager = makeImpersonationManager()

			// Create filter manager
			const filterManager = makeFilterManager()

			// Create mutable node configuration
			const nodeConfig = yield* makeNodeConfig({ chainId })

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
				impersonationManager,
				filterManager,
				chainId,
				accounts,
				nodeConfig,
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
// Fork-mode shared sub-service layers
// ---------------------------------------------------------------------------

const forkSharedSubLayers = (options: NodeOptions, forkBlockNumber: bigint) => {
	const journalLayer = JournalLive()
	const forkWorldState = ForkWorldStateLive({ blockNumber: forkBlockNumber }).pipe(
		Layer.provide(journalLayer),
		// HttpTransportService is provided externally
	)

	const base = Layer.mergeAll(
		HostAdapterLive.pipe(Layer.provide(forkWorldState)),
		BlockchainLive.pipe(Layer.provide(BlockStoreLive())),
		ReleaseSpecLive(options.hardfork ?? "prague"),
		TxPoolLive(),
	)
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

	/**
	 * Fork mode layer with real WASM EVM.
	 *
	 * Resolves chain ID and block number from the upstream RPC,
	 * then creates a node with a ForkWorldState overlay.
	 * Requires the guillotine-mini WASM binary on disk.
	 *
	 * The returned Effect must be run to resolve the fork config
	 * before building the layer.
	 */
	Fork: (options: ForkNodeOptions): Effect.Effect<Layer.Layer<TevmNodeService, WasmLoadError>, ForkDataError> =>
		Effect.gen(function* () {
			const transportLayer = HttpTransportLive({
				url: options.forkUrl,
				...(options.transportTimeoutMs !== undefined ? { timeoutMs: options.transportTimeoutMs } : {}),
				...(options.transportMaxRetries !== undefined ? { maxRetries: options.transportMaxRetries } : {}),
			})

			// Resolve fork config (chain ID + block number) from remote
			const transport = yield* Effect.provide(HttpTransportService, transportLayer)
			const config = yield* resolveForkConfig(transport, {
				url: options.forkUrl,
				...(options.forkBlockNumber !== undefined ? { blockNumber: options.forkBlockNumber } : {}),
			})

			const nodeOpts: NodeOptions = {
				chainId: options.chainId ?? config.chainId,
				...(options.hardfork !== undefined ? { hardfork: options.hardfork } : {}),
				...(options.accounts !== undefined ? { accounts: options.accounts } : {}),
				...(options.wasmPath !== undefined ? { wasmPath: options.wasmPath } : {}),
			}

			return TevmNodeLive(nodeOpts).pipe(
				Layer.provide(forkSharedSubLayers(nodeOpts, config.blockNumber)),
				Layer.provide(transportLayer),
				Layer.provide(EvmWasmLive(options.wasmPath, options.hardfork)),
			)
		}),

	/**
	 * Fork mode layer with test EVM.
	 *
	 * Resolves chain ID and block number from the upstream RPC,
	 * then creates a node with a ForkWorldState overlay.
	 *
	 * The returned Effect must be run to resolve the fork config
	 * before building the layer.
	 */
	ForkTest: (options: ForkNodeOptions): Effect.Effect<Layer.Layer<TevmNodeService>, ForkDataError> =>
		Effect.gen(function* () {
			const transportLayer = HttpTransportLive({
				url: options.forkUrl,
				...(options.transportTimeoutMs !== undefined ? { timeoutMs: options.transportTimeoutMs } : {}),
				...(options.transportMaxRetries !== undefined ? { maxRetries: options.transportMaxRetries } : {}),
			})

			// Resolve fork config (chain ID + block number) from remote
			const transport = yield* Effect.provide(HttpTransportService, transportLayer)
			const config = yield* resolveForkConfig(transport, {
				url: options.forkUrl,
				...(options.forkBlockNumber !== undefined ? { blockNumber: options.forkBlockNumber } : {}),
			})

			const nodeOpts: NodeOptions = {
				chainId: options.chainId ?? config.chainId,
				...(options.hardfork !== undefined ? { hardfork: options.hardfork } : {}),
				...(options.accounts !== undefined ? { accounts: options.accounts } : {}),
			}

			return TevmNodeLive(nodeOpts).pipe(
				Layer.provide(forkSharedSubLayers(nodeOpts, config.blockNumber)),
				Layer.provide(transportLayer),
				Layer.provide(EvmWasmTest),
			)
		}),

	/**
	 * Create a fork-mode node layer from a pre-resolved config and mock transport.
	 * Useful for tests that don't need a real RPC endpoint.
	 */
	ForkTestWithTransport: (
		options: NodeOptions & { readonly blockNumber: bigint },
		transportLayer: Layer.Layer<HttpTransportService>,
	): Layer.Layer<TevmNodeService> =>
		TevmNodeLive(options).pipe(
			Layer.provide(forkSharedSubLayers(options, options.blockNumber)),
			Layer.provide(transportLayer),
			Layer.provide(EvmWasmTest),
		),
} as const

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { NodeInitError } from "./errors.js"
export type { NodeConfig } from "./node-config.js"
export { makeNodeConfig } from "./node-config.js"
export type { FilterManagerApi } from "./filter-manager.js"
export type { ImpersonationManagerApi } from "./impersonation-manager.js"
export { MiningService, MiningServiceLive } from "./mining.js"
export type { MiningMode, MiningServiceApi } from "./mining.js"
export { UnknownSnapshotError } from "./snapshot-manager.js"
export type { SnapshotManagerApi } from "./snapshot-manager.js"
export { ForkRpcError, ForkDataError, TransportTimeoutError } from "./fork/errors.js"
export { HttpTransportService, HttpTransportLive } from "./fork/http-transport.js"
export type { HttpTransportApi } from "./fork/http-transport.js"
export { ForkConfigService, ForkConfigFromRpc, ForkConfigStatic } from "./fork/fork-config.js"
export type { ForkConfig, ForkOptions } from "./fork/fork-config.js"
