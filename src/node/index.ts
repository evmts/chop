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
	/** Chain ID (default: 31337 for local devnet). */
	readonly chainId: bigint
}

/** Options for creating a local-mode TevmNode. */
export interface NodeOptions {
	/** Chain ID (default: 31337). */
	readonly chainId?: bigint
	/** Hardfork name (default: "prague"). */
	readonly hardfork?: string
	/** Path to WASM binary (only for TevmNode.Local). */
	readonly wasmPath?: string
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
): Layer.Layer<TevmNodeService, never, EvmWasmService | HostAdapterService | BlockchainService | ReleaseSpecService> =>
	Layer.effect(
		TevmNodeService,
		Effect.gen(function* () {
			const evm = yield* EvmWasmService
			const hostAdapter = yield* HostAdapterService
			const blockchain = yield* BlockchainService
			const releaseSpec = yield* ReleaseSpecService
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

			return { evm, hostAdapter, blockchain, releaseSpec, chainId } satisfies TevmNodeShape
		}),
	)

// ---------------------------------------------------------------------------
// Shared sub-service layers (without EVM — EVM varies between Local/LocalTest)
// ---------------------------------------------------------------------------

const sharedSubLayers = (options: NodeOptions = {}) =>
	Layer.mergeAll(
		HostAdapterLive.pipe(Layer.provide(WorldStateLive), Layer.provide(JournalLive())),
		BlockchainLive.pipe(Layer.provide(BlockStoreLive())),
		ReleaseSpecLive(options.hardfork ?? "prague"),
	)

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
