// NodeConfig — mutable node configuration for anvil_* / evm_* RPC methods.
// Holds gas settings, coinbase, timestamp overrides, chain ID, and more.

import { Effect, Ref } from "effect"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mutable node configuration — used by anvil_set* and evm_* methods. */
export interface NodeConfig {
	/** Minimum gas price (for legacy tx pricing). Default: 0n (no minimum). */
	readonly minGasPrice: Ref.Ref<bigint>
	/** Next block's base fee per gas override. Undefined = auto-calculate from parent. */
	readonly nextBlockBaseFeePerGas: Ref.Ref<bigint | undefined>
	/** Coinbase address for mined blocks. Default: 0x0...0. */
	readonly coinbase: Ref.Ref<string>
	/** Block gas limit override. Undefined = use parent's gas limit. */
	readonly blockGasLimit: Ref.Ref<bigint | undefined>
	/** Timestamp interval: if set, each new block is exactly N seconds after previous. */
	readonly blockTimestampInterval: Ref.Ref<bigint | undefined>
	/** Next block timestamp override. After use, resets to undefined. */
	readonly nextBlockTimestamp: Ref.Ref<bigint | undefined>
	/** Time offset (seconds) added to real clock when computing block timestamps. */
	readonly timeOffset: Ref.Ref<bigint>
	/** Mutable chain ID (default: same as initial chainId). */
	readonly chainId: Ref.Ref<bigint>
	/** Fork RPC URL (if in fork mode). */
	readonly rpcUrl: Ref.Ref<string | undefined>
	/** Whether to enable execution traces. */
	readonly tracesEnabled: Ref.Ref<boolean>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a NodeConfig with the given initial values. */
export const makeNodeConfig = (options: {
	readonly chainId: bigint
	readonly rpcUrl?: string
}): Effect.Effect<NodeConfig> =>
	Effect.gen(function* () {
		const minGasPrice = yield* Ref.make<bigint>(0n)
		const nextBlockBaseFeePerGas = yield* Ref.make<bigint | undefined>(undefined)
		const coinbase = yield* Ref.make<string>(`0x${"00".repeat(20)}`)
		const blockGasLimit = yield* Ref.make<bigint | undefined>(undefined)
		const blockTimestampInterval = yield* Ref.make<bigint | undefined>(undefined)
		const nextBlockTimestamp = yield* Ref.make<bigint | undefined>(undefined)
		const timeOffset = yield* Ref.make<bigint>(0n)
		const chainId = yield* Ref.make<bigint>(options.chainId)
		const rpcUrl = yield* Ref.make<string | undefined>(options.rpcUrl)
		const tracesEnabled = yield* Ref.make<boolean>(false)

		return {
			minGasPrice,
			nextBlockBaseFeePerGas,
			coinbase,
			blockGasLimit,
			blockTimestampInterval,
			nextBlockTimestamp,
			timeOffset,
			chainId,
			rpcUrl,
			tracesEnabled,
		} satisfies NodeConfig
	})
