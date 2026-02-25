/**
 * ForkConfigService — resolves fork configuration (chain ID + block number).
 *
 * Two modes:
 * 1. Static — user provides all values.
 * 2. From RPC — fetches chain ID and/or latest block from the remote.
 */

import { Context, Effect, Layer } from "effect"
import { ForkDataError } from "./errors.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved fork configuration (all values known). */
export interface ForkConfig {
	/** Chain ID of the forked chain. */
	readonly chainId: bigint
	/** Block number to fork at. */
	readonly blockNumber: bigint
}

/** User-provided fork options (some values may be omitted for auto-resolution). */
export interface ForkOptions {
	/** Upstream RPC URL to fork from. */
	readonly url: string
	/** Pin to a specific block number (default: latest). */
	readonly blockNumber?: bigint
}

/** Shape of the ForkConfig service API. */
export interface ForkConfigApi {
	/** The resolved fork configuration. */
	readonly config: ForkConfig
	/** The upstream RPC URL. */
	readonly url: string
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for ForkConfigService. */
export class ForkConfigService extends Context.Tag("ForkConfig")<ForkConfigService, ForkConfigApi>() {}

// ---------------------------------------------------------------------------
// Helpers — parse hex values
// ---------------------------------------------------------------------------

const parseHexBigint = (value: unknown, label: string): Effect.Effect<bigint, ForkDataError> =>
	Effect.try({
		try: () => {
			if (typeof value !== "string") throw new Error(`expected hex string, got ${typeof value}`)
			return BigInt(value)
		},
		catch: (e) => new ForkDataError({ message: `Failed to parse ${label}: ${e}` }),
	})

// ---------------------------------------------------------------------------
// Factory — resolve from RPC
// ---------------------------------------------------------------------------

/** Resolve chain ID and block number from the upstream RPC. */
export const resolveForkConfig = (
	transport: HttpTransportApi,
	options: ForkOptions,
): Effect.Effect<ForkConfig, ForkDataError> =>
	Effect.gen(function* () {
		// If block number is provided, only need chain ID
		if (options.blockNumber !== undefined) {
			const rawChainId = yield* transport
				.request("eth_chainId", [])
				.pipe(
					Effect.catchTag("ForkRpcError", (e) =>
						Effect.fail(new ForkDataError({ message: `Failed to fetch chain ID: ${e.message}` })),
					),
				)
			const chainId = yield* parseHexBigint(rawChainId, "chainId")
			return { chainId, blockNumber: options.blockNumber }
		}

		// Need both chain ID and block number — batch them
		const results = yield* transport
			.batchRequest([
				{ method: "eth_chainId", params: [] },
				{ method: "eth_blockNumber", params: [] },
			])
			.pipe(
				Effect.catchTag("ForkRpcError", (e) =>
					Effect.fail(new ForkDataError({ message: `Failed to fetch fork config: ${e.message}` })),
				),
			)

		const chainId = yield* parseHexBigint(results[0], "chainId")
		const blockNumber = yield* parseHexBigint(results[1], "blockNumber")

		return { chainId, blockNumber }
	})

// ---------------------------------------------------------------------------
// Layer — resolves config from RPC (requires HttpTransportService)
// ---------------------------------------------------------------------------

/** Layer that resolves fork config from the upstream RPC. */
export const ForkConfigFromRpc = (
	options: ForkOptions,
): Layer.Layer<ForkConfigService, ForkDataError, HttpTransportService> =>
	Layer.effect(
		ForkConfigService,
		Effect.gen(function* () {
			const transport = yield* HttpTransportService
			const config = yield* resolveForkConfig(transport, options)
			return { config, url: options.url } satisfies ForkConfigApi
		}),
	)

// ---------------------------------------------------------------------------
// Layer — static (all values known, no RPC needed)
// ---------------------------------------------------------------------------

/** Layer with statically provided fork config. No RPC resolution needed. */
export const ForkConfigStatic = (url: string, config: ForkConfig): Layer.Layer<ForkConfigService> =>
	Layer.succeed(ForkConfigService, { config, url } satisfies ForkConfigApi)
